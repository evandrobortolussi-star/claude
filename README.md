# Financeiro Familiar

Controle financeiro para o casal: receitas, despesas, cartões, contas,
investimentos e empréstimos, num app mobile-first pensado para iPhone e web.

Este repositório está sendo construído em etapas. **Etapa 1** (concluída):
autenticação, estrutura de família (casal) e perfis.

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

### Sobre Open Finance (preparação)

Nenhuma tabela de conexão bancária foi criada ainda. Quando a integração
Open Finance chegar, o desenho será: uma tabela `open_finance_connections`
guardando **apenas metadados** (provedor, id da instituição, status) — o
token de acesso emitido pelo agregador (ex. Pluggy/Belvo) deve ficar em um
cofre de segredos dedicado (ou no próprio provedor), nunca em texto puro
nesta base de dados.

## Configurando o projeto

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode o conteúdo de `supabase/migrations/0001_init.sql`
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

## Estrutura do app (Etapa 1)

- `/register` — criar uma família nova (você vira o "titular") ou entrar
  numa família existente com um código de convite.
- `/login`, `/forgot-password`, `/reset-password` — autenticação e
  recuperação de senha via Supabase Auth.
- `/profile` — editar seu nome/avatar, ver o código de convite da família,
  ver o outro cônjuge, e (se você for o titular) renomear a família.
- `/dashboard`, `/transactions`, `/import`, `/investments` — navegação
  inferior já implementada (mobile-first, pensada para iPhone); o conteúdo
  chega nas próximas etapas.

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
