-- Financeiro Familiar — Etapa 2: núcleo financeiro
--
-- Design decisions called out by the spec:
--   * All money columns are `bigint` cents — never `numeric`/`float` doing
--     fractional math, and never floating point at all.
--   * Transfers between accounts, card invoice payments, investment
--     contributions/redemptions and loan payments are their OWN tables, not
--     rows in `transactions` — so a transfer can never be mistaken for
--     income/expense, and paying a card invoice never double-counts a
--     purchase that was already recorded as an expense.
--   * Nothing is ever hard-deleted from the app: every financial table has a
--     `deleted_at` column and there is no DELETE grant for `authenticated`
--     at all — "deleting" is a protected, reversible UPDATE.
--   * RLS is enabled on every table, including the read-only category
--     catalog.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.account_type as enum ('CHECKING', 'SAVINGS', 'CASH');
create type public.transaction_type as enum ('INCOME', 'EXPENSE');
create type public.investment_type as enum ('RENDA_FIXA', 'RENDA_VARIAVEL', 'FUNDO', 'PREVIDENCIA', 'CRIPTO', 'OUTRO');
create type public.investment_movement_type as enum ('CONTRIBUTION', 'REDEMPTION');
create type public.loan_kind as enum ('LOAN', 'FINANCING');

-- ---------------------------------------------------------------------------
-- Category catalog (global reference data, not household-scoped: it's a
-- shared taxonomy, not financial or personal data. Read-only for clients —
-- changed only through migrations).
-- ---------------------------------------------------------------------------

create table public.category_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.transaction_type not null,
  sort_order smallint not null default 0
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.category_groups (id) on delete cascade,
  name text not null,
  kind public.transaction_type not null,
  sort_order smallint not null default 0,
  unique (group_id, name)
);

create index categories_group_id_idx on public.categories (group_id);
create index categories_kind_idx on public.categories (kind);

-- ---------------------------------------------------------------------------
-- Accounts, cards
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type public.account_type not null,
  institution text,
  opening_balance_cents bigint not null default 0,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_household_id_idx on public.accounts (household_id) where deleted_at is null;

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  brand text,
  limit_cents bigint check (limit_cents is null or limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_cards_household_id_idx on public.credit_cards (household_id) where deleted_at is null;

-- Given a card purchase date and the card's closing day, which invoice
-- (identified by its first-of-month) it belongs to. Lets installments and
-- purchases be related to "the March invoice" etc. without a separate
-- invoices table.
create or replace function public.card_invoice_month(p_occurred_on date, p_closing_day smallint)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_occurred_on)::int > p_closing_day
      then (date_trunc('month', p_occurred_on) + interval '1 month')::date
    else date_trunc('month', p_occurred_on)::date
  end;
$$;

-- ---------------------------------------------------------------------------
-- Investments
-- ---------------------------------------------------------------------------

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  type public.investment_type not null default 'OUTRO',
  institution text,
  linked_account_id uuid references public.accounts (id) on delete set null,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_household_id_idx on public.investments (household_id) where deleted_at is null;

-- Balance is derived (sum of contributions minus redemptions), never cached,
-- so it can never drift from its movements.
create table public.investment_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  investment_id uuid not null references public.investments (id) on delete cascade,
  type public.investment_movement_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  account_id uuid references public.accounts (id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investment_movements_investment_id_idx on public.investment_movements (investment_id) where deleted_at is null;
create index investment_movements_household_id_idx on public.investment_movements (household_id);

-- ---------------------------------------------------------------------------
-- Loans & financing
-- ---------------------------------------------------------------------------

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.loan_kind not null,
  name text not null check (char_length(trim(name)) > 0),
  institution text,
  contracted_amount_cents bigint not null check (contracted_amount_cents > 0),
  outstanding_balance_cents bigint not null check (outstanding_balance_cents >= 0),
  installment_amount_cents bigint not null check (installment_amount_cents > 0),
  installments_total smallint not null check (installments_total > 0),
  installments_paid smallint not null default 0 check (installments_paid >= 0),
  interest_rate_monthly numeric(6, 4),
  due_day smallint check (due_day between 1 and 31),
  contracted_on date not null default current_date,
  archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loans_household_id_idx on public.loans (household_id) where deleted_at is null;

-- Every payment reduces outstanding_balance_cents via the trigger below —
-- clients cannot write that column directly (see grants at the bottom).
create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  account_id uuid references public.accounts (id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loan_payments_loan_id_idx on public.loan_payments (loan_id) where deleted_at is null;

create or replace function public.apply_loan_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.loans
    set outstanding_balance_cents = greatest(0, outstanding_balance_cents - new.amount_cents),
        installments_paid = installments_paid + 1
    where id = new.loan_id;
  elsif TG_OP = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    update public.loans
    set outstanding_balance_cents = outstanding_balance_cents + old.amount_cents,
        installments_paid = greatest(0, installments_paid - 1)
    where id = old.loan_id;
  elsif TG_OP = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null then
    update public.loans
    set outstanding_balance_cents = greatest(0, outstanding_balance_cents - new.amount_cents),
        installments_paid = installments_paid + 1
    where id = new.loan_id;
  end if;
  return new;
end;
$$;

create trigger loan_payments_apply
  after insert or update on public.loan_payments
  for each row execute function public.apply_loan_payment();

-- ---------------------------------------------------------------------------
-- Recurring transaction templates (materialized into `transactions` by the
-- generate_due_recurring_transactions() RPC, called opportunistically from
-- the app — see it near the bottom of this file).
-- ---------------------------------------------------------------------------

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type public.transaction_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null check (char_length(trim(description)) > 0),
  category_id uuid references public.categories (id),
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.credit_cards (id) on delete set null,
  scope public.expense_scope not null default 'FAMILY',
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  last_generated_on date,
  active boolean not null default true,
  notes text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_id is null or card_id is null),
  check (end_date is null or end_date >= start_date)
);

create index recurring_transactions_household_id_idx on public.recurring_transactions (household_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Transactions (income & expense only — see file header for why transfers,
-- card payments, investment moves and loan payments live elsewhere).
-- ---------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type public.transaction_type not null,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  description text not null check (char_length(trim(description)) > 0),
  notes text,
  category_id uuid references public.categories (id),
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.credit_cards (id) on delete set null,
  scope public.expense_scope not null default 'FAMILY',
  recurrence_id uuid references public.recurring_transactions (id) on delete set null,
  installment_group_id uuid,
  installment_number smallint,
  installment_total smallint,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_id is null or card_id is null),
  check ((installment_number is null) = (installment_total is null)),
  check (installment_number is null or (installment_number between 1 and installment_total))
);

create index transactions_household_occurred_idx on public.transactions (household_id, occurred_on) where deleted_at is null;
create index transactions_installment_group_idx on public.transactions (installment_group_id) where installment_group_id is not null;
create index transactions_category_idx on public.transactions (category_id);

-- Shared by transactions & recurring_transactions: force created_by
-- server-side and reject a category whose kind doesn't match the
-- transaction's type (a user can always fix a category later, but it must
-- always be a valid income/expense category for that entry's type).
create or replace function public.validate_transaction_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_kind public.transaction_type;
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if new.category_id is not null then
    select kind into v_category_kind from public.categories where id = new.category_id;
    if v_category_kind is null then
      raise exception 'Categoria inválida.';
    end if;
    if v_category_kind <> new.type then
      raise exception 'A categoria não corresponde ao tipo do lançamento.';
    end if;
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta inválida.';
  end if;

  if new.card_id is not null and not exists (
    select 1 from public.credit_cards where id = new.card_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Cartão inválido.';
  end if;

  return new;
end;
$$;

create trigger transactions_validate
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_row();

create trigger recurring_transactions_validate
  before insert or update on public.recurring_transactions
  for each row execute function public.validate_transaction_row();

-- ---------------------------------------------------------------------------
-- Transfers between accounts — never income/expense.
-- ---------------------------------------------------------------------------

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid not null references public.accounts (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  notes text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_account_id <> to_account_id)
);

create index transfers_household_id_idx on public.transfers (household_id) where deleted_at is null;

create or replace function public.validate_transfer_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if not exists (
    select 1 from public.accounts where id = new.from_account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta de origem inválida.';
  end if;

  if not exists (
    select 1 from public.accounts where id = new.to_account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta de destino inválida.';
  end if;

  return new;
end;
$$;

create trigger transfers_validate
  before insert or update on public.transfers
  for each row execute function public.validate_transfer_row();

-- ---------------------------------------------------------------------------
-- Credit card invoice payments — settle a card's invoice from an account.
-- Never a new expense: the expense was already recorded as a transaction
-- when the purchase happened.
-- ---------------------------------------------------------------------------

create table public.card_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  card_id uuid not null references public.credit_cards (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  occurred_on date not null,
  invoice_month date not null,
  notes text,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index card_payments_household_id_idx on public.card_payments (household_id) where deleted_at is null;
create index card_payments_card_id_idx on public.card_payments (card_id);

create or replace function public.validate_card_payment_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if not exists (
    select 1 from public.credit_cards where id = new.card_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Cartão inválido.';
  end if;

  if not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta inválida.';
  end if;

  return new;
end;
$$;

create trigger card_payments_validate
  before insert or update on public.card_payments
  for each row execute function public.validate_card_payment_row();

-- ---------------------------------------------------------------------------
-- Investment / loan payment row validation + created_by (same spirit as
-- validate_transaction_row above).
-- ---------------------------------------------------------------------------

create or replace function public.validate_investment_movement_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if not exists (
    select 1 from public.investments where id = new.investment_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Investimento inválido.';
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta inválida.';
  end if;

  return new;
end;
$$;

create trigger investment_movements_validate
  before insert or update on public.investment_movements
  for each row execute function public.validate_investment_movement_row();

create or replace function public.validate_loan_payment_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if not exists (
    select 1 from public.loans where id = new.loan_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Empréstimo/financiamento inválido.';
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id and deleted_at is null
  ) then
    raise exception 'Conta inválida.';
  end if;

  return new;
end;
$$;

create trigger loan_payments_validate
  before insert or update on public.loan_payments
  for each row execute function public.validate_loan_payment_row();

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping (reuses set_updated_at() from 0001_init.sql)
-- ---------------------------------------------------------------------------

create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger credit_cards_set_updated_at before update on public.credit_cards for each row execute function public.set_updated_at();
create trigger investments_set_updated_at before update on public.investments for each row execute function public.set_updated_at();
create trigger investment_movements_set_updated_at before update on public.investment_movements for each row execute function public.set_updated_at();
create trigger loans_set_updated_at before update on public.loans for each row execute function public.set_updated_at();
create trigger loan_payments_set_updated_at before update on public.loan_payments for each row execute function public.set_updated_at();
create trigger recurring_transactions_set_updated_at before update on public.recurring_transactions for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger transfers_set_updated_at before update on public.transfers for each row execute function public.set_updated_at();
create trigger card_payments_set_updated_at before update on public.card_payments for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Recurring transaction generation (idempotent — safe to call repeatedly).
-- Materializes any occurrences due up to CURRENT_DATE into `transactions`,
-- capped at 24 iterations per template so a stale/forgotten recurrence can
-- never generate an unbounded backlog in one call.
-- ---------------------------------------------------------------------------

-- Given the first day of a month and a target day-of-month, returns that day
-- clamped to the last real day of the month (e.g. day 31 in February -> 28).
create or replace function public.clamp_day_of_month(p_month_start date, p_day_of_month smallint)
returns date
language sql
immutable
as $$
  select least(
    p_month_start + (p_day_of_month - 1) * interval '1 day',
    p_month_start + interval '1 month' - interval '1 day'
  )::date;
$$;

create or replace function public.generate_due_recurring_transactions(p_household_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_cursor_month date;
  v_next_date date;
  v_generated integer := 0;
  v_iterations integer;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Acesso negado.';
  end if;

  for rec in
    select * from public.recurring_transactions
    where household_id = p_household_id
      and active
      and deleted_at is null
  loop
    v_iterations := 0;

    if rec.last_generated_on is null then
      v_cursor_month := date_trunc('month', rec.start_date)::date;
    else
      v_cursor_month := (date_trunc('month', rec.last_generated_on) + interval '1 month')::date;
    end if;

    loop
      v_next_date := public.clamp_day_of_month(v_cursor_month, rec.day_of_month);

      exit when v_next_date > current_date;
      exit when rec.end_date is not null and v_next_date > rec.end_date;
      exit when v_iterations >= 24;

      if v_next_date >= rec.start_date then
        insert into public.transactions (
          household_id, type, amount_cents, occurred_on, description, notes,
          category_id, account_id, card_id, scope, recurrence_id, created_by
        ) values (
          rec.household_id, rec.type, rec.amount_cents, v_next_date, rec.description, rec.notes,
          rec.category_id, rec.account_id, rec.card_id, rec.scope, rec.id, rec.created_by
        );
        v_generated := v_generated + 1;
      end if;

      update public.recurring_transactions set last_generated_on = v_next_date where id = rec.id;

      v_cursor_month := (v_cursor_month + interval '1 month')::date;
      v_iterations := v_iterations + 1;
    end loop;
  end loop;

  return v_generated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.category_groups enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.investments enable row level security;
alter table public.investment_movements enable row level security;
alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.card_payments enable row level security;

-- Category catalog: readable by any authenticated user, writable by no one
-- through the API (managed only via migrations).
create policy "anyone authenticated can read category groups" on public.category_groups for select to authenticated using (true);
create policy "anyone authenticated can read categories" on public.categories for select to authenticated using (true);

-- Household-scoped tables: members can select/insert/update rows of their
-- own household; there is no delete policy for any of them (see grants).
create policy "members can view accounts" on public.accounts for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert accounts" on public.accounts for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update accounts" on public.accounts for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view credit_cards" on public.credit_cards for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert credit_cards" on public.credit_cards for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update credit_cards" on public.credit_cards for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view investments" on public.investments for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert investments" on public.investments for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update investments" on public.investments for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view investment_movements" on public.investment_movements for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert investment_movements" on public.investment_movements for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update investment_movements" on public.investment_movements for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view loans" on public.loans for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert loans" on public.loans for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update loans" on public.loans for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view loan_payments" on public.loan_payments for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert loan_payments" on public.loan_payments for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update loan_payments" on public.loan_payments for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view recurring_transactions" on public.recurring_transactions for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert recurring_transactions" on public.recurring_transactions for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update recurring_transactions" on public.recurring_transactions for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view transactions" on public.transactions for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert transactions" on public.transactions for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update transactions" on public.transactions for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view transfers" on public.transfers for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert transfers" on public.transfers for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update transfers" on public.transfers for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view card_payments" on public.card_payments for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert card_payments" on public.card_payments for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update card_payments" on public.card_payments for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Grants. No DELETE is ever granted on any financial table — "deleting" a
-- movement is only ever the protected, reversible act of setting
-- deleted_at via UPDATE.
-- ---------------------------------------------------------------------------

grant select on public.category_groups, public.categories to authenticated;

grant select, insert on public.accounts, public.credit_cards, public.investments,
  public.investment_movements, public.loans, public.loan_payments, public.recurring_transactions,
  public.transactions, public.transfers, public.card_payments to authenticated;

grant update on public.accounts, public.credit_cards, public.investments,
  public.investment_movements, public.recurring_transactions, public.transactions,
  public.transfers, public.card_payments to authenticated;

-- Loans: everything is editable EXCEPT the fields the loan_payments trigger
-- maintains (outstanding_balance_cents, installments_paid) and the facts of
-- the contract itself — a user can rename/archive/soft-delete a loan, but
-- can only change its balance by recording a payment.
grant update (kind, name, institution, interest_rate_monthly, due_day, archived, deleted_at)
  on public.loans to authenticated;

grant execute on function public.generate_due_recurring_transactions(uuid) to authenticated;
