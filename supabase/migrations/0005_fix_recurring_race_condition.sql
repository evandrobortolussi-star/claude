-- Fix: two concurrent calls to generate_due_recurring_transactions() for the
-- same household (e.g. the household page open in two tabs) could both read
-- the same `last_generated_on` before either committed its UPDATE, and each
-- insert a transaction for the same occurrence — a real duplicate-transaction
-- bug, not a cosmetic one.
--
-- Fix at the root: lock each recurring_transactions row with FOR UPDATE while
-- processing it. Under READ COMMITTED (Postgres' default), a blocked FOR
-- UPDATE re-reads the row's latest committed values once the lock is
-- released, so the second call correctly sees the first call's updated
-- last_generated_on instead of stale data — no double-generation possible.

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
    for update
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
