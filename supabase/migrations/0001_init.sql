-- Financeiro Familiar — Etapa 1: autenticação, família (casal) e perfis
--
-- Security model (enforced in the database, never only in the frontend):
--   * Row Level Security is enabled on every table in this schema.
--   * A user can only ever see/edit rows belonging to their own household,
--     via the is_household_member()/is_household_owner() helper functions,
--     which read auth.uid() — the verified identity from the Supabase JWT.
--   * Households and profiles are only ever INSERTed by the handle_new_user()
--     trigger (SECURITY DEFINER) that runs at sign-up time. There is no
--     INSERT grant for the `authenticated` role on either table — clients
--     cannot fabricate a household or attach themselves to one directly.
--   * Column-level GRANTs further restrict what an authenticated user may
--     UPDATE: e.g. a member can rename their own household but never change
--     a profile's household_id/spouse_slot/role — those are identity/
--     membership facts, not editable preferences.
--   * No bank credentials or tokens are stored anywhere in this schema.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  invite_code text not null unique,
  currency text not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is 'A couple sharing finances. All financial data will hang off household_id in later migrations.';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 0),
  avatar_emoji text not null default '🙂',
  spouse_slot smallint not null check (spouse_slot in (1, 2)),
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, spouse_slot)
);

comment on table public.profiles is 'One row per auth.users member, always exactly 2 per household (the couple).';

create index profiles_household_id_idx on public.profiles (household_id);

-- Classification for future expense records: shared vs. one spouse's own.
-- Created now (schema-only) per Etapa 1 spec; the transactions table that
-- will use it arrives in a later stage.
create type public.expense_scope as enum ('FAMILY', 'SPOUSE_1', 'SPOUSE_2');

-- ---------------------------------------------------------------------------
-- updated_at bookkeeping
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger households_set_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invite codes
-- ---------------------------------------------------------------------------

create or replace function public.generate_unique_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  already_taken boolean;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists (select 1 from public.households where invite_code = candidate) into already_taken;
    exit when not already_taken;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so they can read profiles safely
-- from inside profiles' own RLS policies without recursion issues).
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and household_id = target_household_id
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and household_id = target_household_id and role = 'OWNER'
  );
$$;

-- ---------------------------------------------------------------------------
-- Sign-up trigger: creates or joins a household from the metadata passed to
-- supabase.auth.signUp({ options: { data: { mode, household_name | invite_code,
-- full_name, avatar_emoji } } }). Runs before the client ever gets a session,
-- so household creation/joining is never left to (untrusted) client code.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := new.raw_user_meta_data ->> 'mode';
  v_full_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_avatar text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'avatar_emoji'), ''), '🙂');
  v_household_id uuid;
  v_taken_slots smallint[];
  v_next_slot smallint;
begin
  if v_mode = 'join' then
    select id into v_household_id
    from public.households
    where invite_code = upper(trim(new.raw_user_meta_data ->> 'invite_code'));

    if v_household_id is null then
      raise exception 'Código de convite inválido.';
    end if;

    select array_agg(spouse_slot) into v_taken_slots
    from public.profiles
    where household_id = v_household_id;

    if v_taken_slots is not null and 1 = any (v_taken_slots) and 2 = any (v_taken_slots) then
      raise exception 'Esta família já possui dois membros.';
    end if;

    v_next_slot := case when v_taken_slots is null or not (1 = any (v_taken_slots)) then 1 else 2 end;

    insert into public.profiles (id, household_id, full_name, avatar_emoji, spouse_slot, role)
    values (new.id, v_household_id, v_full_name, v_avatar, v_next_slot, 'MEMBER');
  else
    insert into public.households (name, invite_code)
    values (
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'household_name'), ''), 'Minha família'),
      public.generate_unique_invite_code()
    )
    returning id into v_household_id;

    insert into public.profiles (id, household_id, full_name, avatar_emoji, spouse_slot, role)
    values (new.id, v_household_id, v_full_name, v_avatar, 1, 'OWNER');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.profiles enable row level security;

create policy "members can view their household"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "owner can rename their household"
  on public.households for update
  to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy "members can view profiles in their household"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_household_member(household_id));

create policy "a user can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No INSERT/DELETE policies for `authenticated` on either table: household
-- creation/membership is only ever established by handle_new_user() above.

-- ---------------------------------------------------------------------------
-- Least-privilege grants. RLS restricts *rows*; these grants restrict which
-- *columns* an authenticated user may write at all, regardless of RLS.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_emoji) on public.profiles to authenticated;
