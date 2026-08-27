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

/**
 * Login com portal separado.
 *
 * Cliente e profissional entram por portas diferentes, e cada porta só aceita
 * o seu papel. Não é cosmético: o portal do profissional expõe a lista de
 * pacientes e a fila clínica, então deixar um cliente autenticar ali — mesmo
 * que a interface depois o redirecionasse — significaria criar uma sessão
 * válida no contexto errado.
 *
 * Quando o papel não bate, a sessão recém-criada é encerrada na hora. O
 * usuário recebe o endereço certo em vez de uma negativa seca.
 */
async function authenticate(
  formData: FormData,
  portal: 'paciente' | 'profissional',
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('proximo') ?? '');

  const emailError = checkEmail(email);
  if (emailError) return { error: emailError, values: { email } };
  if (!password) return { error: 'Informe sua senha.', values: { email } };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: translate(error.message), values: { email } };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarded_at')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: 'Sua conta existe, mas o perfil não foi encontrado. Fale com o suporte.',
      values: { email },
    };
  }

  if (profile.role !== portal) {
    await supabase.auth.signOut();
    return {
      error:
        portal === 'profissional'
          ? 'Esta é a entrada de profissionais. Sua conta é de cliente — use a página de login do app.'
          : 'Esta conta é de profissional. Entre pela área profissional.',
      values: { email },
    };
  }

  revalidatePath('/', 'layout');

  // Só aceita caminho interno — evita open redirect via ?proximo=
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null;

  if (profile.role === 'profissional') {
    redirect(safeNext && safeNext.startsWith('/pro') ? safeNext : '/pro');
  }

  // Cliente sem onboarding vai para o formulário, não para o dashboard.
  if (!profile.onboarded_at) redirect('/onboarding');

  redirect(safeNext && !safeNext.startsWith('/pro') ? safeNext : '/inicio');
}

/** Entrada do cliente. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  return authenticate(formData, 'paciente');
}

/** Entrada do profissional. */
export async function signInProfessional(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  return authenticate(formData, 'profissional');
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
  // Conta nova nunca tem onboarding: o formulário é o primeiro destino.
  redirect('/onboarding');
}

/* ------------------------------------------------- RECUPERAÇÃO DE SENHA --- */

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  // O portal de origem viaja no link para que o profissional volte à área
  // dele depois de trocar a senha, em vez de cair no app do cliente.
  const portal =
    String(formData.get('portal') ?? '') === 'profissional' ? 'profissional' : 'paciente';

  const emailError = checkEmail(email);
  if (emailError) return { error: emailError, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?proximo=${encodeURIComponent(
      `/nova-senha?portal=${portal}`,
    )}`,
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

/**
 * Encerra a sessão e devolve o usuário ao portal em que ele entrou.
 * Mandar um profissional para /entrar o obrigaria a procurar a porta certa.
 */
export async function signOut() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destino = '/entrar';

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.role === 'profissional') destino = '/pro/entrar';
  }

  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(destino);
}
