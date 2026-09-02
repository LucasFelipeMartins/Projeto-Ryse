/**
 * Hosts autorizados a disparar Server Actions.
 *
 * O Next compara o cabeçalho `Origin` com o `Host` da requisição e recusa a
 * ação quando eles divergem — proteção contra CSRF. Atrás de um proxy que não
 * reescreve o `Host` (Render, Fly, Railway e afins), os dois SEMPRE divergem:
 * o navegador manda o domínio público, o processo recebe o host interno. O
 * resultado é o formulário de login falhando sem mensagem clara.
 *
 * Declarar o domínio público resolve. Aceita a variável que o Render preenche
 * sozinho, a configuração explícita do projeto e uma lista extra separada por
 * vírgula, para quem usa domínio próprio.
 */
const hostsPermitidos = [
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.RENDER_EXTERNAL_URL,
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? '').split(','),
]
  .map((valor) =>
    (valor ?? '')
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, ''),
  )
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    serverActions: {
      /*
        A chave só entra quando há host configurado. Passar uma lista vazia
        não é o mesmo que omitir: em vez de "use o padrão", o Next entenderia
        "nenhuma origem além do host", que é justamente o que queremos evitar.
      */
      ...(hostsPermitidos.length > 0
        ? { allowedOrigins: [...new Set(hostsPermitidos)] }
        : {}),

      // O upload do avatar vai direto do navegador para o Storage, mas deixar
      // folga aqui evita que um formulário maior estoure o teto de 1 MB.
      bodySizeLimit: '2mb',
    },
  },

  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ],
};

export default nextConfig;
