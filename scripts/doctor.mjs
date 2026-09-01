/**
 * Diagnóstico do banco.
 *
 * Responde a uma pergunta específica: o banco tem tudo o que esta versão do
 * código espera? É o antídoto para o sintoma mais confuso de um deploy —
 * "perfil ausente" no login, que na verdade quer dizer "a migration não
 * rodou" e não tem relação nenhuma com a conta do usuário.
 *
 * Usa a chave publicável quando basta (leitura sob RLS) e a secreta quando
 * disponível, para inspecionar o que a RLS esconderia.
 *
 * Uso:
 *   npm run doctor
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------- ENV */

function loadEnv(path = '.env.local') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* sem .env.local: as variáveis podem vir do ambiente */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e uma chave do Supabase.');
  process.exit(1);
}

const usandoChaveSecreta = Boolean(process.env.SUPABASE_SECRET_KEY);
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* --------------------------------------------------------- O QUE ESPERAR */

/**
 * Exatamente as colunas que `getSessionUser()` pede. Se uma faltar, o login
 * quebra — e é esse o teste mais importante deste script.
 */
const COLUNAS_DO_PERFIL = [
  'id, email, full_name, role, avatar_url, plan, goal, height_cm',
  'water_goal_ml, water_goal_override_ml, kcal_goal, steps_goal',
  'professional_id, chose_solo_at, crm, specialty, created_at',
  'onboarded_at, phone, birth_date, sex, activity_level',
  'training_level, training_days, routine, food_preferences',
  'food_restrictions, health_notes, timezone',
].join(', ');

const TABELAS = [
  { nome: 'profiles', migration: '000_schema' },
  { nome: 'body_metrics', migration: '000_schema' },
  { nome: 'hydration_logs', migration: '000_schema' },
  { nome: 'checkins', migration: '000_schema' },
  { nome: 'notification_prefs', migration: '000_schema' },
  { nome: 'health_documents', migration: '003_documentos' },
  { nome: 'ai_protocols', migration: '005_plataforma' },
  { nome: 'ai_usage', migration: '005_plataforma' },
  { nome: 'ai_outputs', migration: '005_plataforma' },
  { nome: 'push_subscriptions', migration: '005_plataforma' },
  { nome: 'notifications', migration: '005_plataforma' },
];

const FUNCOES = [
  { nome: 'list_professionals', args: {}, migration: '004_escolha' },
  { nome: 'checkin_pending', args: { target_patient: ZERO() }, migration: '005_plataforma' },
  { nome: 'current_week_start', args: { target_profile: ZERO() }, migration: '005_plataforma' },
  { nome: 'latest_weight_kg', args: { target_patient: ZERO() }, migration: '005_plataforma' },
];

function ZERO() {
  return '00000000-0000-0000-0000-000000000000';
}

/* ------------------------------------------------------------- EXECUÇÃO */

const problemas = [];
const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const falha = (t, detalhe) => {
  console.log(`  \x1b[31m✗\x1b[0m ${t}`);
  if (detalhe) console.log(`      ${detalhe}`);
};

console.log(`\nRyse — diagnóstico do banco`);
console.log(`  projeto: ${url}`);
console.log(`  chave:   ${usandoChaveSecreta ? 'secreta (ignora RLS)' : 'publicável (sob RLS)'}\n`);

/* 1. as colunas que o login precisa ------------------------------------- */

console.log('Leitura do perfil (é o que o login faz):');
{
  const { error } = await db.from('profiles').select(COLUNAS_DO_PERFIL).limit(1);

  if (!error) {
    ok('todas as colunas de profiles existem');
  } else if (error.code === '42703') {
    /*
      O Postgres reclama de UMA coluna por vez. Testar cada uma isolada custa
      alguns milissegundos e devolve a lista inteira do que falta — que é a
      diferença entre "rode a migration de novo e torça" e saber exatamente
      qual trecho não pegou.
    */
    falha('faltam colunas em profiles');

    const ausentes = [];
    for (const coluna of COLUNAS_DO_PERFIL.split(',').map((c) => c.trim())) {
      const { error: erroColuna } = await db.from('profiles').select(coluna).limit(1);
      if (erroColuna?.code === '42703') ausentes.push(coluna);
    }

    for (const coluna of ausentes) console.log(`      • ${coluna}`);

    problemas.push(
      `Colunas ausentes em profiles (${ausentes.join(', ')}) — ` +
        'rode supabase/migrations/20260101000005_plataforma.sql.',
    );
  } else {
    falha(`erro ${error.code}`, error.message);
    problemas.push(`Leitura de profiles falhou: ${error.message}`);
  }
}

/* 2. tabelas ------------------------------------------------------------ */

console.log('\nTabelas:');
for (const { nome, migration } of TABELAS) {
  const { error } = await db.from(nome).select('*', { count: 'exact', head: true });

  // 42P01 = relação inexistente. Erro de permissão significa que a tabela
  // existe — a RLS é que barrou, e isso aqui não é problema.
  if (!error || error.code !== '42P01') {
    ok(nome);
  } else {
    falha(`${nome} (migration ${migration})`);
    problemas.push(`Tabela ausente: ${nome} — migration ${migration}.`);
  }
}

/* 3. funções ------------------------------------------------------------ */

console.log('\nFunções:');
for (const { nome, args, migration } of FUNCOES) {
  const { error } = await db.rpc(nome, args);

  // 42883 = função inexistente. Qualquer outro erro (permissão, argumento)
  // já prova que ela está lá.
  if (!error || error.code !== '42883') {
    ok(`${nome}()`);
  } else {
    falha(`${nome}() (migration ${migration})`);
    problemas.push(`Função ausente: ${nome} — migration ${migration}.`);
  }
}

/* 4. buckets ------------------------------------------------------------ */

console.log('\nStorage:');
{
  const { data, error } = await db.storage.listBuckets();

  if (error) {
    console.log(`  \x1b[33m—\x1b[0m não foi possível listar (${error.message})`);
  } else {
    for (const esperado of ['documentos', 'avatares']) {
      if (data.some((b) => b.id === esperado)) ok(`bucket ${esperado}`);
      else {
        falha(`bucket ${esperado}`);
        problemas.push(
          `Bucket ausente: ${esperado} — criado pela migration correspondente.`,
        );
      }
    }
  }
}

/* 5. perfis órfãos ------------------------------------------------------ */

if (usandoChaveSecreta) {
  console.log('\nContas:');
  const { count, error } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (error) console.log(`  \x1b[33m—\x1b[0m ${error.message}`);
  else ok(`${count ?? 0} perfil(is) cadastrado(s)`);
}

/* ------------------------------------------------------------- VEREDITO */

console.log('');

if (problemas.length === 0) {
  console.log('\x1b[32mBanco em dia com esta versão do código.\x1b[0m\n');
  process.exit(0);
}

console.log('\x1b[31mPendências encontradas:\x1b[0m');
for (const p of [...new Set(problemas)]) console.log(`  • ${p}`);

console.log(
  '\nCaminho mais curto: abra o SQL Editor do Supabase e execute o conteúdo de',
);
console.log('  supabase/migrations/20260101000005_plataforma.sql');
console.log('(a migration é idempotente — rodar de novo não causa dano)\n');

process.exit(1);
