'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { urlPublicaOuNula } from '@/lib/url';
import { ehRotaProfissional } from '@/lib/routes';

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
 *
 * A correspondência é por PADRÃO, não por igualdade exata.
 *
 * A versão anterior usava um dicionário com a frase inteira como chave. Isso
 * quebra em silêncio toda vez que o provedor reescreve a mensagem — e ele
 * reescreve: "Email rate limit exceeded" já apareceu em caixa baixa e como
 * "over_email_send_rate_limit". Quando a chave não casava, o usuário recebia
 * o genérico "Não foi possível concluir", que não diz nada e manda tentar de
 * novo justamente quando tentar de novo é o que não se deve fazer.
 *
 * O fallback também registra a mensagem original no log: sem isso, um erro
 * novo do provedor fica invisível para sempre.
 */
function translate(message: string, contexto = 'auth') {
  const regras: [RegExp, string][] = [
    [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
    [
      /email not confirmed|email_not_confirmed/i,
      'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.',
    ],
    [
      /(email|token).*(invalid|expired)|expired.*token|otp_expired/i,
      'Esse link não é mais válido. Peça um novo.',
    ],
    [
      /already registered|user_already_exists/i,
      'Já existe uma conta com esse e-mail.',
    ],
    [
      /password should be at least/i,
      `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`,
    ],
    [
      /should be different|same_password/i,
      'A nova senha precisa ser diferente da anterior.',
    ],
    /*
      Limite de envio de e-mail.

      O SMTP padrão do Supabase permite pouquíssimas mensagens por hora e é
      destinado a desenvolvimento. Quem está testando cadastro e recuperação
      bate nesse teto rápido, então a mensagem diz o que fazer em vez de
      sugerir "tente novamente" — que só piora.
    */
    [
      /rate limit|over_email_send_rate_limit|too many requests/i,
      'Limite de envio de e-mails atingido. Aguarde alguns minutos. ' +
        'Se isso se repetir, configure um SMTP próprio no Supabase — o padrão ' +
        'permite poucos envios por hora.',
    ],
    [
      /you can only request this after|security purposes/i,
      'Aguarde um minuto antes de pedir outro e-mail.',
    ],
    [
      /error sending|smtp|failed to send/i,
      'Não conseguimos enviar o e-mail. Verifique a configuração de SMTP no Supabase.',
    ],
    [
      /signups not allowed|signup_disabled/i,
      'O cadastro está desativado no momento.',
    ],
  ];

  for (const [padrao, texto] of regras) {
    if (padrao.test(message)) return texto;
  }

  // Erro fora do catálogo: fica no log para não sumir.
  console.error(`[${contexto}] erro não mapeado do Supabase:`, message);

  return 'Não foi possível concluir. Tente novamente.';
}

/**
 * URL pública do app, para montar os links enviados por e-mail.
 *
 * Devolve `null` quando o endereço não pode ser determinado em produção. A
 * resolução mora em `lib/url.ts`, e o `null` é intencional: mandar um e-mail
 * com link para `localhost` é uma falha silenciosa — a mensagem sai, chega, e
 * morre no clique, sem erro em lugar nenhum que explique o motivo. Melhor
 * recusar o envio e dizer o que está faltando.
 */
async function siteUrl(): Promise<string | null> {
  return urlPublicaOuNula(await headers());
}

const SEM_ENDERECO =
  'O sistema não sabe o próprio endereço público, então o link do e-mail ' +
  'chegaria quebrado. Avise o suporte para configurar APP_URL no servidor.';

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

  if (error) {
    /*
      E-mail ainda não confirmado não é erro de credencial — é um passo que
      falta. Mandar para a tela de verificação, com o endereço já preenchido,
      dá saída a quem perdeu o primeiro e-mail; uma mensagem de erro seca
      deixaria a pessoa presa sem saber que existe reenvio.
    */
    if (/not confirmed|Email not confirmed/i.test(error.message)) {
      redirect(`/verificar-email?email=${encodeURIComponent(email)}`);
    }
    return { error: translate(error.message), values: { email } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarded_at, must_change_password')
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

  /*
    Senha provisória em uso: nenhuma tela do app abre antes da troca. Vem
    antes até do onboarding — de nada adianta preencher o perfil com uma
    credencial que circulou por mensagem.
  */
  if (profile.must_change_password) redirect('/definir-senha');

  // Só aceita caminho interno — evita open redirect via ?proximo=
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null;

  /*
    O destino guardado só é aceito se pertencer à área do papel que entrou.
    A comparação usa `ehRotaProfissional`, e não `startsWith('/pro')`: este
    último casaria com `/progresso` e devolveria um paciente à home em vez
    de levá-lo à tela que ele havia pedido.
  */
  if (profile.role === 'profissional') {
    redirect(safeNext && ehRotaProfissional(safeNext) ? safeNext : '/pro');
  }

  // Cliente sem onboarding vai para o formulário, não para o dashboard.
  if (!profile.onboarded_at) redirect('/onboarding');

  redirect(safeNext && !ehRotaProfissional(safeNext) ? safeNext : '/inicio');
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

  const base = await siteUrl();
  if (!base) return { error: SEM_ENDERECO, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Lido pelo trigger `handle_new_user` para preencher o perfil.
      data: { full_name: fullName },
      emailRedirectTo: `${base}/auth/confirmar`,
    },
  });

  if (error) return { error: translate(error.message), values };

  /*
    Sem sessão = o projeto exige confirmação por e-mail, que é o
    comportamento desejado: a conta existe, mas não entra em lugar nenhum
    até o endereço ser provado.

    A tela dedicada substitui o aviso que ficava aqui porque ela oferece o
    reenvio — e o e-mail de confirmação some com frequência suficiente para
    que não ter esse caminho signifique perder o cadastro.
  */
  if (!data.session) {
    redirect(`/verificar-email?email=${encodeURIComponent(email)}`);
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

  const base = await siteUrl();
  if (!base) return { error: SEM_ENDERECO, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?proximo=${encodeURIComponent(
      `/nova-senha?portal=${portal}`,
    )}`,
  });

  /*
    Falha de ENTREGA precisa aparecer; falha de identidade, não.

    Dizer "enviamos o link" quando o envio falhou deixa a pessoa esperando um
    e-mail que nunca vem. Mas revelar "esse e-mail não existe" transformaria a
    tela num oráculo de quem tem conta aqui — então só erros sobre o envio em
    si sobem para a interface.
  */
  if (error) {
    console.error('[recuperar-senha] Supabase respondeu:', error.message);

    if (/rate limit|too many|security purposes|smtp|error sending|failed to send/i.test(error.message)) {
      return { error: translate(error.message, 'recuperar-senha'), values: { email } };
    }
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

  /*
    Redefinir a senha também encerra a exigência de troca.

    Sem isto, um profissional que perdeu a senha provisória e usou
    "esqueci minha senha" definiria a senha nova e mesmo assim continuaria
    preso em /definir-senha — a bandeira seguiria ligada, exigindo trocar de
    novo uma senha que ele acabou de escolher.

    A função é SECURITY DEFINER porque a coluna é protegida; chamá-la para
    quem não tinha a exigência é inofensivo (o UPDATE não casa nenhuma linha).
  */
  await supabase.rpc('finish_password_setup');

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
