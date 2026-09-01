'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient, isAdminConfigured } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/types';

/**
 * Cadastro de profissionais pela administração.
 *
 * Criar uma conta exige a API de autenticação — não dá para inserir em
 * `auth.users` por SQL —, então estas ações usam a chave secreta, que ignora
 * a RLS. É o único lugar do app voltado ao usuário que faz isso, e por isso
 * **toda** função começa por `requireAdmin()`.
 *
 * O cadastro público continua nascendo como paciente (decisão do gatilho
 * `handle_new_user`). Virar profissional só acontece por aqui.
 */

const SEM_CHAVE =
  'A administração precisa da chave secreta do Supabase (SUPABASE_SECRET_KEY) ' +
  'configurada no servidor.';

/* --------------------------------------------------------------- SENHA -- */

/*
  Alfabeto sem caracteres ambíguos.

  A senha provisória vai ser lida de uma tela e digitada em outro aparelho,
  às vezes ditada por telefone. `0/O`, `1/l/I` e `5/S` produzem exatamente o
  tipo de erro que faz alguém achar que o acesso não funciona.
*/
const ALFABETO = 'ABCDEFGHJKLMNPQRTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Senha provisória legível, com entropia suficiente para o vão até a troca. */
export async function gerarSenhaProvisoria(): Promise<string> {
  await requireAdmin();

  // randomInt do node:crypto — Math.random não serve para credencial.
  const corpo = Array.from(
    { length: 10 },
    () => ALFABETO[randomInt(ALFABETO.length)],
  ).join('');

  return `Ryse-${corpo}`;
}

function senhaInterna(): string {
  return `Ryse-${Array.from(
    { length: 10 },
    () => ALFABETO[randomInt(ALFABETO.length)],
  ).join('')}`;
}

/* ------------------------------------------------------------ VALIDAÇÃO -- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_SENHA = 8;

export type NovoProfissional = {
  fullName: string;
  email: string;
  specialty: string;
  crm: string;
  /** Vazio = o sistema gera uma. */
  senhaProvisoria: string;
};

function validar(input: NovoProfissional): string | null {
  if (input.fullName.trim().length < 3) return 'Informe o nome completo.';
  if (input.fullName.length > 120) return 'O nome ficou longo demais.';

  const email = input.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return 'Esse e-mail não parece válido.';

  if (input.specialty.length > 120) return 'A especialidade ficou longa demais.';
  if (input.crm.length > 60) return 'O registro profissional ficou longo demais.';

  if (input.senhaProvisoria && input.senhaProvisoria.length < MIN_SENHA) {
    return `A senha provisória precisa ter pelo menos ${MIN_SENHA} caracteres.`;
  }

  return null;
}

/* ----------------------------------------------------- CRIAR PROFISSIONAL */

export type ProfissionalCriado = {
  email: string;
  senhaProvisoria: string;
  /** `true` quando a conta já existia e teve a senha redefinida. */
  reaproveitada: boolean;
};

export async function criarProfissional(
  input: NovoProfissional,
): Promise<
  { ok: true; data: ProfissionalCriado } | { ok: false; error: string }
> {
  await requireAdmin();

  if (!isAdminConfigured()) return { ok: false, error: SEM_CHAVE };

  const problema = validar(input);
  if (problema) return { ok: false, error: problema };

  const email = input.email.trim().toLowerCase();
  const senha = input.senhaProvisoria.trim() || senhaInterna();

  const admin = createAdminClient();

  /*
    `email_confirm: true` marca o endereço como verificado na criação.

    Não é um atalho: quem cadastra é a administração, que já tem contato com
    a pessoa contratada. Exigir que ela clique num link de confirmação antes
    de conseguir entrar adicionaria um passo que não valida nada — o vínculo
    já foi verificado fora do sistema.

    O cadastro público segue o caminho oposto, e lá a confirmação é
    obrigatória.
  */
  const criado = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });

  let userId = criado.data?.user?.id ?? null;
  let reaproveitada = false;

  if (criado.error) {
    // Qualquer erro que não seja "já existe" é falha de verdade.
    if (!/already|registered|exists/i.test(criado.error.message)) {
      return {
        ok: false,
        error: `Não foi possível criar a conta: ${criado.error.message}`,
      };
    }

    /*
      Conta já existia. Em vez de recusar, redefinimos a senha provisória —
      é exatamente o que a administração quer quando alguém perdeu o acesso,
      e evita ter de apagar a conta (o que levaria junto todo o histórico
      clínico vinculado a ela).
    */
    const { data: existente } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!existente) {
      return {
        ok: false,
        error:
          'Existe uma conta com esse e-mail no login, mas sem perfil. ' +
          'Remova-a em Authentication › Users no painel do Supabase.',
      };
    }

    userId = existente.id;
    reaproveitada = true;

    const { error: erroSenha } = await admin.auth.admin.updateUserById(userId, {
      password: senha,
      email_confirm: true,
    });

    if (erroSenha) {
      return { ok: false, error: `Não foi possível redefinir a senha: ${erroSenha.message}` };
    }
  }

  if (!userId) return { ok: false, error: 'A conta foi criada sem identificador.' };

  /*
    O gatilho `handle_new_user` já criou o perfil como paciente. A promoção
    passa pela chave secreta porque `role` e `crm` são colunas protegidas —
    ver `guard_privileged_profile_columns` na migration 006.
  */
  const { error: erroPerfil } = await admin
    .from('profiles')
    .update({
      full_name: input.fullName.trim(),
      role: 'profissional',
      specialty: input.specialty.trim() || null,
      crm: input.crm.trim() || null,
      professional_id: null,
      // A senha acima é de uso único: o primeiro acesso exige a troca.
      must_change_password: true,
    })
    .eq('id', userId);

  if (erroPerfil) {
    return { ok: false, error: `Conta criada, mas o perfil falhou: ${erroPerfil.message}` };
  }

  revalidatePath('/admin');

  return {
    ok: true,
    data: { email, senhaProvisoria: senha, reaproveitada },
  };
}

/* ------------------------------------------------- REDEFINIR SENHA ------ */

/** Gera nova senha provisória para um profissional que perdeu o acesso. */
export async function redefinirSenhaProvisoria(
  profileId: string,
): Promise<{ ok: true; senha: string } | { ok: false; error: string }> {
  await requireAdmin();

  if (!isAdminConfigured()) return { ok: false, error: SEM_CHAVE };

  const admin = createAdminClient();
  const senha = senhaInterna();

  const { data: alvo } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .maybeSingle();

  if (!alvo) return { ok: false, error: 'Conta não encontrada.' };
  if (alvo.role !== 'profissional') {
    return { ok: false, error: 'Esta conta não é de profissional.' };
  }

  const { error } = await admin.auth.admin.updateUserById(profileId, {
    password: senha,
    email_confirm: true,
  });

  if (error) return { ok: false, error: `Não foi possível redefinir: ${error.message}` };

  await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', profileId);

  revalidatePath('/admin');
  return { ok: true, senha };
}

/* --------------------------------------------------- REVOGAR ACESSO ----- */

/**
 * Tira o acesso profissional de uma conta.
 *
 * Rebaixa para paciente em vez de apagar: a conta costuma ter conversas e
 * decisões clínicas atreladas, e removê-la levaria esse histórico junto. Os
 * pacientes vinculados ficam sem profissional e voltam à tela de escolha.
 */
export async function revogarAcessoProfissional(
  profileId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!isAdminConfigured()) return { ok: false, error: SEM_CHAVE };
  if (profileId === admin.id) {
    return { ok: false, error: 'Você não pode revogar o próprio acesso.' };
  }

  const db = createAdminClient();

  // Solta os pacientes antes: sem isso ficariam apontando para alguém que
  // não é mais profissional, e o gatilho de vínculo recusaria a leitura.
  await db
    .from('profiles')
    .update({ professional_id: null })
    .eq('professional_id', profileId);

  const { error } = await db
    .from('profiles')
    .update({ role: 'paciente', specialty: null, crm: null })
    .eq('id', profileId);

  if (error) return { ok: false, error: 'Não foi possível revogar o acesso.' };

  revalidatePath('/admin');
  return { ok: true };
}
