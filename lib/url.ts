/**
 * Resolução da URL pública do app.
 *
 * O problema que este arquivo existe para resolver: atrás de um proxy — que é
 * como Render, Fly, Railway e qualquer container por trás de um load balancer
 * funcionam — `request.url` e `request.nextUrl` carregam o endereço **interno**
 * do processo, algo como `http://localhost:10000`. Quem termina o TLS é a
 * borda; o app recebe HTTP simples numa porta local e não tem como saber, pela
 * própria URL, qual domínio o usuário digitou.
 *
 * Redirecionar usando esse valor manda o navegador para `localhost` — a página
 * que "recusou estabelecer ligação". A informação correta chega nos cabeçalhos
 * `X-Forwarded-Host` / `X-Forwarded-Proto`, que o proxy preenche.
 *
 * Regra geral adotada aqui: **redirecionamento interno vai relativo**. Um
 * `Location: /entrar` é resolvido pelo navegador contra a barra de endereços,
 * então está sempre certo — e não dá para envenenar com cabeçalho forjado.
 * Só onde a URL precisa ser absoluta (links de e-mail) é que derivamos a
 * origem, e aí com cuidado.
 */

/** Hosts que nunca são o endereço público de uma instalação hospedada. */
const HOSTS_INTERNOS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];

const ehInterno = (host: string) =>
  HOSTS_INTERNOS.some((h) => host === h || host.startsWith(`${h}:`));

/** Remove protocolo, barra final e caminho — sobra só `host:porta`. */
export function hostDe(valor: string | undefined | null): string | null {
  if (!valor) return null;
  const limpo = valor.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return limpo || null;
}

/**
 * Origem configurada explicitamente, se houver e se fizer sentido.
 *
 * `NEXT_PUBLIC_SITE_URL` apontando para localhost é o resto de um `.env.local`
 * copiado para o servidor — situação comum ao trocar de hospedagem. Nesse
 * caso o valor é descartado em favor dos cabeçalhos, senão o app geraria
 * links de e-mail para a máquina de quem programou.
 *
 * `RENDER_EXTERNAL_URL` é preenchido automaticamente pelo Render e serve de
 * rede de segurança quando ninguém configurou nada.
 */
function origemConfigurada(): string | null {
  const candidatos = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.RENDER_EXTERNAL_URL,
  ];

  for (const bruto of candidatos) {
    const host = hostDe(bruto);
    if (!host || ehInterno(host)) continue;

    const proto = bruto?.startsWith('http://') ? 'http' : 'https';
    return `${proto}://${host}`;
  }

  return null;
}

/** Cabeçalhos aceitos, do mais específico ao mais genérico. */
type LeitorDeHeader = { get(name: string): string | null };

/**
 * Origem pública derivada dos cabeçalhos do proxy.
 *
 * `X-Forwarded-Host` pode vir com uma lista ("a.com, b.com") quando há mais de
 * um salto — o primeiro é o que o cliente enxergou.
 *
 * Devolve `null` quando o host disponível é interno. Isso é deliberado e é o
 * ponto sutil deste arquivo: nem todo proxy envia `X-Forwarded-Host`. Quando
 * só chega `X-Forwarded-Proto: https` com `Host: localhost:10000`, juntar os
 * dois produz `https://localhost:10000` — um endereço que não existe para
 * ninguém. Melhor admitir que não sabemos e deixar quem chamou decidir.
 */
export function origemDosHeaders(headers: LeitorDeHeader): string | null {
  const encaminhado = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const direto = headers.get('host')?.trim();
  const host = encaminhado || direto;

  if (!host || ehInterno(host)) return null;

  const proto = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ?? 'https';

  return `${proto}://${host}`;
}

/**
 * Origem para montar um redirecionamento interno.
 *
 * A ordem importa, e o último caso é o que salva a instalação mal
 * configurada:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` / `RENDER_EXTERNAL_URL` — não podem ser forjados;
 *   2. cabeçalhos do proxy, quando apontam para um host de verdade;
 *   3. a própria origem da requisição.
 *
 * O caso 3 parece inútil (é o endereço interno), mas não é: como o destino
 * fica na MESMA origem da requisição, o Next serializa o `Location` como
 * caminho relativo, e o navegador o resolve contra a barra de endereços.
 * O resultado é correto mesmo sem nenhuma configuração.
 *
 * O que quebra é misturar as fontes — host interno com protocolo do proxy
 * gera uma origem que difere da requisição, o `Location` sai absoluto, e o
 * navegador vai para `https://localhost:10000`.
 */
export function origemParaRedirect(
  headers: LeitorDeHeader,
  origemDaRequisicao: string,
): string {
  return origemConfigurada() ?? origemDosHeaders(headers) ?? origemDaRequisicao;
}

/**
 * URL pública do app, para montar links que saem daqui (e-mail, sobretudo).
 *
 * A ordem privilegia a configuração explícita porque ela é a única que não
 * pode ser forjada por um cabeçalho de requisição. Só quando ela falta — ou
 * aponta para localhost num ambiente que claramente não é local — é que os
 * cabeçalhos entram.
 */
export function urlPublica(headers: LeitorDeHeader): string {
  const configurada = origemConfigurada();
  if (configurada) return configurada;

  const dosHeaders = origemDosHeaders(headers);
  if (dosHeaders) return dosHeaders;

  // Último recurso: desenvolvimento local sem nenhum cabeçalho útil.
  return 'http://localhost:3000';
}
