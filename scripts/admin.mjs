/**
 * Operações administrativas do Ryse.
 *
 * Usa a chave SECRETA (`SUPABASE_SECRET_KEY`), que ignora a Row Level
 * Security. Por isso este script roda só na sua máquina, nunca no app, e a
 * chave nunca recebe o prefixo NEXT_PUBLIC_.
 *
 * Uso:
 *   node scripts/admin.mjs status
 *   node scripts/admin.mjs listar
 *   node scripts/admin.mjs promover  medico@clinica.com
 *   node scripts/admin.mjs vincular  paciente@email.com  medico@clinica.com
 *   node scripts/admin.mjs criar-profissional medico@clinica.com
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------- ENV */

// Node 24 lê .env com --env-file, mas ler à mão evita depender da flag.
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
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  console.error(
    'Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local.',
  );
  process.exit(1);
}

const db = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* --------------------------------------------------------------- HELPERS */

const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

async function findByEmail(email) {
  const { data, error } = await db
    .from('profiles')
    .select('id, email, full_name, role, professional_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) fail(`Erro ao buscar ${email}: ${error.message}`);
  return data;
}

/* --------------------------------------------------------------- COMANDOS */

async function status() {
  const tables = [
    'profiles',
    'nutrition_plans',
    'meals',
    'workout_plans',
    'hydration_logs',
    'checkins',
    'exams',
    'ai_reviews',
    'conversations',
    'subscriptions',
  ];

  console.log(`\nProjeto: ${url}\n`);

  let missing = 0;
  for (const t of tables) {
    // Um SELECT de verdade. Com `head: true` o supabase-js devolve
    // error: null mesmo para tabela inexistente — falso positivo.
    const { data, error } = await db.from(t).select('*').limit(1000);

    if (error) {
      missing += 1;
      console.log(`  ✗ ${t.padEnd(18)} ${error.message}`);
    } else {
      console.log(`  ✓ ${t.padEnd(18)} ${data.length} registro(s)`);
    }
  }

  if (missing > 0) {
    console.log(
      '\nAlgumas tabelas não existem. Rode supabase/setup.sql no SQL Editor.',
    );
    process.exit(1);
  }

  console.log('\nBanco pronto.\n');
}

async function listar() {
  const { data, error } = await db
    .from('profiles')
    .select('email, full_name, role, professional_id')
    .order('role')
    .order('full_name');

  if (error) fail(error.message);
  if (!data?.length) {
    console.log('\nNenhuma conta ainda. Cadastre-se em /cadastrar.\n');
    return;
  }

  console.log('');
  for (const p of data) {
    const vinculo = p.professional_id ? ' (vinculado)' : '';
    console.log(
      `  ${p.role.padEnd(13)} ${p.email.padEnd(32)} ${p.full_name}${vinculo}`,
    );
  }
  console.log('');
}

async function promover(email) {
  if (!email) fail('Informe o e-mail: node scripts/admin.mjs promover a@b.com');

  const profile = await findByEmail(email);
  if (!profile) fail(`Conta não encontrada: ${email}. Cadastre-se primeiro.`);

  const { error } = await db
    .from('profiles')
    .update({ role: 'profissional', professional_id: null })
    .eq('id', profile.id);

  if (error) fail(error.message);
  ok(`${profile.full_name} agora é profissional.`);
}

async function vincular(patientEmail, proEmail) {
  if (!patientEmail || !proEmail) {
    fail('Uso: node scripts/admin.mjs vincular paciente@email.com medico@clinica.com');
  }

  const patient = await findByEmail(patientEmail);
  if (!patient) fail(`Paciente não encontrado: ${patientEmail}`);

  const pro = await findByEmail(proEmail);
  if (!pro) fail(`Profissional não encontrado: ${proEmail}`);
  if (pro.role !== 'profissional') {
    fail(`${proEmail} ainda não é profissional. Rode "promover" antes.`);
  }

  const { error } = await db
    .from('profiles')
    .update({ role: 'paciente', professional_id: pro.id })
    .eq('id', patient.id);

  if (error) fail(error.message);

  // Abre o canal de mensagens entre os dois.
  await db
    .from('conversations')
    .upsert(
      { patient_id: patient.id, professional_id: pro.id },
      { onConflict: 'patient_id,professional_id' },
    );

  ok(`${patient.full_name} vinculado a ${pro.full_name}.`);
}

/**
 * Cria a conta do profissional, já confirmada, e vincula os pacientes
 * existentes a ela.
 *
 * A criação passa pela API de admin porque o cadastro público sempre nasce
 * como paciente (é o trigger handle_new_user quem decide) e porque o projeto
 * exige confirmação de e-mail — que aqui é dispensada.
 */
async function criarProfissional(email, senha) {
  if (!email) {
    fail('Uso: node scripts/admin.mjs criar-profissional medico@email.com [senha]');
  }

  const password = senha || 'RysePro' + Math.random().toString(36).slice(2, 8) + '!';

  // 1. conta no auth, já confirmada
  const created = await db.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Dr. Rafael Mendes' },
  });

  let userId = created.data?.user?.id;

  if (created.error) {
    if (!/already/i.test(created.error.message)) fail(created.error.message);

    // Já existia: reaproveita e apenas garante a senha e a confirmação.
    const existing = await findByEmail(email);
    if (!existing) fail('Conta existe no auth mas não tem perfil. Apague-a no painel.');
    userId = existing.id;
    await db.auth.admin.updateUserById(userId, { password, email_confirm: true });
    ok(`Conta já existia — senha redefinida.`);
  } else {
    ok(`Conta criada: ${email}`);
  }

  // 2. papel de profissional
  const { error: upErr } = await db
    .from('profiles')
    .update({
      role: 'profissional',
      specialty: 'Nutrólogo e médico do esporte',
      crm: 'CRM-SP 148.209',
      professional_id: null,
    })
    .eq('id', userId);

  if (upErr) fail(upErr.message);
  ok('Perfil promovido a profissional.');

  // 3. vincula todos os pacientes soltos
  const { data: soltos } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'paciente')
    .is('professional_id', null);

  if (soltos?.length) {
    await db
      .from('profiles')
      .update({ professional_id: userId })
      .in('id', soltos.map((p) => p.id));

    for (const paciente of soltos) {
      await db
        .from('conversations')
        .upsert(
          { patient_id: paciente.id, professional_id: userId },
          { onConflict: 'patient_id,professional_id' },
        );
    }

    ok(`${soltos.length} paciente(s) vinculado(s): ${soltos.map((p) => p.full_name).join(', ')}`);
  } else {
    console.log('  (nenhum paciente solto para vincular)');
  }

  console.log(`
─────────────────────────────────────────────
  Entre em /entrar com:

    e-mail: ${email}
    senha:  ${password}

  Você cai direto em /pro.
─────────────────────────────────────────────
`);
}

/* ------------------------------------------------------------------ MAIN */

const [command, ...args] = process.argv.slice(2);

const commands = { status, listar, promover, vincular, 'criar-profissional': criarProfissional };

if (!command || !commands[command]) {
  console.log(`
Comandos disponíveis:

  status                          verifica se as tabelas existem
  listar                          lista as contas cadastradas
  promover  <email>               torna a conta um profissional
  vincular  <paciente> <medico>   liga um paciente ao profissional

  criar-profissional <email> [senha]
      cria a conta do profissional já confirmada, promove e vincula
      todos os pacientes que ainda não têm profissional
`);
  process.exit(command ? 1 : 0);
}

await commands[command](...args);
