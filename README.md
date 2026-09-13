# Financeiro Familiar

Controle financeiro para o casal: receitas, despesas, cartões, contas,
investimentos e empréstimos, num app mobile-first pensado para iPhone e web.

Este repositório está sendo construído em etapas.
- **Etapa 1** (concluída): autenticação, estrutura de família (casal) e perfis.
- **Etapa 2** (concluída): núcleo financeiro — contas, cartões, investimentos,
  empréstimos/financiamentos, receitas e despesas (com parcelamento e
  recorrência), transferências e pagamento de fatura.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Supabase** — Postgres + Auth + Row Level Security (RLS)
- PWA (instalável na tela de início do iPhone)

## Por que Supabase Auth + RLS

Autorização nunca é decidida apenas no frontend. Toda regra de "quem pode ver
o quê" está no banco de dados, como política de RLS — mesmo que exista um bug
no app ou alguém chame a API diretamente, a resposta é filtrada pelo Postgres
com base no usuário autenticado (`auth.uid()`), não em nada que o cliente
enviou.

## Modelo de dados (Etapa 1)

`supabase/migrations/0001_init.sql` cria:

- **`households`** — a família (o casal). Tem `invite_code` para o segundo
  cônjuge entrar.
- **`profiles`** — um registro por usuário (`auth.users`), sempre no máximo 2
  por família (`spouse_slot` 1 ou 2), com nome, avatar e papel
  (`OWNER`/`MEMBER`).
- **`expense_scope`** (enum `FAMILY` / `SPOUSE_1` / `SPOUSE_2`) — a
  classificação de despesas como familiar ou individual de cada cônjuge,
  criada agora para ser usada pela tabela de lançamentos de uma próxima
  etapa.
- Uma trigger `handle_new_user()` (SECURITY DEFINER) que roda no cadastro:
  lê `mode` (`create`/`join`) dos metadados passados a `supabase.auth.signUp`
  e cria a família + perfil, ou entra numa família existente pelo
  `invite_code`. Isso significa que a criação de família nunca é feita por
  código do cliente — é sempre a mesma transação atômica do cadastro.

### Segurança aplicada nesta etapa

- **RLS habilitado em todas as tabelas.** Um usuário só enxerga linhas da
  própria família, via as funções auxiliares `is_household_member()` /
  `is_household_owner()` (que leem `auth.uid()`).
- **Sem grant de INSERT/DELETE** para o papel `authenticated` em
  `households`/`profiles` — essas linhas só existem através da trigger de
  cadastro. Um usuário não consegue fabricar uma família ou se anexar a
  outra por conta própria.
- **Grants por coluna**: mesmo dentro da própria linha, um usuário só pode
  dar `UPDATE` em `profiles (full_name, avatar_emoji)` e em
  `households (name)` — não pode mudar `household_id`, `spouse_slot`,
  `role`, etc., mesmo que tente manipular a chamada.
- **Nunca armazenamos senha ou token de banco.** Não existe nenhuma coluna
  para isso no schema atual.
- **`created_at`/`updated_at`** em todos os registros (trigger genérica
  `set_updated_at()`).
- Middleware do Next.js chama `supabase.auth.getUser()` (não apenas lê o
  cookie) a cada requisição, o que valida o JWT contra o servidor do
  Supabase antes de liberar qualquer rota protegida.

## Modelo de dados (Etapa 2)

`supabase/migrations/0002_finance_core.sql` (schema) e `0003_seed_categories.sql`
(categorias iniciais) criam o núcleo financeiro:

- **Dinheiro sempre em `bigint` centavos** — nunca `numeric`/ponto flutuante.
  A UI formata/parseia BRL (`src/lib/format.ts`), mas o banco só guarda
  inteiros.
- **`accounts`** (corrente/poupança/dinheiro), **`credit_cards`** (limite,
  fechamento, vencimento), **`investments`** + **`investment_movements`**
  (saldo é sempre a soma dos aportes/resgates, nunca um valor em cache) e
  **`loans`** (empréstimo/financiamento) + **`loan_payments`** — cada
  pagamento abate `outstanding_balance_cents` via trigger
  (`apply_loan_payment`), e o `UPDATE` grant do cliente em `loans`
  explicitamente **não inclui** essa coluna: só um pagamento pode mudar o
  saldo devedor.
- **`transactions`** (receita/despesa) com `category_id`, `account_id`
  *ou* `card_id` (nunca os dois), `scope` (`FAMILY`/`SPOUSE_1`/`SPOUSE_2` —
  Casal/Cônjuge 1/Cônjuge 2), e suporte a parcelamento
  (`installment_group_id`/`installment_number`/`installment_total`, uma
  linha por parcela, cada uma na sua data) e recorrência
  (`recurring_transactions` como template; a RPC
  `generate_due_recurring_transactions` materializa as ocorrências
  pendentes de forma idempotente, chamada ao abrir a tela de lançamentos).
- **`transfers`** e **`card_payments`** são tabelas **separadas** de
  `transactions` — de propósito: uma transferência entre contas nunca é
  receita/despesa, e pagar a fatura do cartão nunca duplica uma compra que
  já virou despesa quando aconteceu.
- **`category_groups`/`categories`**: catálogo global (não por família,
  já que é apenas uma taxonomia compartilhada), somente leitura para
  `authenticated` — exatamente os grupos/categorias do produto, sem inflar
  a lista.
- Um trigger (`validate_transaction_row` e equivalentes para
  transferências/pagamentos/movimentos) confere no banco que
  conta/cartão/categoria pertencem à mesma família **antes** de gravar —
  nunca confiando que o cliente mandou um id correto.

### Nada é excluído de verdade

Toda tabela financeira tem `deleted_at`, e **não existe `GRANT DELETE`** para
`authenticated` em nenhuma delas — o botão "Excluir" na UI sempre pede
confirmação e faz um `UPDATE` marcando `deleted_at`, nunca um `DELETE` real.
Um pagamento de empréstimo excluído reverte automaticamente o saldo devedor
(mesmo trigger, tratando a transição de `deleted_at`).

### Sobre Open Finance (preparação)

Nenhuma tabela de conexão bancária foi criada ainda. Quando a integração
Open Finance chegar, o desenho será: uma tabela `open_finance_connections`
guardando **apenas metadados** (provedor, id da instituição, status) — o
token de acesso emitido pelo agregador (ex. Pluggy/Belvo) deve ficar em um
cofre de segredos dedicado (ou no próprio provedor), nunca em texto puro
nesta base de dados.

## Configurando o projeto

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode as migrations em ordem —
   `0001_init.sql`, `0002_finance_core.sql`, `0003_seed_categories.sql`
   (ou use a CLI do Supabase: `supabase db push`).
3. Em **Authentication → Providers → Email**, decida se quer exigir
   confirmação de email (recomendado em produção; pode desativar em
   desenvolvimento para testar mais rápido).
4. Em **Project Settings → API**, copie a URL e a `anon` key.
5. Copie `.env.example` para `.env.local` e preencha:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
6. `npm install`
7. `npm run dev`

## Estrutura do app

- `/register` — criar uma família nova (você vira o "titular") ou entrar
  numa família existente com um código de convite.
- `/login`, `/forgot-password`, `/reset-password` — autenticação e
  recuperação de senha via Supabase Auth.
- `/profile` — editar seu nome/avatar, ver o código de convite da família,
  ver o outro cônjuge, renomear a família (titular), e links para gerenciar
  contas/cartões/empréstimos/transferências.
- `/accounts`, `/cards` (com detalhe de fatura em `/cards/[id]`),
  `/investments` (com aportes/resgates em `/investments/[id]`), `/loans`
  (com pagamentos em `/loans/[id]`), `/transfers` — cadastro do núcleo
  financeiro (Etapa 2).
- `/transactions` — receitas e despesas do mês, com categoria agrupada,
  responsável (Casal/Cônjuge 1/Cônjuge 2), parcelamento e recorrência;
  editar sempre permite corrigir a categoria.
- `/dashboard`, `/import` — ainda "em breve": resumo visual e importação de
  extrato ficam para as próximas etapas.

## Scripts

- `npm run dev` — ambiente de desenvolvimento
- `npm run build` / `npm run start` — build e execução em produção
- `npm run typecheck` — checagem de tipos
- `npm run lint` — lint do Next.js

## Notas

- Next.js está fixado em `14.2.x` (App Router estável, sem as mudanças
  assíncronas de `params`/`cookies()` introduzidas no Next 15+). O
  `npm audit` acusa CVEs do Next.js/PostCSS que afetam principalmente
  recursos não usados aqui (otimização de imagem, servidor customizado,
  i18n); vale reavaliar ao planejar produção.
- `recharts` já está instalado para os gráficos do dashboard de uma próxima
  etapa.
