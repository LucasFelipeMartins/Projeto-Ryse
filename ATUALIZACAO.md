# Atualização da plataforma — o que mudou

Guia de referência do que foi implementado, onde cada peça vive e o que
precisa ser configurado para tudo funcionar em produção.

---

## Configuração necessária

Três blocos novos no `.env`. Nenhum é obrigatório para o app subir — cada
ausência degrada uma função específica com aviso claro na interface, em vez de
quebrar a tela.

### 1. IA (relatórios, dieta, ficha, análise do protocolo)

O SDK da OpenAI fala com qualquer provedor compatível trocando a URL base. A
primeira chave encontrada vence, nesta ordem:

```
AI_API_KEY (+ AI_BASE_URL / AI_MODEL)  →  GROQ_API_KEY  →  OPENROUTER_API_KEY  →  OPENAI_API_KEY
```

Groq e OpenRouter têm camada gratuita sem cartão:

```bash
GROQ_API_KEY=gsk_...
```

Sem nenhuma chave, os painéis de IA aparecem com aviso e o resto da tela
funciona normalmente (`lib/ai/provider.ts`).

### 2. Notificações no celular (Web Push / VAPID)

```bash
npx web-push generate-vapid-keys
```

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:contato@seudominio.com
CRON_SECRET=<valor longo e aleatório>
SUPABASE_SECRET_KEY=sb_secret_...   # só o cron usa; ignora RLS
```

Web Push padrão, sem SDK de terceiro. Funciona no Android, no desktop e no
iOS 16.4+ **quando o app está na tela de início**.

### 3. Banco

Rode `supabase/migrations/20260101000005_plataforma.sql` (ou o
`supabase/setup.sql` regerado, para banco novo).

---

## Mapa das entregas

| # | Entrega | Onde |
|---|---|---|
| 1 | Avatar com upload, preview e fallback | `components/ui/avatar.tsx`, `components/features/avatar-uploader.tsx`, `lib/actions/profile.ts` |
| 2 | Login separado cliente/profissional | `app/(auth)/pro/entrar`, `lib/actions/auth.ts` (`authenticate`), `lib/supabase/middleware.ts` |
| 3 | IA gratuita + contexto estruturado | `lib/ai/provider.ts`, `lib/ai/context.ts` |
| 4 | Protocolo de análise da IA | `components/features/protocolo-ia.tsx`, `lib/actions/ai-protocol.ts`, tabela `ai_protocols` |
| 5 | Faturamento fora da área do profissional | `lib/nav.ts`, `app/(shell)/pro/page.tsx` (rota `/pro/financeiro` removida) |
| 6 | Ausência de profissionais | `components/features/profissionais-view.tsx` (`SemProfissionais`) |
| 7 | Configurações redesenhadas | `components/features/config-view.tsx`, `components/features/perfil-view.tsx` |
| 8 | Hidratação calculada | `lib/hydration.ts`, `lib/queries/patient.ts` (`getHydration`) |
| 9 | Check-in semanal obrigatório | `getCheckinStatus`, função `checkin_pending`, unique `(patient_id, week_start)` |
| 10 | Push notifications | `lib/notifications/push.ts`, `lib/notifications/dispatch.ts`, `app/api/notificacoes/despachar` |
| 11 | Progresso automático | `components/features/live-refresh.tsx` (Realtime) |
| 12 | Dieta e ficha por IA | `lib/ai/generate.ts`, `components/features/ai-panels.tsx` |
| 13/15 | Limites reais no backend | `lib/ai/limits.ts`, índice único `ai_usage_quota_idx` |
| 14 | Relatório de IA por área | `AiReportPanel` em `/nutricao`, `/treino`, `/progresso`, `/documentos` |
| 16 | Menu mobile | `components/layout/app-shell.tsx` (`MobileMenu`), `Drawer` |
| 17 | Onboarding obrigatório | `app/onboarding`, `requirePatient()` |
| 18 | Horário das mensagens | `lib/utils.ts` (`messageClock`, `dayLabel`), `lib/queries/chat.ts` |

---

## Três decisões que valem explicação

### A meta de hidratação não é guardada no banco

`profiles.water_goal_ml` deixou de ser a fonte de verdade. A meta é
**calculada na leitura** por `computeWaterGoal()`, a partir do peso mais
recente em `body_metrics`.

O motivo é simples: um número gravado envelhece. Guardar `2.800 ml` no perfil
significaria que, no dia em que o paciente registrasse um peso novo no
check-in, a meta continuaria a mesma até alguém rodar uma rotina de
sincronização. Calculando na leitura, não existe esse intervalo — e a fórmula
mora num arquivo só, que é o que o requisito pedia.

Quando o profissional prescreve um volume fixo, ele vai para
`water_goal_override_ml`, e aí o valor manual vence. É a exceção explícita.

### O limite da IA é um índice único, não um contador

`ai_usage` tem `unique (profile_id, kind, period_key)`. A Server Action
**reserva** a linha antes de chamar o provedor.

Um `select count(*)` seguido de `insert` deixaria a corrida aberta: duas abas
disparando ao mesmo tempo passariam as duas pela contagem. Com a unicidade, a
segunda esbarra no banco e recebe a mensagem de limite.

O usuário não tem UPDATE nem DELETE nessa tabela — se tivesse, bastaria mexer
em `period_key` para zerar a cota. Concluir e devolver passam por funções
`SECURITY DEFINER`. E falha é **apagada**, não marcada: um status que a
contagem ignora seria exatamente o que alguém tentaria forjar.

### O horário da mensagem é formatado no navegador

O bug era `new Date(iso).toLocaleTimeString()` rodando no **servidor**. Na
Vercel isso é UTC, então uma mensagem enviada às 21:30 em São Paulo chegava
formatada como 00:30 e descia pronta para o cliente.

O timestamp sempre esteve certo no banco (`timestamptz` com `now()`). O que
mudou foi quem traduz: `MessageView` agora carrega o ISO cru, e
`messageClock()` / `dayLabel()` rodam no cliente, onde o fuso de quem lê é
conhecido. Os separadores "Hoje" / "Ontem" comparam a data local, não a
diferença em horas — 23h de ontem continua sendo ontem.

---

## O que a IA vê

`buildPatientContext()` é a única porta pela qual dado de paciente sai para um
provedor externo. Duas regras valem para tudo:

1. **Nada de identificador.** Nome, e-mail, telefone e UUID ficam de fora — o
   modelo não precisa deles para avaliar um hemograma.
2. **Nada de seção vazia.** Sem exames, a seção "exames" não existe no prompt.
   Mandar `[]` convida o modelo a inventar.

O protocolo do profissional é o **teto** do escopo: área desmarcada não é
consultada no banco, mesmo que a tela peça.

---

## Cron

`vercel.json` agenda `/api/notificacoes/despachar` de hora em hora. A rota
gera os lembretes do dia e esvazia a fila. É idempotente — os lembretes
checam o relógio local de cada usuário e o que já foi enfileirado nas últimas
20 horas.

Para cada item vencido a decisão é uma de três: **enviar**, **adiar** (janela
de silêncio) ou **dispensar com motivo** (categoria desligada). Nada some sem
deixar rastro.
