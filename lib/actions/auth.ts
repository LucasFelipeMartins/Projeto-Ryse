'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type AuthState = {
  error?: string;
  /** Mensagem de sucesso que fica na própria tela (ex.: "e-mail enviado"). */
  notice?: string;
  /** Repopula o formulário depois de um erro. */
  values?: Record<string, string>;
};

/* ------------------------------------------------------------ VALIDAÇÃO --- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function checkEmail(email: string) {
  if (!email) return 'Informe seu e-mail.';
  if (!EMAIL_RE.test(email)) return 'Esse e-mail não parece válido.';
  return null;
}

function checkPassword(password: string) {
  if (!password) return 'Informe uma senha.';
  if (password.length < MIN_PASSWORD)
    return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  return null;
}

/**
 * Traduz os erros do Supabase, que chegam em inglês.
 * O fallback é genérico de propósito: não confirmamos se um e-mail existe.
 */
function translate(message: string) {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'Email not confirmed':
      'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
    'User already registered': 'Já existe uma conta com esse e-mail.',
    'Password should be at least 6 characters.':
      `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
    'New password should be different from the old password.':
      'A nova senha precisa ser diferente da anterior.',
    'Email rate limit exceeded':
      'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    'For security purposes, you can only request this after 60 seconds.':
      'Aguarde um minuto antes de pedir outro e-mail.',
  };
  return map[message] ?? 'Não foi possível concluir. Tente novamente.';
}

/** URL pública do app, para montar os links enviados por e-mail. */
async function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');

  // Fallback: reconstrói a partir do request (cobre previews da Vercel).
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/* ---------------------------------------------------------------- ENTRAR --- */

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('proximo') ?? '') || '/';

  const emailError = checkEmail(email);
  if (emailError) return { error: emailError, values: { email } };
  if (!password) return { error: 'Informe sua senha.', values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translate(error.message), values: { email } };

  revalidatePath('/', 'layout');
  // Só aceita caminho interno — evita open redirect via ?proximo=
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

/* -------------------------------------------------------------- CADASTRO --- */

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const values = { full_name: fullName, email };

  if (fullName.length < 3) return { error: 'Informe seu nome completo.', values };

  const emailError = checkEmail(email);
  if (emailError) return { error: emailError, values };

  const passwordError = checkPassword(password);
  if (passwordError) return { error: passwordError, values };

  if (password !== confirm) return { error: 'As senhas não conferem.', values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lido pelo trigger `handle_new_user` para preencher o perfil.
      data: { full_name: fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirmar`,
    },
  });

  if (error) return { error: translate(error.message), values };

  // Sem sessão = o projeto exige confirmação por e-mail.
  if (!data.session) {
    return {
      notice:
        'Conta criada. Enviamos um link de confirmação para o seu e-mail — ' +
        'abra-o para ativar o acesso.',
    };
  }

  revalidatePath('/', 'layout');
  redirect('/inicio');
}

/* ------------------------------------------------- RECUPERAÇÃO DE SENHA --- */

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  const emailError = checkEmail(email);
  if (emailError) return { error: emailError, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?proximo=/nova-senha`,
  });

  // Rate limit é o único erro que vale mostrar. Qualquer outro viraria um
  // oráculo de "esse e-mail está cadastrado?".
  if (error && error.message.toLowerCase().includes('rate limit')) {
    return { error: translate(error.message), values: { email } };
  }

  return {
    notice:
      'Se existir uma conta com esse e-mail, o link de redefinição chegará ' +
      'em instantes. Verifique também a caixa de spam.',
  };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const passwordError = checkPassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: 'As senhas não conferem.' };

  const supabase = await createClient();

  // O link de recuperação já criou a sessão; sem ela não há o que atualizar.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        'Seu link expirou. Peça uma nova redefinição de senha para continuar.',
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: translate(error.message) };

  revalidatePath('/', 'layout');
  redirect('/');
}

/* ------------------------------------------------------------------ SAIR --- */

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/entrar');
}
