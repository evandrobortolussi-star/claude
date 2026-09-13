# Financeiro Familiar

Controle financeiro para o casal: receitas, despesas, cartões, contas,
investimentos e empréstimos, num app mobile-first pensado para iPhone e web.

Este repositório está sendo construído em etapas.
- **Etapa 1** (concluída): autenticação, estrutura de família (casal) e perfis.
- **Etapa 2** (concluída): núcleo financeiro — contas, cartões, investimentos,
  empréstimos/financiamentos, receitas e despesas (com parcelamento e
  recorrência), transferências e pagamento de fatura.
- **Etapa 3** (concluída): importação de extratos (CSV/OFX), tela de revisão
  e classificação com aprendizado de regras por estabelecimento.
- **Etapa 4** (concluída): dashboard mensal — resumo, gastos por
  responsável/categoria, evolução, ranking de maiores despesas, filtros e
  indicadores de vencimento/sem-categoria.
- **Etapa 5** (concluída): navegação principal em 5 seções (Início,
  Movimentações, Contas, Relatórios, Configurações), separação mais clara
  entre UI/regras de negócio/acesso a dados, e auditoria de segurança —
  Open Finance continua adiado por decisão do produto (ver abaixo).

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

## Importação e classificação inteligente (Etapa 3)

`supabase/migrations/0004_import_and_rules.sql` adiciona:

- **`import_batches`** — um registro por arquivo importado (auditoria: de
  onde veio cada movimentação).
- **`import_staged_transactions`** — a fila de revisão. Uma linha importada
  **nunca** vira `transactions` direto: ela fica em `PENDING`/`SUGGESTED`
  até o usuário confirmar em `/import/review`, e só aí uma transação real é
  criada. Ignorar mantém a linha (`status = 'IGNORED'`) em vez de apagá-la —
  o histórico da importação nunca desaparece.
- **`classification_rules`** — o "aprendizado": ao confirmar uma
  classificação, o sistema grava (ou atualiza) uma regra ligando o padrão
  normalizado da descrição à categoria e ao responsável escolhidos. Da
  próxima vez que uma descrição parecida aparecer, ela chega já como
  "Sugestão automática" — nunca como "Confirmada" direto, e o usuário
  sempre pode aceitar, trocar ou ignorar. Editar/excluir uma regra só afeta
  sugestões futuras; nada em `transactions` é reescrito.
- **Parsers plugáveis** (`src/lib/import/{csv,ofx,index}.ts`): cada formato
  implementa `StatementParser.canParse`/`parse`; adicionar um novo formato é
  só empurrar mais um parser no array `PARSERS`, sem tocar no resto.
- **Normalização** (`src/lib/normalize.ts`): remove acentos, dígitos,
  pontuação e sufixos como LTDA/ME antes de comparar — assim
  "SUPERMERCADO XYZ LTDA 04/09" e "Supermercado XYZ Ltda 05/10" batem com a
  mesma regra.
- **Duplicidade nunca decide sozinha**: cada linha importada é comparada
  (mesma conta/cartão, valor igual, data a até 2 dias de distância, ou
  `external_id` idêntico — o FITID do OFX) contra transações já existentes
  e contra outras importações ainda não revisadas. Uma correspondência só
  acende o aviso "Possível duplicata" na tela de revisão; nada é
  descartado automaticamente.

### Sobre Open Finance (preparação)

Nenhuma tabela de conexão bancária foi criada ainda — por decisão do
produto, adiada para depois de validar bem a base manual/importação com o
casal de verdade (ver `/configuracoes/bancos` no app). Quando a integração
Open Finance chegar, o desenho será: uma tabela `open_finance_connections`
guardando **apenas metadados** (provedor, id da instituição, status) — o
token de acesso emitido pelo agregador (ex. Pluggy/Belvo) deve ficar em um
cofre de segredos dedicado (ou no próprio provedor), nunca em texto puro
nesta base de dados.

## Arquitetura modular (Etapa 5)

O código já nasceu separado por responsabilidade; esta etapa reforçou e
documentou essa separação:

- **UI** (`src/app/**/page.tsx`, `src/components/`) — só apresentação e
  formulários. Nenhuma página monta uma query SQL "de negócio" complexa
  sozinha: ela chama funções de `src/lib/`.
- **Regras de negócio e agregações** (`src/lib/dashboard.ts`,
  `src/lib/import/matching.ts`) — cálculos puros (totais, distribuição por
  categoria/responsável, sugestão de regra, detecção de duplicidade) que
  recebem dados já buscados e não sabem nada de React ou Supabase além do
  tipo do cliente. Testáveis isoladamente da UI.
- **Acesso a dados** — Server Actions (`actions.ts` em cada rota) e
  `src/lib/supabase/{client,server}.ts`. Sempre o cliente com a chave anon +
  sessão do usuário — nunca a service role — para que a autorização real
  aconteça no Postgres (RLS), não no código do servidor Next.js.
- **Processamento de importação** (`src/lib/import/{csv,ofx,index}.ts`) —
  isolado da tela: cada formato é um `StatementParser` independente,
  testável sem subir a UI.
- **Classificação automática** (`src/lib/normalize.ts` +
  `src/lib/import/matching.ts` + tabela `classification_rules`) — a lógica
  de "qual regra combina com esta descrição" vive nesses dois arquivos,
  reutilizável tanto no momento da importação quanto numa futura tela de
  reclassificação em lote.
- **Autenticação/autorização** (`src/lib/session.ts`, `src/middleware.ts`,
  `supabase/migrations/*.sql`) — a fonte da verdade de "quem pode ver o
  quê" é sempre o banco (RLS); o código do app só lê a sessão, nunca decide
  sozinho uma permissão.
- **Vocabulário compartilhado** (`src/lib/labels.ts`) — nomes exibidos
  (Casal/Cônjuge 1/Cônjuge 2, tipos de conta, etc.) vivem num só lugar em
  vez de copiados por componente.

### Navegação (Etapa 5)

Cinco seções fixas na navegação inferior, cada uma com uma página "hub"
listando seus subitens (padrão comum em apps mobile quando uma aba tem
mais de um destino):

| Seção | Rota | Subitens |
|---|---|---|
| Início | `/dashboard` | resumo rápido do mês |
| Movimentações | `/movimentacoes` | Todas, Pendentes de classificação, Receitas, Despesas |
| Contas | `/contas` | Bancos, Cartões, Investimentos, Empréstimos, Transferências |
| Relatórios | `/relatorios` | Evolução mensal, Categorias, Casal x individuais |
| Configurações | `/configuracoes` | Perfil, Casal, Categorias, Regras automáticas, Importações, Bancos conectados, Segurança |

As rotas de CRUD já existentes (`/accounts`, `/transactions`, `/profile`
etc.) não mudaram de endereço — os hubs só organizam o caminho até elas.
O componente `BottomNav` decide qual aba fica destacada pelo prefixo de
rota mais específico que casa com a URL atual (ex.: `/import/review`
pertence a Movimentações, mas `/import` e `/import/rules` pertencem a
Configurações, mesmo compartilhando o prefixo `/import`).

### Preparação para iOS nativo

A UI é HTML/CSS/JS padrão (sem APIs exclusivas de navegador incomuns),
então uma futura versão iOS via Capacitor ou WebView é viável sem reescrever
a lógica de negócio — ela já está isolada em `src/lib/`. Isso não foi
implementado nesta etapa; é só uma restrição que guiou as decisões (evitar
acoplar regras financeiras a componentes React específicos).

## Configurando o projeto

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode as migrations em ordem —
   `0001_init.sql`, `0002_finance_core.sql`, `0003_seed_categories.sql`,
   `0004_import_and_rules.sql`, `0005_fix_recurring_race_condition.sql`
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
- `/dashboard` (Início) — resumo rápido do mês: recebido/gasto/saldo,
  gastos por Casal/Cônjuge 1/Cônjuge 2 (toque para filtrar), avisos de
  fatura/parcela vencendo em até 7 dias e de despesas sem categoria, com
  link para os relatórios completos.
- `/movimentacoes` (Movimentações) — Todas (`/transactions`, com categoria
  agrupada, responsável, parcelamento e recorrência; editar sempre permite
  corrigir a categoria), Pendentes de classificação (`/import/review`),
  Receitas e Despesas (`/transactions?type=...`).
- `/contas` (Contas) — Bancos (`/accounts`), Cartões (`/cards`, com fatura
  em `/cards/[id]`), Investimentos (`/investments`, aportes/resgates em
  `/investments/[id]`), Empréstimos (`/loans`, pagamentos em `/loans/[id]`),
  Transferências (`/transfers`).
- `/relatorios` (Relatórios) — Evolução mensal (`/relatorios/evolucao`),
  Categorias (`/relatorios/categorias`: gráfico, lista "Onde gastamos
  nosso dinheiro?" e ranking das maiores despesas), Casal x individuais
  (`/relatorios/responsaveis`: comparativo do mês + tendência de 6 meses).
- `/configuracoes` (Configurações) — Perfil (`/profile`), Casal
  (`/configuracoes/casal`: membros, convite, renomear família), Categorias
  (`/configuracoes/categorias`, catálogo somente leitura), Regras
  automáticas (`/import/rules`), Importações (`/import`, upload de
  CSV/OFX), Bancos conectados (`/configuracoes/bancos`, placeholder
  explicando que Open Finance é uma etapa futura), Segurança
  (`/configuracoes/seguranca`: o que é garantido + trocar senha).

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
- `recharts` já é usado nos gráficos de `/dashboard` e `/relatorios`.

## Validação (checklist da Etapa 5)

Revisado nesta etapa antes de considerá-la concluída:

- ✅ RLS habilitado e com política em **todas** as 17 tabelas de dados do
  household + as 2 do catálogo global (conferido lendo as 5 migrations).
- ✅ Nenhuma chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) é referenciada em
  código de app (`src/`); nenhum campo de senha/credencial bancária existe
  no schema.
- ✅ Transferência e pagamento de fatura são tabelas próprias — nunca viram
  linha em `transactions`.
- ✅ Dinheiro em `bigint` centavos em todo o schema; parcelamento distribui
  o total exato (resto vai para a última parcela).
- 🔧 **Corrigida nesta etapa**: condição de corrida em
  `generate_due_recurring_transactions` — duas chamadas concorrentes (ex.:
  duas abas abertas) podiam gerar a mesma ocorrência recorrente duas vezes.
  Corrigida travando a linha (`FOR UPDATE`) na origem, não com um workaround
  no frontend (`0005_fix_recurring_race_condition.sql`).
- ✅ Estados de carregamento e erro agora cobrem toda a área autenticada
  (`(app)/loading.tsx`, `(app)/error.tsx`, com versões específicas em
  `/dashboard`), além dos estados vazios que cada lista já tinha.
- ⚠️ Ainda não validado com um banco Supabase real de ponta a ponta (este
  ambiente não provisiona um projeto Supabase) — o `npm run build` valida
  tipos e compilação, mas o comportamento do RLS/triggers em produção deve
  ser testado manualmente com o casal real antes de ir ao ar, seguindo os
  16 pontos desta checklist.
