# Hospedagem atrás de proxy (Render, Fly, Railway, Docker)

Guia do que precisa estar configurado fora da Vercel — e a explicação do
`ERR_CONNECTION_REFUSED` em `localhost` logo depois do login.

---

## O que causava o redirect para localhost

Dois problemas independentes, ambos produzindo o mesmo sintoma.

### 1. O app não sabia o próprio endereço

Render, Fly, Railway e qualquer container atrás de um load balancer funcionam
assim: a borda termina o TLS e encaminha a requisição para o processo por HTTP
simples, numa porta interna. O app recebe algo como
`http://localhost:10000/inicio`.

O middleware montava o desvio para o login a partir desse valor
(`request.nextUrl`), e o navegador recebia:

```
Location: http://localhost:10000/entrar
```

O domínio real chega em `X-Forwarded-Host` / `X-Forwarded-Proto`, que o proxy
preenche. Agora é de lá que a origem sai (`lib/url.ts`), com `request.nextUrl`
apenas como último recurso para desenvolvimento local.

Os três route handlers de autenticação (`/auth/callback`, `/auth/confirmar`,
`/auth/sair`) tinham o mesmo defeito e passaram a devolver caminho relativo,
que o navegador resolve contra a barra de endereços.

> Nota para quem for mexer nisso: caminho relativo **não** funciona no
> middleware. O Next valida a URL ali e recusa com `ERR_INVALID_URL`. Em Route
> Handler funciona; em middleware, não.

### 2. `NEXT_PUBLIC_SITE_URL` apontando para localhost

O `.env.local` do projeto tem `NEXT_PUBLIC_SITE_URL=http://localhost:3000` —
correto para desenvolvimento. Copiado para o servidor, faz os links de
recuperação de senha e confirmação de e-mail chegarem apontando para a máquina
de quem programou.

`lib/url.ts` agora **descarta** um valor que aponta para localhost e usa os
cabeçalhos do proxy no lugar. Ainda assim, configure a variável corretamente:
ela é a única fonte que não pode ser forjada por cabeçalho.

---

## Configuração no Render

### Variáveis de ambiente

```bash
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# O endereço público. Use APP_URL, não NEXT_PUBLIC_SITE_URL — veja abaixo.
APP_URL=https://ryse.onrender.com
```

### Por que APP_URL e não NEXT_PUBLIC_SITE_URL

O Next substitui `process.env.NEXT_PUBLIC_*` pelo valor **literal** durante o
build, inclusive no código de servidor. Se a build rodou sem a variável — ou
com o `http://localhost:3000` herdado do `.env.local` —, o valor fica gravado
no bundle. Alterá-la depois no painel do Render **não muda nada** até um novo
deploy.

Esse é o motivo mais comum de "configurei e o e-mail continua indo para
localhost".

`APP_URL` não leva o prefixo, então é lida em tempo de execução: definir e
reiniciar já resolve. O app aceita as duas, com `APP_URL` tendo prioridade.

Opcionais, conforme o que você for usar:

```bash
GROQ_API_KEY=gsk_...                    # IA gratuita
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...       # push
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@seudominio.com
CRON_SECRET=<valor longo e aleatório>
SUPABASE_SECRET_KEY=sb_secret_...       # só o cron usa
```

Com **domínio próprio** além do `.onrender.com`, liste os dois para as Server
Actions:

```bash
SERVER_ACTIONS_ALLOWED_ORIGINS=ryse.onrender.com,app.ryse.com.br
```

### Build e start

```
Build Command:  npm ci && npm run build
Start Command:  npm start
```

O `next start` já respeita a variável `PORT` que o Render injeta.

---

## Supabase — configuração obrigatória

Os links de e-mail passam por uma lista de permissão no painel do Supabase.
Sem isto, o link de recuperação de senha é recusado ou volta para o endereço
antigo, independentemente do que o app envie.

**Authentication → URL Configuration:**

| Campo | Valor |
|---|---|
| Site URL | `https://ryse.onrender.com` |
| Redirect URLs | `https://ryse.onrender.com/**` |

Mantenha `http://localhost:3000/**` na lista de Redirect URLs se você ainda
desenvolve local — a lista aceita várias entradas.

---

## Verificação

Depois do deploy, dá para conferir o desvio sem abrir o navegador:

```bash
curl -sI https://ryse.onrender.com/inicio | grep -i location
```

O esperado é o seu domínio:

```
location: https://ryse.onrender.com/entrar?proximo=%2Finicio
```

Se aparecer `localhost` ou um IP interno, o proxy não está enviando
`X-Forwarded-Host` — nesse caso, defina `APP_URL` explicitamente.

### Links de e-mail

Redirecionamento dentro do app e link de e-mail são caminhos diferentes: o
primeiro é relativo e se resolve sozinho, o segundo precisa de uma URL
absoluta e correta.

Quando o app não consegue determinar o próprio endereço em produção, ele
**recusa o envio** com uma mensagem clara, em vez de mandar um e-mail cujo
link morre no clique. O log do servidor traz a linha `[url] não foi possível
determinar o endereço público`.

Mas há um segundo portão, e ele é do Supabase: o `redirect_to` que o app envia
é validado contra a lista de **Redirect URLs** do projeto. Se não estiver lá,
o Supabase ignora e usa o **Site URL** dele. Ou seja: com o Site URL apontando
para localhost no painel, o link vai para localhost por mais correto que o app
esteja. As duas configurações precisam bater.

---

## Cron das notificações

O `vercel.json` agenda o despacho automaticamente na Vercel. **No Render isso
não é lido.** Crie um *Cron Job* separado apontando para a rota:

```
Schedule: 0 * * * *
Command:  curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
            https://ryse.onrender.com/api/notificacoes/despachar
```

Sem isso, os lembretes ficam enfileirados no banco e nunca saem para os
aparelhos. A caixa de notificações dentro do app continua funcionando — ela lê
a fila diretamente.
