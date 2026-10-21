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
- **Migração Firebase** (concluída): backend trocado de Supabase (Postgres +
  RLS) para Firebase (Firestore + Authentication), preservando as mesmas
  garantias de segurança e integridade — ver "Por que Firebase" abaixo.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Firebase** — Firestore (banco) + Authentication
- PWA (instalável na tela de início do iPhone)

## Por que Firebase: Admin SDK só no servidor, nunca Security Rules "RLS-like"

Autorização nunca é decidida pelo frontend. Em vez de tentar recriar Row
Level Security dentro de Firestore Security Rules (caminho frágil para
validações procedurais como "a categoria bate com o tipo do lançamento" ou
"atualizar o saldo devedor atomicamente"), este app usa um modelo mais
simples e igualmente seguro:

- **Firestore Security Rules negam tudo** (`allow read, write: if false`) em
  toda coleção, exceto leitura do catálogo global de categorias. Nenhum
  cliente (navegador) jamais lê ou escreve uma coleção de dados diretamente.
- **Todo acesso a dados passa pelo Firebase Admin SDK**, rodando só no
  servidor Next.js (Server Components, Server Actions e dois Route Handlers
  de autenticação) — exatamente como, no modelo anterior, o navegador só
  falava com o Supabase Auth e nunca consultava uma tabela direto.
- Cada Server Action/Server Component relê a sessão
  (`requireCurrentUser()`) e o perfil (`profiles/{uid}`) a cada chamada — o
  `householdId`/`role` nunca vêm de algo que o cliente enviou.

## Modelo de dados

Coleções no Firestore (ver `src/types/firestore.ts` para os tipos completos):

- **`profiles/{uid}`** — um documento por usuário do Firebase Auth, sempre
  no máximo 2 por família (`spouseSlot` 1 ou 2), com nome, avatar e papel
  (`OWNER`/`MEMBER`). Chave = uid, para achar a família de qualquer usuário
  autenticado sem precisar saber o `householdId` antes.
- **`households/{householdId}`** — a família (o casal), com `inviteCode`
  para o segundo cônjuge entrar.
- **`categoryGroups/{id}` / `categories/{id}`** — catálogo global (não por
  família, é só uma taxonomia compartilhada), somente leitura, seedado uma
  vez via `scripts/seed-categories.ts` (IDs determinísticos — rodar de novo
  é seguro, nunca duplica).
- Dentro de **`households/{householdId}/...`**, uma subcoleção por domínio:
  `accounts`, `creditCards`, `investments`, `investmentMovements`, `loans`,
  `loanPayments`, `recurringTransactions`, `transactions`, `transfers`,
  `cardPayments`, `classificationRules`, `importBatches`,
  `importStagedTransactions`.
- **Dinheiro sempre em `number` inteiro de centavos** — nunca ponto
  flutuante. A UI formata/parseia BRL (`src/lib/format.ts`), o banco só
  guarda inteiros (mesma garantia do antigo `bigint` do Postgres).
- **`transactions`** (receita/despesa) com `categoryId`, `accountId` *ou*
  `cardId` (nunca os dois), `scope` (`FAMILY`/`SPOUSE_1`/`SPOUSE_2` —
  Casal/Cônjuge 1/Cônjuge 2), parcelamento (`installmentGroupId`/
  `installmentNumber`/`installmentTotal`, um documento por parcela) e
  recorrência (`recurringTransactions` como template;
  `generateDueRecurringTransactions()` em
  `src/lib/firestore/recurringTransactions.ts` materializa as ocorrências
  pendentes de forma idempotente, chamada ao abrir a tela de lançamentos,
  usando uma transação Firestore por template para nunca gerar a mesma
  ocorrência duas vezes mesmo com duas abas abertas ao mesmo tempo).
- **`transfers`** e **`cardPayments`** são coleções **separadas** de
  `transactions` — de propósito: uma transferência entre contas nunca é
  receita/despesa, e pagar a fatura do cartão nunca duplica uma compra que
  já virou despesa quando aconteceu.
- Cada pagamento de empréstimo (`loanPayments`) abate
  `outstandingBalanceCents` do `loans` pai **atomicamente**, via uma
  transação Firestore em `src/lib/firestore/loans.ts` (`createLoanPayment`)
  — a mesma garantia que uma trigger de banco daria, só que em código
  Node em vez de SQL.
- Toda validação de referência (categoria bate com o tipo do lançamento,
  conta/cartão pertence à mesma família e não está arquivado) é checada
  explicitamente no início de cada função de `src/lib/firestore/*.ts` —
  nunca confiando que o cliente mandou um id correto.

### Nada é excluído de verdade

Toda coleção financeira tem `deletedAt`, e nenhuma função em
`src/lib/firestore/*.ts` implementa uma exclusão real — "deletar" é sempre
marcar `deletedAt`, nunca remover o documento. As Security Rules também
negam `delete` em tudo, como reforço. O botão "Excluir" na UI sempre pede
confirmação antes. Um pagamento de empréstimo excluído reverte
automaticamente o saldo devedor (mesma transação Firestore, tratando a
transição de `deletedAt`).

## Importação e classificação inteligente

- **`importBatches`** — um documento por arquivo importado (auditoria: de
  onde veio cada movimentação).
- **`importStagedTransactions`** — a fila de revisão. Uma linha importada
  **nunca** vira `transactions` direto: ela fica em `PENDING`/`SUGGESTED`
  até o usuário confirmar em `/import/review`, e só aí uma transação real é
  criada. Ignorar mantém o documento (`status = 'IGNORED'`) em vez de
  apagá-lo — o histórico da importação nunca desaparece.
- **`classificationRules`** — o "aprendizado": ao confirmar uma
  classificação, o sistema grava (ou atualiza) uma regra ligando o padrão
  normalizado da descrição à categoria e ao responsável escolhidos. Da
  próxima vez que uma descrição parecida aparecer, ela chega já como
  "Sugestão automática" — nunca como "Confirmada" direto, e o usuário
  sempre pode aceitar, trocar ou ignorar. Editar/excluir uma regra só afeta
  sugestões futuras; nada em `transactions` é reescrito.
- **Parsers plugáveis** (`src/lib/import/{csv,ofx,index}.ts`): cada formato
  implementa `StatementParser.canParse`/`parse`; adicionar um novo formato é
  só empurrar mais um parser no array `PARSERS`, sem tocar no resto. Zero
  acoplamento a Firestore/Supabase — pura função de parsing, sobreviveu à
  migração sem mudar uma linha.
- **Normalização** (`src/lib/normalize.ts`): remove acentos, dígitos,
  pontuação e sufixos como LTDA/ME antes de comparar — assim
  "SUPERMERCADO XYZ LTDA 04/09" e "Supermercado XYZ Ltda 05/10" batem com a
  mesma regra.
- **Duplicidade nunca decide sozinha**: cada linha importada é comparada
  (mesma conta/cartão, valor igual, data a até 2 dias de distância, ou
  `externalId` idêntico — o FITID do OFX) contra transações já existentes
  e contra outras importações ainda não revisadas. Uma correspondência só
  acende o aviso "Possível duplicata" na tela de revisão; nada é
  descartado automaticamente.

### Sobre Open Finance (preparação)

Nenhuma coleção de conexão bancária foi criada ainda — por decisão do
produto, adiada para depois de validar bem a base manual/importação com o
casal de verdade (ver `/configuracoes/bancos` no app). Quando a integração
Open Finance chegar, o desenho será: uma coleção guardando **apenas
metadados** (provedor, id da instituição, status) — o token de acesso
emitido pelo agregador (ex. Pluggy/Belvo) deve ficar em um cofre de
segredos dedicado (Secret Manager), nunca em texto puro no Firestore.

## Arquitetura modular

O código já nasceu separado por responsabilidade; essa separação se manteve
na migração para Firebase, trocando só a implementação da camada de dados:

- **UI** (`src/app/**/page.tsx`, `src/components/`) — só apresentação e
  formulários. Nenhuma página monta uma query "de negócio" complexa
  sozinha: ela chama funções de `src/lib/`.
- **Regras de negócio e agregações** (`src/lib/dashboard.ts`,
  `src/lib/import/matching.ts`) — cálculos puros (totais, distribuição por
  categoria/responsável, sugestão de regra, detecção de duplicidade).
  Testáveis isoladamente da UI.
- **Acesso a dados** (`src/lib/firestore/*.ts`) — um módulo por domínio
  (accounts, cards, investments, loans, transactions,
  recurringTransactions, transfers, classificationRules, importBatches,
  categories, households), cada um usando o Firebase Admin SDK
  (`src/lib/firebase/admin.ts`) e reimplementando em TypeScript toda
  validação/transação que antes vivia em triggers SQL.
- **Processamento de importação** (`src/lib/import/{csv,ofx,index}.ts`) —
  isolado da tela: cada formato é um `StatementParser` independente,
  testável sem subir a UI.
- **Classificação automática** (`src/lib/normalize.ts` +
  `src/lib/import/matching.ts` + coleção `classificationRules`) — a lógica
  de "qual regra combina com esta descrição" vive nesses dois arquivos,
  reutilizável tanto no momento da importação quanto numa futura tela de
  reclassificação em lote.
- **Autenticação/autorização** (`src/lib/session.ts`, `src/middleware.ts`,
  `src/lib/firebase/{admin,client}.ts`, `firestore.rules`) — a fonte da
  verdade de "quem pode ver o quê" é sempre o servidor (Admin SDK + sessão
  verificada); Security Rules negam qualquer acesso direto do cliente como
  reforço; o código de UI nunca decide sozinho uma permissão.
- **Vocabulário compartilhado** (`src/lib/labels.ts`) — nomes exibidos
  (Casal/Cônjuge 1/Cônjuge 2, tipos de conta, etc.) vivem num só lugar em
  vez de copiados por componente.

### Navegação

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

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Em **Build → Firestore Database**, crie o banco em **modo de produção**
   (nunca "test mode").
3. Em **Build → Authentication → Sign-in method**, habilite o provedor
   **Email/Password**.
4. Em **Project settings → General → Your apps**, registre um app Web
   (ícone `</>`) e copie o bloco `firebaseConfig`.
5. Em **Project settings → Service accounts**, gere uma chave privada
   (**Generate new private key**) — é a credencial do Admin SDK, nunca deve
   ser commitada.
6. Copie `.env.example` para `.env.local` e preencha com os valores do
   passo 4 (`NEXT_PUBLIC_FIREBASE_*`) e, para rodar localmente, o conteúdo
   do JSON do passo 5 em `FIREBASE_SERVICE_ACCOUNT_KEY` (em produção no
   Firebase App Hosting isso é automático via Application Default
   Credentials, sem precisar dessa variável).
7. `npm install`
8. `npm run seed:categories` — popula o catálogo de categorias (idempotente,
   pode rodar quantas vezes quiser).
9. `firebase deploy --only firestore:rules,firestore:indexes` (requer
   `firebase-tools` instalado e `firebase use <project-id>` apontando para o
   projeto criado no passo 1) para publicar `firestore.rules`.
10. `npm run dev`

## Estrutura do app

- `/register` — criar uma família nova (você vira o "titular") ou entrar
  numa família existente com um código de convite.
- `/login`, `/forgot-password`, `/reset-password` — autenticação e
  recuperação de senha via Firebase Authentication.
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
- `npm run seed:categories` — popula/atualiza o catálogo global de categorias

## Notas

- Next.js está fixado em `14.2.x` (App Router estável, sem as mudanças
  assíncronas de `params`/`cookies()` introduzidas no Next 15+).
- `recharts` já é usado nos gráficos de `/dashboard` e `/relatorios`.
- O middleware (`src/middleware.ts`) verifica a assinatura do cookie de
  sessão do Firebase via `jose` + as chaves públicas do Google, direto no
  runtime Edge — rápido, mas só confirma assinatura/validade/expiração. A
  checagem definitiva (incluindo revogação) acontece em
  `requireCurrentUser()`, no servidor, via Admin SDK, em toda página
  protegida.

## Validação

### Os 16 pontos de teste

| # | Ponto | Status | Onde/como |
|---|---|---|---|
| 1 | Usuário não acessa dados de outra família | ✅ | Toda leitura passa por `requireCurrentUser()` + módulos de `src/lib/firestore/*.ts` escopados por `householdId`; Security Rules negam qualquer acesso direto do cliente |
| 2 | Casal compartilha movimentações corretamente | ✅ | Mesmo `householdId` para os 2 `spouseSlot`; toda query é por família, não por usuário |
| 3 | Gastos individuais aparecem por cônjuge e no consolidado | ✅ | Campo `scope`; `summarizeByScope` soma por responsável, `summarizeTotals` soma tudo |
| 4 | Transferência nunca é receita/despesa | ✅ | Coleção `transfers` própria, sem ligação com `transactions` |
| 5 | Pagamento de fatura não duplica despesa | ✅ | Coleção `cardPayments` própria; a compra já virou despesa quando aconteceu |
| 6 | Importação não duplica transações | ✅ | `possibleDuplicate` sinaliza (conta+valor+data±2 dias, ou FITID exato) — nunca bloqueia nem apaga sozinho, por decisão do produto |
| 7 | Classificações aprendidas funcionam em novas importações | ✅ | `classificationRules` casadas por substring da descrição normalizada, testado no fluxo de `/import/review` |
| 8 | Usuário corrige qualquer sugestão automática | ✅ | Categoria/responsável em `StagedRow` sempre editáveis antes de confirmar; regras editáveis em `/import/rules` |
| 9 | Dashboard calcula receita/despesa/saldo corretamente | ✅ | `summarizeTotals` — soma direta por tipo, sem lógica condicional escondida |
| 10 | Parcelamentos distribuídos corretamente | ✅ | `base = total/n` com resto na última parcela — soma sempre bate com o total |
| 11 | Precisão monetária | ✅ | `number` inteiro de centavos em 100% do schema, nunca ponto flutuante |
| 12 | Nenhum segredo no frontend | ✅ | Só a config pública do Firebase (`NEXT_PUBLIC_FIREBASE_*`, segura por design) chega ao cliente; a credencial do Admin SDK não é referenciada fora de `src/lib/firebase/admin.ts` |
| 13 | Nenhuma credencial bancária armazenada | ✅ | Nenhum campo de senha/token de banco existe no schema |
| 14 | Autorização impede acesso indevido | ✅ | Mesmo ponto 1 — Security Rules deny-all + verificação server-side em toda função de dados |
| 15 | Funciona em diferentes tamanhos de tela | ✅ | Mobile-first fluido (sem larguras fixas), `max-w` progressivo em `md`/`lg` |
| 16 | Estados de loading/erro/vazio/sucesso | ✅ | `(app)/loading.tsx` + `(app)/error.tsx` cobrindo toda a área autenticada; toda lista tem mensagem de vazio; toda ação de escrita redireciona ou mostra confirmação |

**Corrigida ao longo da validação (ainda na versão Postgres, preservada na
migração)**: condição de corrida na geração de recorrências — duas chamadas
concorrentes (ex.: duas abas abertas) podiam gerar a mesma ocorrência
recorrente duas vezes. Na versão Firestore, `generateDueRecurringTransactions()`
usa uma transação por template, que dá a mesma garantia (retry automático
em caso de disputa) sem precisar de nenhum workaround no frontend.

⚠️ **Limite honesto**: nada disso foi validado com um projeto Firebase real
de ponta a ponta neste ambiente — ele não provisiona um projeto Firebase.
`npm run build`/`npm run typecheck` validam tipos e compilação; o
comportamento das Security Rules e das transações em produção precisa ser
testado manualmente com o casal real (crie duas famílias de teste e
confirme que uma nunca vê dados da outra) antes de ir ao ar.

### iPhone e responsividade

- **Tap targets de 44pt**: `Button`, `Input`, `Select` e `Textarea` têm
  `min-h-11` (44px) — o mínimo recomendado pela Apple.
- **Sem zoom indesejado**: campos de formulário usam `text-base` (16px) —
  abaixo disso o Safari no iOS dá zoom automático na página ao focar um
  campo, um bug de UX clássico que evitamos de propósito.
- **Feedback visual imediato**: todo botão principal de formulário usa
  `SubmitButton` (`useFormStatus`), trocando o texto para "Salvando…" e
  desabilitando assim que o toque acontece — nunca fica parado sem reação
  até a navegação terminar. Toque em qualquer botão também dá um leve
  encolhimento (`active:scale-98`) como resposta tátil instantânea.
- **Safe areas**: `viewportFit: 'cover'` + classes `.safe-top`/`.safe-bottom`
  no topo/rodapé, para não colidir com notch/home indicator.
- **Navegação de uma mão**: 5 abas fixas no rodapé (fácil alcance do
  polegar), sem menus escondidos em gestos exóticos.

### Critério de sucesso do MVP

| # | O casal consegue... | Onde |
|---|---|---|
| 1 | Criar a família e acessar com segurança | `/register`, `/login`, Firebase Auth + Admin SDK ponta a ponta |
| 2 | Cadastrar bancos, cartões, investimentos e empréstimos | `/contas` → `/accounts`, `/cards`, `/investments`, `/loans` |
| 3 | Registrar receitas e despesas | `/movimentacoes` → `/transactions` |
| 4 | Identificar cada gasto como casal ou individual | campo `scope` em todo lançamento |
| 5 | Importar um extrato bancário | `/configuracoes` → `/import` (CSV/OFX) |
| 6 | Revisar e classificar rapidamente | `/import/review` (categoria → responsável → confirmar) |
| 7 | Fazer o sistema aprender classificações | `classificationRules`, gerido em `/import/rules` |
| 8 | Visualizar quanto gastou no mês | `/dashboard` (Início) |
| 9 | Entender quais setores consumiram mais | `/relatorios/categorias` |
| 10 | Consultar a evolução dos gastos | `/relatorios/evolucao` |
| 11 | Usar confortavelmente no iPhone | mobile-first, 44pt de tap target, sem zoom no Safari (ver acima) |
| 12 | Ter arquitetura segura e pronta para Open Finance | Security Rules deny-all + Admin SDK, sem credencial bancária, desenho de coleção pronto mas não construído (ver seção acima) |

Todos os 12 critérios têm uma tela/rota concreta hoje; nenhum depende de
funcionalidade futura.
