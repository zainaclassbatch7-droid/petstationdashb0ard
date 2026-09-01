-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/oaboikhoxbwbwqnobfnt/sql)

create table if not exists revenue_entries (
  id text primary key,
  date text not null,
  items jsonb not null default '[]',
  payment_method text not null,
  total_amount numeric not null,
  created_by text,
  created_at timestamptz not null,
  synced boolean default true,
  deletion_approval jsonb,
  invoice_no text
);

create table if not exists expense_entries (
  id text primary key,
  date text not null,
  ledger_id text,
  subledger_id text,
  amount numeric not null,
  payment_method text,
  description text,
  note text,
  created_by text,
  created_at timestamptz not null
);

create table if not exists customers (
  id text primary key,
  name text not null,
  phone text,
  visit_count integer default 1,
  total_spent numeric default 0,
  last_visit text,
  created_at timestamptz not null
);

create table if not exists addon_entries (
  id text primary key,
  date text not null,
  staff_id text,
  ticket_item_id text,
  ticket_item_name text,
  count integer not null,
  payment_method text,
  submitted_by_user_id text,
  submitted_by_name text,
  note text,
  created_at timestamptz not null
);

-- Enable Row Level Security (allow all for anon key)
alter table revenue_entries enable row level security;
alter table expense_entries enable row level security;
alter table customers enable row level security;
alter table addon_entries enable row level security;

create policy "allow all" on revenue_entries for all using (true) with check (true);
create policy "allow all" on expense_entries for all using (true) with check (true);
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on addon_entries for all using (true) with check (true);

-- ── app_config (used for settings, invoice counter, etc.) ────────────────────
create table if not exists app_config (
  app_id text not null,
  key    text not null,
  value  text,
  primary key (app_id, key)
);

alter table app_config enable row level security;
create policy "allow all" on app_config for all using (true) with check (true);

-- ── Add invoice_no to existing revenue_entries table (run if table already exists) ──
alter table revenue_entries add column if not exists invoice_no text;

-- ── Backfill yesterday's bills with sequential invoice numbers ───────────────
-- Run this once to assign invoice numbers to bills printed yesterday.
-- Adjust the date '2025-07-14' to yesterday's actual date before running.
do $$
declare
  rec record;
  counter integer := 1;
  prefix  text;
  num     integer;
  inv     text;
  existing_counter integer := 0;
begin
  -- Get current counter from app_config so backfill continues the sequence
  select coalesce((value::integer), 0) into existing_counter
  from app_config where app_id = 'petstation' and key = 'invoiceCounter';

  counter := existing_counter;

  for rec in
    select id from revenue_entries
    where invoice_no is null
      and date = to_char(current_date - interval '1 day', 'YYYY-MM-DD')
    order by created_at asc
  loop
    counter := counter + 1;
    prefix := chr(65 + ((counter - 1) / 99999));
    num    := ((counter - 1) % 99999) + 1;
    inv    := prefix || '#' || num;
    update revenue_entries set invoice_no = inv where id = rec.id;
  end loop;

  -- Update the counter in app_config
  insert into app_config (app_id, key, value)
    values ('petstation', 'invoiceCounter', counter::text)
  on conflict (app_id, key) do update set value = excluded.value;
end;
$$;
