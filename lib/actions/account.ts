'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient, getSessionUser, homeFor } from '@/lib/supabase/server';
import { urlPublicaOuNula } from '@/lib/url';
import type { ActionResult } from '@/lib/types';

/**
 * Ações da própria conta: primeira senha e confirmação de e-mail.
 *
 * Ficam separadas de `lib/actions/auth.ts` porque acontecem **com** sessão —
 * ou, no caso do reenvio de confirmação, num limbo entre cadastrar e entrar.
 */

const MIN_SENHA = 8;

/**
 * Força mínima da senha.
 *
 * Comprimento é o fator que mais importa, mas uma senha provisória tem a
 * forma `Ryse-xxxxxxxxxx` — e quem acabou de recebê-la tende a digitar algo
 * parecido. Exigir duas classes de caractere evita que a "nova" senha seja
 * uma variação trivial da que acabou de circular por mensagem.
 */
function avaliarSenha(senha: string): string | null {
  if (senha.length < MIN_SENHA) {
    return `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.`;
  }
  if (senha.length > 72) {
    // Limite do bcrypt: além disso os caracteres são silenciosamente ignorados.
    return 'A senha pode ter no máximo 72 caracteres.';
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(senha),
  ).length;

  if (classes < 2) {
    return 'Misture letras e números (ou símbolos) para uma senha mais forte.';
  }

  return null;
}

/* -------------------------------------------------- PRIMEIRA SENHA ------ */

export type PasswordState = { error?: string; notice?: string };

/**
 * Troca a senha provisória pela definitiva.
 *
 * A ordem importa: primeiro a senha muda no serviço de autenticação, e só
 * depois a exigência é encerrada. Invertido, uma falha no meio deixaria a
 * conta liberada ainda usando a senha que circulou por fora.
 */
export async function definirPrimeiraSenha(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const senha = String(formData.get('password') ?? '');
  const confirmacao = String(formData.get('confirm') ?? '');

  const user = await getSessionUser();
  if (!user) {
    return { error: 'Sua sessão expirou. Entre novamente para continuar.' };
  }

  const problema = avaliarSenha(senha);
  if (problema) return { error: problema };
  if (senha !== confirmacao) return { error: 'As senhas não conferem.' };

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    if (/should be different|same/i.test(error.message)) {
      return { error: 'A nova senha precisa ser diferente da provisória.' };
    }
    return { error: 'Não foi possível salvar a senha. Tente novamente.' };
  }

  /*
    `must_change_password` é coluna protegida pelo gatilho da migration 006 —
    se um update comum a desligasse, bastaria isso para seguir usando a senha
    provisória. A função SECURITY DEFINER é o único caminho.
  */
  const { error: erroFlag } = await supabase.rpc('finish_password_setup');

  if (erroFlag) {
    return {
      error:
        'A senha foi alterada, mas o cadastro não pôde ser concluído. ' +
        'Recarregue a página.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(homeFor(user.role));
}

/* ------------------------------------------- CONFIRMAÇÃO DE E-MAIL ------ */

/**
 * Reenvia o e-mail de confirmação do cadastro.
 *
 * Existe porque o primeiro e-mail se perde com frequência — cai em spam,
 * o endereço foi digitado errado, o link expirou. Sem um caminho de reenvio,
 * a conta fica em um limbo do qual a pessoa não sai sozinha.
 *
 * A resposta é sempre a mesma, com ou sem conta correspondente: confirmar
 * quais e-mails existem na base é um vazamento gratuito.
 */
export async function reenviarConfirmacao(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) return { error: 'Informe o e-mail usado no cadastro.' };

  const base = urlPublicaOuNula(await headers());

  if (!base) {
    return {
      error:
        'O sistema não sabe o próprio endereço público, então o link chegaria ' +
        'quebrado. Avise o suporte para configurar APP_URL no servidor.',
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${base}/auth/confirmar`,
    },
  });

  // Só o limite de envio vale como erro visível — os demais virariam um
  // oráculo de "esse e-mail está cadastrado?".
  if (error && /rate limit|only request this after|security purposes/i.test(error.message)) {
    return {
      error: 'Aguarde um minuto antes de pedir outro e-mail.',
    };
  }

  return {
    notice:
      'Se houver um cadastro pendente com esse e-mail, o link de confirmação ' +
      'chegará em instantes. Verifique também a caixa de spam.',
  };
}

/* ----------------------------------------------------- TROCA VOLUNTÁRIA - */

/** Troca de senha a partir do perfil, com a senha atual em mãos. */
export async function alterarSenha(input: {
  senhaAtual: string;
  novaSenha: string;
}): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Sessão expirada.' };

  const problema = avaliarSenha(input.novaSenha);
  if (problema) return { ok: false, error: problema };

  const supabase = await createClient();

  /*
    Reautentica antes de trocar.

    `updateUser` sozinho aceitaria a mudança só com o cookie válido — o que
    transforma uma sessão esquecida num navegador emprestado em sequestro de
    conta. Pedir a senha atual custa um campo e fecha esse caminho.
  */
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.senhaAtual,
  });

  if (erroLogin) return { ok: false, error: 'A senha atual está incorreta.' };

  const { error } = await supabase.auth.updateUser({ password: input.novaSenha });

  if (error) {
    if (/should be different|same/i.test(error.message)) {
      return { ok: false, error: 'A nova senha precisa ser diferente da atual.' };
    }
    return { ok: false, error: 'Não foi possível alterar a senha.' };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}
