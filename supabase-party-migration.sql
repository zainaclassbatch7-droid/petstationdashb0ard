-- Run once in the Supabase SQL Editor to add parties and classify all existing expenses as Others.
create table if not exists parties (
  id text primary key,
  name text not null unique
);

insert into parties (id, name) values ('others', 'Others')
on conflict (id) do update set name = excluded.name;

alter table expense_entries add column if not exists party_id text;
update expense_entries set party_id = 'others' where party_id is null;
alter table expense_entries alter column party_id set default 'others';
alter table expense_entries alter column party_id set not null;

alter table parties enable row level security;
drop policy if exists "allow all" on parties;
create policy "allow all" on parties for all using (true) with check (true);
