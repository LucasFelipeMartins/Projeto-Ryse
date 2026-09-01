/**
 * Classificação de rotas por área.
 *
 * Existe porque `pathname.startsWith('/pro')` é uma armadilha: casa com
 * `/progresso`, que é tela de paciente. O efeito era um cliente sem sessão
 * abrindo `/progresso` e sendo mandado para a entrada de profissionais — e,
 * ao entrar, sendo informado de que "esta conta é de cliente".
 *
 * A comparação correta exige que o segmento termine ali: `/pro` exato, ou
 * `/pro/` seguido de mais alguma coisa.
 *
 * Módulo sem dependências de propósito — é importado pelo middleware, que
 * roda no runtime Edge e não deve arrastar ícones nem SDK junto.
 */

/** `true` para `/pro` e `/pro/qualquer-coisa`; `false` para `/progresso`. */
export const ehRotaProfissional = (pathname: string) =>
  pathname === '/pro' || pathname.startsWith('/pro/');

/** Portal de login correspondente à área da rota. */
export const loginDaRota = (pathname: string) =>
  ehRotaProfissional(pathname) ? '/pro/entrar' : '/entrar';
