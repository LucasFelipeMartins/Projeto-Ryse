# Ryse

Front-end completo da plataforma **Ryse** — nutrição, treino e exames com inteligência
clínica revisada por profissionais.

Construído **mobile-first** (Android e iOS), como PWA instalável, e adaptado para
desktop. Pronto para deploy na Vercel.

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

O backend (Supabase, schema, RLS e autenticação) está documentado em
**[BACKEND.md](BACKEND.md)**. Sem as variáveis configuradas o app abre numa
tela explicando o passo a passo, em vez de quebrar.

| Script              | O que faz                                        |
| ------------------- | ------------------------------------------------ |
| `npm run dev`       | Servidor de desenvolvimento                      |
| `npm run build`     | Build de produção                                |
| `npm run start`     | Serve o build de produção                        |
| `npm run typecheck` | Checagem de tipos sem emitir arquivos            |
| `npm run icons`     | Regenera os ícones PWA a partir da marca em SVG  |

---

## Deploy na Vercel

O projeto é um app Next.js padrão — a Vercel detecta tudo sozinha.

**Pela interface:** importe o repositório em [vercel.com/new](https://vercel.com/new).
Framework `Next.js`, build `next build`, output padrão. Não há variáveis de ambiente.

**Pela CLI:**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # produção
```

O `vercel.json` já define região `gru1` (São Paulo, menor latência no Brasil),
cabeçalhos de segurança e cache imutável para os ícones.

---

## Paleta

Dois temas com a mesma marca laranja. A troca acontece por CSS custom properties
em `app/globals.css` — nenhum componente conhece cor literal, só tokens semânticos.

|                   | Light                | Dark                 |
| ----------------- | -------------------- | -------------------- |
| Fundo             | branco `#FFFFFF`     | preto `#000000`      |
| Superfície        | `#FFFFFF`            | `#121212`            |
| Texto             | preto `#0D0D0D`      | branco `#FAFAFA`     |
| Marca             | laranja `#FF6A00`    | laranja `#FF6A00`    |
| Texto sobre marca | `#0F0F0F`            | `#0F0F0F`            |

**Por que texto escuro sobre o laranja:** branco sobre `#FF6A00` dá 2,87:1 e reprova
no WCAG AA. Preto sobre o mesmo laranja dá **6,9:1** — passa AA e AAA, e mantém o
laranja idêntico nos dois temas.

Para laranja usado **como texto**, o token muda por tema: `#C2410C` no claro (5,2:1
sobre branco) e `#FF8A2B` no escuro. É isso que o token `--brand-text` resolve.

### Cores de gráfico

Três séries categóricas, validadas para daltonismo com o validador de paleta
(banda de luminosidade, piso de croma, separação CVD e contraste contra a
superfície de cada tema):

| Série | Light     | Dark      |
| ----- | --------- | --------- |
| 1     | `#EA580C` | `#EA580C` |
| 2     | `#0D9488` | `#0D9488` |
| 3     | `#7C3AED` | `#8B5CF6` |

Regras seguidas nos gráficos: nenhum gráfico de eixo duplo (adesão e intervenções
da IA ficam em painéis irmãos), barras sempre ancoradas no zero, identidade nunca
só na cor (legenda + rótulo direto), e uma tabela alternativa aos gráficos em
`/progresso`.

---

## Estrutura

```
app/
  layout.tsx              tema, metadata PWA, fontes
  page.tsx                porta de entrada — roteia por papel
  (auth)/                 entrar, cadastrar, recuperar e nova senha
  auth/                   retornos dos links de e-mail (callback/confirmar)
  offline/                casca offline do service worker
  (shell)/                tudo que usa o shell de navegação
    (paciente)/           área do cliente — requirePatient()
      inicio/             painel do dia
      nutricao/           cardápio + substituições
      treino/             ficha da semana
      treino/sessao/      execução com cronômetro e registro de carga
      progresso/          peso, adesão e marcadores de sangue
      checkin/            check-in semanal em 3 etapas
      mensagens/          conversa com o profissional
      perfil/             conta, tema e instalação do app
    pro/                  área administrativa — requireProfessional()
      pacientes/[id]      CRM e prontuário
      revisao/[id]        decisão clínica sobre a proposta da IA
      protocolos/         moldes que alimentam a IA
      financeiro/         MRR, mix de planos e transações
      config/             autonomia da IA e dados da clínica

components/
  ui/                     Card, Button, Badge, Sheet, Tabs, Switch…
  charts/                 LineChart, BarChart, StackedBar, Ring, Sparkline
  layout/                 shell, tab bar, sidebar, marca, tela de setup
  features/               telas com estado

lib/
  supabase/               clientes, tipos do banco e guardas de sessão
  queries/                leitura (server-only)
  actions/                escrita (Server Actions)
  theme.tsx               provider de tema + script anti-flash
  nav.ts                  navegação por perfil
  utils.ts                cn(), datas e formatação pt-BR

supabase/
  migrations/             schema, RLS e funções
  seed.sql                dados de demonstração
```

As duas áreas são isoladas por rota **e** por RLS. A tela do cliente não tem
nenhum link para a administrativa.

---

## Decisões de mobile

- **Tab bar inferior** com área segura do iOS (`env(safe-area-inset-bottom)`);
  a sidebar só aparece a partir de `lg`.
- **Alvos de toque de 44px** em todos os botões e linhas de lista.
- **Bottom sheets** no lugar de modais; viram diálogo centralizado no desktop.
- **Fila de chips com rolagem horizontal** no lugar de `<select>` nativo.
- **Tabelas viram cards** abaixo de `lg` (pacientes, transações).
- **Inputs com 16px** no mobile — abaixo disso o iOS dá zoom ao focar.
- **`viewport-fit=cover`** + `100dvh` para o notch e a barra dinâmica do Safari.
- **Tema aplicado antes da primeira pintura** por script inline: sem flash branco
  para quem usa dark mode.

## PWA

`public/manifest.webmanifest` + `public/sw.js` deixam o app instalável nos dois
sistemas:

- **Android/Chrome:** menu → *Instalar app*.
- **iOS/Safari:** Compartilhar → *Adicionar à Tela de Início*.

O service worker faz rede-primeiro nas navegações (com casca offline de reserva)
e cache-primeiro nos estáticos com hash. **Nenhum dado clínico é gravado em cache.**

Os ícones são gerados por `scripts/generate-icons.mjs` — um encoder PNG em Node
puro, sem dependências. Rode `npm run icons` depois de mudar a marca.

---

## Origem

O layout de referência original está preservado, fora do build, em
`reference/lumina_health.reference.tsx`.
