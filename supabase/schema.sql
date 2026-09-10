create extension if not exists "pgcrypto";

create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre duo',
  created_at timestamptz not null default now()
);
create table if not exists partners (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  email text not null
);
create table if not exists actions (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references couples(id) on delete cascade,
  title text not null, description text not null default '', category text not null check (category in ('fun','romantique','defi','surprise')), created_at timestamptz not null default now()
);
create table if not exists schedules (
  id uuid primary key default gen_random_uuid(), couple_id uuid not null references couples(id) on delete cascade,
  start_hour time not null, end_hour time not null, days_of_week int[] not null default '{}', active boolean not null default true,
  constraint valid_schedule_hours check (start_hour < end_hour)
);
create table if not exists triggers (
  id uuid primary key default gen_random_uuid(), action_id uuid not null references actions(id) on delete cascade,
  triggered_at timestamptz not null default now(), delivered_to_partner_id uuid references partners(id) on delete set null
);

alter table couples enable row level security;
alter table partners enable row level security;
alter table actions enable row level security;
alter table schedules enable row level security;
alter table triggers enable row level security;

create or replace function public.create_private_couple_for_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare new_couple_id uuid;
begin
  insert into public.couples (name) values ('Notre duo') returning id into new_couple_id;
  insert into public.partners (id, couple_id, name, email)
  values (new.id, new_couple_id, coalesce(new.raw_user_meta_data ->> 'name', 'Partenaire A'), new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_private_couple_for_user();

create policy "couple members can read their couple" on couples for select using (exists (select 1 from partners where partners.couple_id = couples.id and partners.id = auth.uid()));
create policy "partners can read their profile" on partners for select using (id = auth.uid() or exists (select 1 from partners member where member.couple_id = partners.couple_id and member.id = auth.uid()));
create policy "couple members can read actions" on actions for select using (exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid()));
create policy "couple members can insert actions" on actions for insert with check (exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid()));
create policy "couple members can update actions" on actions for update using (exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid())) with check (exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid()));
create policy "couple members can delete actions" on actions for delete using (exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid()));
create policy "couple members can manage schedules" on schedules for all using (exists (select 1 from partners where partners.couple_id = schedules.couple_id and partners.id = auth.uid())) with check (exists (select 1 from partners where partners.couple_id = schedules.couple_id and partners.id = auth.uid()));
create policy "couple members can read triggers" on triggers for select using (exists (select 1 from actions join partners on partners.couple_id = actions.couple_id where actions.id = triggers.action_id and partners.id = auth.uid()));
create policy "couple members can create triggers" on triggers for insert with check (exists (select 1 from actions join partners on partners.couple_id = actions.couple_id where actions.id = triggers.action_id and partners.id = auth.uid()));
