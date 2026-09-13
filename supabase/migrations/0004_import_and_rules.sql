-- Financeiro Familiar — Etapa 3: importação de extratos + classificação
--
-- Design decisions called out by the spec:
--   * Imported rows never become `transactions` directly — they land in
--     `import_staged_transactions` first, so nothing is "consolidated"
--     without an explicit review step.
--   * A classification rule only ever affects FUTURE suggestions (rows not
--     yet staged). Updating/deleting a rule never touches existing
--     `transactions` or already-resolved staged rows — there is no code
--     path that rewrites history from a rule change.
--   * Duplicate detection only ever sets a flag (`possible_duplicate`) for a
--     human to decide on; nothing is ever auto-skipped or auto-deleted.
--   * No DELETE grant anywhere here either — a "deleted" rule is a soft
--     delete (`deleted_at`), an "ignored" staged row keeps its row
--     (`status = 'IGNORED'`) so the import's history stays intact.

create type public.staged_status as enum ('PENDING', 'SUGGESTED', 'CONFIRMED', 'IGNORED');

-- ---------------------------------------------------------------------------
-- Traceability on transactions: which import (if any) created this row, and
-- the bank's own transaction id when the source format provides one (OFX
-- FITID) — the strongest possible signal for exact-duplicate detection on
-- re-import.
-- ---------------------------------------------------------------------------

alter table public.transactions add column import_batch_id uuid;
alter table public.transactions add column external_id text;

create index transactions_external_id_idx on public.transactions (household_id, account_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Classification rules ("aprendizado"): learned from what the user picks
-- during review. Matching is a plain substring test against a normalized
-- description (see src/lib/normalize.ts) — deliberately simple and
-- inspectable, never an opaque model decision.
-- ---------------------------------------------------------------------------

create table public.classification_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  pattern text not null check (char_length(trim(pattern)) > 0),
  category_id uuid not null references public.categories (id),
  scope public.expense_scope not null default 'FAMILY',
  match_count integer not null default 0,
  active boolean not null default true,
  created_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial unique index (not a table constraint) so a soft-deleted rule never
-- blocks re-creating one with the same pattern.
create unique index classification_rules_household_pattern_idx
  on public.classification_rules (household_id, pattern)
  where deleted_at is null;

create index classification_rules_household_id_idx on public.classification_rules (household_id) where deleted_at is null and active;

create trigger classification_rules_set_updated_at
  before update on public.classification_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Import batches: one row per file imported, purely for audit/history —
-- "de onde vieram" these staged rows.
-- ---------------------------------------------------------------------------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  source_format text not null check (source_format in ('CSV', 'OFX')),
  file_name text,
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.credit_cards (id) on delete set null,
  total_rows integer not null default 0,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  check (account_id is null or card_id is null)
);

create index import_batches_household_id_idx on public.import_batches (household_id);

alter table public.transactions
  add constraint transactions_import_batch_id_fkey
  foreign key (import_batch_id) references public.import_batches (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Staged transactions: the review queue. Confirming one creates a real
-- `transactions` row and points resulting_transaction_id at it; ignoring one
-- just marks it IGNORED. Neither path ever deletes the staged row.
-- ---------------------------------------------------------------------------

create table public.import_staged_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  import_batch_id uuid not null references public.import_batches (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  card_id uuid references public.credit_cards (id) on delete set null,
  occurred_on date not null,
  description text not null,
  normalized_description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  type public.transaction_type not null,
  external_id text,
  category_id uuid references public.categories (id),
  scope public.expense_scope not null default 'FAMILY',
  status public.staged_status not null default 'PENDING',
  suggested_category_id uuid references public.categories (id),
  suggested_scope public.expense_scope,
  matched_rule_id uuid references public.classification_rules (id) on delete set null,
  possible_duplicate boolean not null default false,
  duplicate_of_transaction_id uuid references public.transactions (id) on delete set null,
  resulting_transaction_id uuid references public.transactions (id) on delete set null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_id is null or card_id is null)
);

create index import_staged_household_status_idx on public.import_staged_transactions (household_id, status);
create index import_staged_batch_id_idx on public.import_staged_transactions (import_batch_id);

create trigger import_staged_set_updated_at
  before update on public.import_staged_transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Validation + created_by, same spirit as validate_transaction_row (0002).
-- ---------------------------------------------------------------------------

create or replace function public.validate_classification_rule_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  end if;

  if not exists (select 1 from public.categories where id = new.category_id) then
    raise exception 'Categoria inválida.';
  end if;

  return new;
end;
$$;

create trigger classification_rules_validate
  before insert or update on public.classification_rules
  for each row execute function public.validate_classification_rule_row();

create or replace function public.validate_import_batch_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by := auth.uid();

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

create trigger import_batches_validate
  before insert on public.import_batches
  for each row execute function public.validate_import_batch_row();

create or replace function public.validate_staged_transaction_row()
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
    if v_category_kind is null or v_category_kind <> new.type then
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

create trigger import_staged_validate
  before insert or update on public.import_staged_transactions
  for each row execute function public.validate_staged_transaction_row();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.classification_rules enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_staged_transactions enable row level security;

create policy "members can view classification_rules" on public.classification_rules for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert classification_rules" on public.classification_rules for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update classification_rules" on public.classification_rules for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "members can view import_batches" on public.import_batches for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert import_batches" on public.import_batches for insert to authenticated with check (public.is_household_member(household_id));

create policy "members can view import_staged_transactions" on public.import_staged_transactions for select to authenticated using (public.is_household_member(household_id));
create policy "members can insert import_staged_transactions" on public.import_staged_transactions for insert to authenticated with check (public.is_household_member(household_id));
create policy "members can update import_staged_transactions" on public.import_staged_transactions for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Grants — no DELETE anywhere.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.classification_rules to authenticated;
grant select, insert on public.import_batches to authenticated;
grant select, insert, update on public.import_staged_transactions to authenticated;
