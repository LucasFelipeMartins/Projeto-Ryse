# Backend do Ryse — Supabase

Postgres + Auth + Row Level Security. Não há servidor próprio: o Next.js fala
direto com o Supabase, e a autorização mora no banco.

---

## Configuração em 4 passos

1. **Crie o projeto** em [supabase.com/dashboard](https://supabase.com/dashboard)
   (região São Paulo dá a menor latência no Brasil).

2. **Rode as migrations** no SQL Editor, nesta ordem:

   ```
   supabase/migrations/20260101000000_schema.sql     tabelas, enums, helpers
   supabase/migrations/20260101000001_rls.sql        políticas de acesso
   supabase/migrations/20260101000002_functions.sql  triggers e RPCs
   ```

3. **Copie as chaves** em *Project Settings › API* para o `.env.local`
   (duplique o `.env.example`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

4. **Configure as URLs de retorno** em *Authentication › URL Configuration*:

   - Site URL: `http://localhost:3000` (e o domínio da Vercel em produção)
   - Redirect URLs: `http://localhost:3000/auth/callback`,
     `http://localhost:3000/auth/confirmar` e os equivalentes de produção.

Sem as variáveis o app não quebra: ele mostra uma tela com esse passo a passo.

### Dados de exemplo

Crie duas contas pelo `/cadastrar`, ajuste os dois e-mails no topo de
`supabase/seed.sql` e rode o arquivo. Ele promove uma conta a profissional,
vincula a outra como paciente e popula plano, fichas, exames, fila da IA e
faturamento.

---

## Papéis

Só existem dois: `paciente` e `profissional`.

O cadastro público **sempre** nasce como paciente — o trigger
`handle_new_user` grava `'paciente'` fixo, ignorando o que vier do cliente.
Promover alguém a profissional é uma operação manual no banco:

```sql
update profiles set role = 'profissional' where email = 'medico@clinica.com';
```

Vincular um paciente ao profissional:

```sql
update profiles
   set professional_id = (select id from profiles where email = 'medico@clinica.com')
 where email = 'paciente@email.com';
```

Essa aresta `professional_id` é o que todas as políticas de RLS percorrem.

---

## Separação das duas áreas

A tela do cliente não tem nenhum caminho para a área administrativa — nem link,
nem botão, nem alternador de perfil.

O isolamento acontece em duas camadas:

| Camada | Onde | O que faz |
|---|---|---|
| Rota | `app/(shell)/(paciente)/layout.tsx` e `app/(shell)/pro/layout.tsx` | `requirePatient()` / `requireProfessional()` redirecionam quem não pertence |
| Dado | Políticas de RLS | Mesmo com a URL certa, o Postgres não devolve linha alguma |

O middleware só responde "tem sessão?" — o papel é resolvido nos layouts, para
não consultar o banco a cada navegação.

---

## Row Level Security

RLS ligado em **todas** as tabelas. Nenhuma política usa `USING (true)`.

**Leitura de dado clínico:** o próprio paciente, ou o profissional vinculado.
Concentrado no helper `can_read_patient(patient_id)`.

**Escrita** segue a autoria real:

- o paciente registra o que ele faz — hidratação, refeição marcada, série de
  treino, check-in;
- o profissional escreve o que prescreve — planos, refeições, fichas,
  protocolos — e é o único que decide uma revisão da IA.

**A fila da IA não é visível ao paciente enquanto está pendente.** Uma proposta
não decidida não é uma prescrição; só depois de `status <> 'pendente'` ela
aparece para ele.

Os helpers `is_my_patient()`, `can_read_patient()` e `my_professional_id()` são
`SECURITY DEFINER` de propósito: as políticas de `profiles` precisam consultar
`profiles`, e sem isso a política dispararia a si mesma em recursão.

---

## Tabelas

| Grupo | Tabelas |
|---|---|
| Identidade | `profiles`, `notification_prefs` |
| Métricas | `body_metrics`, `hydration_logs`, `checkins` |
| Nutrição | `nutrition_plans`, `meals`, `meal_items`, `meal_logs` |
| Treino | `workout_plans`, `workouts`, `exercises`, `workout_sessions`, `set_logs` |
| Exames | `exams`, `exam_markers` |
| Inteligência | `ai_reviews`, `protocols` |
| Mensagens | `conversations`, `messages` |
| Financeiro | `subscriptions`, `transactions` |

### Hidratação

`hydration_logs` guarda **um registro por ingestão, com o volume exato em ml**
informado pelo paciente. Não existe incremento fixo — copo, garrafa e squeeze
têm capacidades diferentes. O total do dia é somado na leitura, e a meta diária
fica em `profiles.water_goal_ml`.

---

## Funções e triggers

| Nome | Papel |
|---|---|
| `handle_new_user()` | Cria o perfil no cadastro, sempre como paciente |
| `sync_profile_email()` | Mantém o e-mail do perfil igual ao do auth |
| `bump_conversation()` | Atualiza `last_message_at` a cada mensagem |
| `stamp_review_decision()` | Carimba quem decidiu a revisão e quando |
| `hydration_total_ml()` | Soma em ml de um dia |
| `weekly_adherence()` | Refeições marcadas sobre prescritas, por semana |
| `ensure_conversation()` | Abre (ou reaproveita) a conversa paciente ↔ profissional |

O carimbo da decisão clínica é feito por trigger, e não pelo cliente — assim o
prontuário não depende de o front enviar a informação certa.

---

## Camadas no código

```
lib/supabase/
  client.ts       cliente do navegador
  server.ts       cliente de servidor + requireUser/requirePatient/requireProfessional
  middleware.ts   renovação de sessão e gate de autenticação
  types.ts        tipos do banco (regenere com `supabase gen types`)
  env.ts          leitura das variáveis com erro legível

lib/queries/      leitura (server-only)
lib/actions/      escrita (Server Actions)
```

`getSessionUser()` usa `getUser()`, que valida o JWT no servidor de auth —
`getSession()` apenas lê o cookie e não serve para decidir autorização.

As consultas vivem em arquivos `server-only`: se algum componente de cliente
tentar importá-las, o build falha em vez de vazar credencial.

---

## Deploy na Vercel

Em *Settings › Environment Variables*, defina as três variáveis do
`.env.example` — com `NEXT_PUBLIC_SITE_URL` apontando para o domínio de
produção, senão os links de recuperação de senha voltam para `localhost`.

Todas as páginas autenticadas são dinâmicas (leem cookies), então o build não
precisa das variáveis para passar.
