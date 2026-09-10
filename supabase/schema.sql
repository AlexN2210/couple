create extension if not exists "pgcrypto";

create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre duo',
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);
create table if not exists partners (
  id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists slug text;
alter table public.categories add column if not exists label text;
alter table public.categories add column if not exists emoji text;
alter table public.categories add column if not exists sort_order integer default 0;
alter table public.categories add column if not exists created_at timestamptz default now();
update public.categories set id = gen_random_uuid() where id is null;
alter table public.categories alter column id set default gen_random_uuid();
update public.categories set name = coalesce(name, slug, 'Catégorie') where name is null;
update public.categories set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) where slug is null;
update public.categories set label = coalesce(label, name, slug, 'Catégorie') where label is null;
alter table public.categories alter column label set default 'Catégorie';
alter table public.categories alter column label set not null;
update public.categories set emoji = coalesce(emoji, '✨') where emoji is null;
alter table public.categories alter column emoji set default '✨';
alter table public.categories alter column emoji set not null;
update public.categories set sort_order = coalesce(sort_order, 0) where sort_order is null;
with duplicated_slugs as (
  select ctid, slug, row_number() over (partition by slug order by id) as duplicate_number
  from public.categories
)
update public.categories as categories
set slug = duplicated_slugs.slug || '-' || replace(categories.id::text, '-', '')
from duplicated_slugs
where categories.ctid = duplicated_slugs.ctid
  and duplicated_slugs.duplicate_number > 1;
create unique index if not exists categories_slug_unique on public.categories(slug);
insert into public.categories (name, label, emoji, slug, sort_order) values
  ('Fun', 'Fun', '✨', 'fun', 1),
  ('Romantique', 'Romantique', '♥', 'romantique', 2),
  ('Défi', 'Défi', '⚡', 'defi', 3),
  ('Surprise', 'Surprise', '🎁', 'surprise', 4)
on conflict (slug) do update set name = excluded.name, label = excluded.label, emoji = excluded.emoji, sort_order = excluded.sort_order;

alter table couples add column if not exists join_code text;
update couples set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) where join_code is null;
alter table couples alter column join_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
create unique index if not exists couples_join_code_key on couples(join_code);
alter table partners add column if not exists created_at timestamptz not null default now();
create table if not exists actions (
  id uuid primary key default gen_random_uuid(), couple_id uuid references couples(id) on delete cascade,
  title text not null, description text not null default '', category text not null, kind text not null default 'action' check (kind in ('action','scenario')), is_template boolean not null default false, created_by_partner_id uuid references partners(id) on delete set null, created_at timestamptz not null default now()
);
alter table actions alter column couple_id drop not null;
alter table actions add column if not exists is_template boolean not null default false;
alter table actions drop constraint if exists actions_category_check;
alter table actions add column if not exists kind text not null default 'action';
alter table actions add column if not exists created_by_partner_id uuid references partners(id) on delete set null;
alter table actions drop constraint if exists actions_kind_check;
alter table actions add constraint actions_kind_check check (kind in ('action', 'scenario'));
create index if not exists actions_created_by_partner_id_idx on actions(created_by_partner_id);
create unique index if not exists actions_template_unique on public.actions (title, category) where is_template = true;
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
alter table categories enable row level security;
alter table actions enable row level security;
alter table schedules enable row level security;
alter table triggers enable row level security;

do $$
begin
  alter publication supabase_realtime add table public.triggers;
exception
  when duplicate_object then null;
end;
$$;

drop policy if exists "everyone can read categories" on categories;
create policy "everyone can read categories" on categories for select using (true);

create or replace function public.create_private_couple_for_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare new_couple_id uuid;
begin
  insert into public.couples (name) values (coalesce(new.raw_user_meta_data ->> 'couple_name', 'Notre duo')) returning id into new_couple_id;
  insert into public.partners (id, couple_id, name, email)
  values (new.id, new_couple_id, coalesce(new.raw_user_meta_data ->> 'name', 'Partenaire A'), new.email);
  return new;
end;
$$;

create or replace function public.join_couple_by_code(p_join_code text, p_name text)
returns public.couples
language plpgsql
security definer set search_path = public
as $$
declare target_couple public.couples;
begin
  select * into target_couple from public.couples where join_code = upper(trim(p_join_code));
  if target_couple.id is null then raise exception 'Code de couple invalide'; end if;
  update public.partners set couple_id = target_couple.id, name = nullif(trim(p_name), '') where id = auth.uid();
  return target_couple;
end;
$$;

grant execute on function public.join_couple_by_code(text, text) to authenticated;

create or replace function public.set_action_author()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.created_by_partner_id = auth.uid();
  new.is_template = false;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_private_couple_for_user();

drop trigger if exists set_action_author_on_insert on public.actions;
create trigger set_action_author_on_insert
  before insert on public.actions
  for each row execute procedure public.set_action_author();

drop policy if exists "couple members can read their couple" on couples;
drop policy if exists "partners can read their profile" on partners;
drop policy if exists "couple members can read actions" on actions;
drop policy if exists "couple members can insert actions" on actions;
drop policy if exists "couple members can update actions" on actions;
drop policy if exists "couple members can delete actions" on actions;
drop policy if exists "couple members can manage schedules" on schedules;
drop policy if exists "couple members can read triggers" on triggers;
drop policy if exists "couple members can create triggers" on triggers;

create policy "couple members can read their couple" on couples for select using (exists (select 1 from partners where partners.couple_id = couples.id and partners.id = auth.uid()));
create policy "partners can read their profile" on partners for select using (id = auth.uid() or exists (select 1 from partners member where member.couple_id = partners.couple_id and member.id = auth.uid()));
drop policy if exists "everyone can read template actions" on actions;
create policy "users can read their own actions" on actions for select using (created_by_partner_id = auth.uid());
create policy "couple members can insert actions" on actions for insert with check (is_template = false and exists (select 1 from partners where partners.couple_id = actions.couple_id and partners.id = auth.uid()));
create policy "users can update their own actions" on actions for update using (created_by_partner_id = auth.uid()) with check (created_by_partner_id = auth.uid() and is_template = false);
create policy "users can delete their own actions" on actions for delete using (created_by_partner_id = auth.uid());
create policy "couple members can manage schedules" on schedules for all using (exists (select 1 from partners where partners.couple_id = schedules.couple_id and partners.id = auth.uid())) with check (exists (select 1 from partners where partners.couple_id = schedules.couple_id and partners.id = auth.uid()));
create policy "couple members can read triggers" on triggers for select using (exists (select 1 from actions join partners on partners.couple_id = actions.couple_id where actions.id = triggers.action_id and partners.id = auth.uid()));
create policy "couple members can create triggers" on triggers for insert with check (exists (select 1 from actions join partners on partners.couple_id = actions.couple_id where actions.id = triggers.action_id and partners.id = auth.uid()));

create or replace view public.action_author_audit
with (security_invoker = true)
as
select
  actions.id,
  actions.couple_id,
  actions.title,
  actions.kind,
  actions.category,
  actions.created_at,
  partners.name as author_name,
  partners.email as author_email
from public.actions
left join public.partners on partners.id = actions.created_by_partner_id;
