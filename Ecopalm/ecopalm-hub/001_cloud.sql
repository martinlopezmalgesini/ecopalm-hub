-- EcoPalm Hub: cloud accounts, per-user progress and notes, editable content with history.
-- Run once in the Supabase SQL editor (or with the Supabase CLI) BEFORE the seed file.
-- Safe to re-run: objects use IF NOT EXISTS / CREATE OR REPLACE where possible.

------------------------------------------------------------------------------
-- 1. Profiles and roles
------------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'learner' check (role in ('learner','editor','admin')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'admin', false)
$$;

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('editor','admin'), false)
$$;

-- Create a profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Backfill users that existed before this migration.
insert into public.profiles (id, email, display_name)
select u.id, u.email, coalesce(nullif(u.raw_user_meta_data->>'display_name',''), split_part(u.email,'@',1))
from auth.users u
on conflict (id) do nothing;

-- Only an admin may change roles; nobody may change id or email through the API.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'only an admin can change roles' using errcode = '42501';
    end if;
    if new.email is distinct from old.email or new.id is distinct from old.id then
      raise exception 'id and email cannot be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.touch_last_seen()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid()
$$;

------------------------------------------------------------------------------
-- 2. Per-user data: notes, learning progress, gate checks, scenario results
------------------------------------------------------------------------------
create table if not exists public.user_notes (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope      text not null check (scope in ('playbook','logistics','agencies')),
  item_id    text not null check (char_length(item_id) between 1 and 200),
  body       text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  primary key (user_id, scope, item_id)
);

create table if not exists public.playbook_progress (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id    text not null check (char_length(entry_id) between 1 and 200),
  learned     boolean not null default false,
  learned_at  timestamptz,
  flash_box   smallint not null default 0 check (flash_box between 0 and 3),
  flash_due   timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create table if not exists public.playbook_gate_checks (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gate_key   text not null check (char_length(gate_key) between 1 and 200),
  checked    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, gate_key)
);

create table if not exists public.scenario_results (
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scenario_id      text not null check (char_length(scenario_id) between 1 and 200),
  attempts         integer not null default 0,
  correct_count    integer not null default 0,
  last_correct     boolean not null default false,
  last_answered_at timestamptz not null default now(),
  primary key (user_id, scenario_id)
);

-- Scenario answers go through a function so attempts can be counted safely.
create or replace function public.record_scenario_answer(p_scenario text, p_correct boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.scenario_results as r (user_id, scenario_id, attempts, correct_count, last_correct, last_answered_at)
  values (auth.uid(), p_scenario, 1, case when p_correct then 1 else 0 end, p_correct, now())
  on conflict (user_id, scenario_id) do update
    set attempts = r.attempts + 1,
        correct_count = r.correct_count + case when p_correct then 1 else 0 end,
        last_correct = p_correct,
        last_answered_at = now();
end $$;

-- Timestamps are set by the database, never trusted from the client.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.progress_before()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.learned then
    if tg_op = 'INSERT' or not old.learned or old.learned_at is null then
      new.learned_at := now();
    else
      new.learned_at := old.learned_at;
    end if;
  else
    new.learned_at := null;
  end if;
  return new;
end $$;

drop trigger if exists user_notes_touch on public.user_notes;
create trigger user_notes_touch before insert or update on public.user_notes
  for each row execute function public.touch_updated_at();
drop trigger if exists gate_checks_touch on public.playbook_gate_checks;
create trigger gate_checks_touch before insert or update on public.playbook_gate_checks
  for each row execute function public.touch_updated_at();
drop trigger if exists progress_before_trg on public.playbook_progress;
create trigger progress_before_trg before insert or update on public.playbook_progress
  for each row execute function public.progress_before();

do $$
declare t text;
begin
  foreach t in array array['user_notes','playbook_progress','playbook_gate_checks','scenario_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_own', t);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 3. Editable content ("the bible") with revision history
------------------------------------------------------------------------------
create table if not exists public.bible_items (
  kind        text not null check (kind in ('entry','scenario','stage','sector')),
  id          text not null check (id ~ '^[a-z0-9][a-z0-9_-]{1,80}$'),
  data        jsonb not null check (jsonb_typeof(data) = 'object'),
  version     integer not null default 1,
  deleted     boolean not null default false,
  change_note text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references auth.users(id) on delete set null,
  primary key (kind, id)
);

create table if not exists public.bible_revisions (
  rev_id      bigint generated always as identity primary key,
  kind        text not null,
  item_id     text not null,
  version     integer not null,
  data        jsonb not null,
  deleted     boolean not null default false,
  change_note text,
  edited_by   uuid references auth.users(id) on delete set null,
  edited_at   timestamptz not null default now()
);
create index if not exists bible_revisions_item_idx on public.bible_revisions (kind, item_id, version desc);
create index if not exists bible_revisions_recent_idx on public.bible_revisions (edited_at desc);

create or replace function public.validate_bible_item(p_kind text, p_id text, p_data jsonb)
returns void language plpgsql immutable as $$
declare f text;
begin
  if p_data->>'id' is distinct from p_id then
    raise exception 'data.id must equal the item id';
  end if;
  if p_kind = 'entry' then
    foreach f in array array['title','in_plain_words','in_detail','sector','level','confidence'] loop
      if nullif(trim(coalesce(p_data->>f,'')),'') is null then
        raise exception 'entry field % is required', f;
      end if;
    end loop;
    if p_data->>'confidence' not in ('high','medium','verify') then raise exception 'bad confidence'; end if;
    if p_data->>'level' not in ('foundation','core','advanced') then raise exception 'bad level'; end if;
    if jsonb_typeof(p_data->'stages') is distinct from 'array' or jsonb_array_length(p_data->'stages') = 0 then
      raise exception 'an entry needs at least one stage';
    end if;
    if p_data->>'confidence' = 'verify' and nullif(trim(coalesce(p_data->>'verify_note','')),'') is null then
      raise exception 'entries marked verify need a verify_note';
    end if;
  elsif p_kind = 'scenario' then
    foreach f in array array['title','situation','question','explanation','stage','sector'] loop
      if nullif(trim(coalesce(p_data->>f,'')),'') is null then
        raise exception 'scenario field % is required', f;
      end if;
    end loop;
    if jsonb_typeof(p_data->'options') is distinct from 'array' or jsonb_array_length(p_data->'options') < 2 then
      raise exception 'a scenario needs at least two options';
    end if;
    if (p_data->>'correct')::int < 0 or (p_data->>'correct')::int >= jsonb_array_length(p_data->'options') then
      raise exception 'correct index out of range';
    end if;
  elsif p_kind = 'stage' then
    foreach f in array array['label','goal'] loop
      if nullif(trim(coalesce(p_data->>f,'')),'') is null then
        raise exception 'stage field % is required', f;
      end if;
    end loop;
    if jsonb_typeof(p_data->'gate') is distinct from 'array' then raise exception 'stage.gate must be a list'; end if;
  end if;
end $$;

create or replace function public.bible_items_before()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.kind <> old.kind or new.id <> old.id) then
    raise exception 'kind and id cannot be changed';
  end if;
  if not new.deleted then
    perform public.validate_bible_item(new.kind, new.id, new.data);
  end if;
  if tg_op = 'INSERT' then
    new.version := 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), new.updated_by);
  else
    new.version := old.version + 1;
    new.updated_at := now();
    new.updated_by := coalesce(auth.uid(), old.updated_by);
  end if;
  return new;
end $$;

create or replace function public.bible_items_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bible_revisions (kind, item_id, version, data, deleted, change_note, edited_by)
  values (new.kind, new.id, new.version, new.data, new.deleted, new.change_note, new.updated_by);
  return null;
end $$;

drop trigger if exists bible_items_before_trg on public.bible_items;
create trigger bible_items_before_trg before insert or update on public.bible_items
  for each row execute function public.bible_items_before();
drop trigger if exists bible_items_after_trg on public.bible_items;
create trigger bible_items_after_trg after insert or update on public.bible_items
  for each row execute function public.bible_items_after();

alter table public.bible_items enable row level security;
alter table public.bible_revisions enable row level security;

drop policy if exists bible_items_select on public.bible_items;
drop policy if exists bible_items_insert on public.bible_items;
drop policy if exists bible_items_update on public.bible_items;
drop policy if exists bible_items_delete on public.bible_items;
drop policy if exists bible_revisions_select on public.bible_revisions;

create policy bible_items_select on public.bible_items for select to authenticated
  using (not deleted or public.is_editor());
create policy bible_items_insert on public.bible_items for insert to authenticated
  with check (public.is_editor());
create policy bible_items_update on public.bible_items for update to authenticated
  using (public.is_editor()) with check (public.is_editor());
create policy bible_items_delete on public.bible_items for delete to authenticated
  using (public.is_admin());
create policy bible_revisions_select on public.bible_revisions for select to authenticated
  using (public.is_editor());
-- No insert/update/delete policy on bible_revisions: only the trigger writes there.

-- History with author names, for editors.
create or replace function public.bible_history(p_kind text, p_id text)
returns table (rev_id bigint, version integer, data jsonb, deleted boolean, change_note text,
               edited_at timestamptz, edited_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_editor() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select r.rev_id, r.version, r.data, r.deleted, r.change_note, r.edited_at,
           coalesce(p.display_name, p.email, 'system')
    from public.bible_revisions r left join public.profiles p on p.id = r.edited_by
    where r.kind = p_kind and r.item_id = p_id
    order by r.version desc;
end $$;

create or replace function public.bible_recent_changes(p_limit integer default 50)
returns table (rev_id bigint, kind text, item_id text, version integer, change_note text,
               edited_at timestamptz, edited_by_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_editor() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select r.rev_id, r.kind, r.item_id, r.version, r.change_note, r.edited_at,
           coalesce(p.display_name, p.email, 'system')
    from public.bible_revisions r left join public.profiles p on p.id = r.edited_by
    where r.version > 1
    order by r.edited_at desc
    limit greatest(1, least(coalesce(p_limit, 50), 200));
end $$;

------------------------------------------------------------------------------
-- 4. Admin tools: team progress (counts only; note bodies stay private) and roles
------------------------------------------------------------------------------
create or replace function public.admin_progress_summary()
returns table (user_id uuid, email text, display_name text, role text,
               learned_count bigint, scenarios_answered bigint, scenarios_correct bigint,
               gates_checked bigint, notes_count bigint, last_active timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.display_name, p.role,
      (select count(*) from public.playbook_progress x where x.user_id = p.id and x.learned),
      (select count(*) from public.scenario_results x where x.user_id = p.id),
      (select count(*) from public.scenario_results x where x.user_id = p.id and x.last_correct),
      (select count(*) from public.playbook_gate_checks x where x.user_id = p.id and x.checked),
      (select count(*) from public.user_notes x where x.user_id = p.id and x.body <> ''),
      greatest(p.last_seen_at,
               (select max(x.updated_at) from public.playbook_progress x where x.user_id = p.id),
               (select max(x.updated_at) from public.user_notes x where x.user_id = p.id),
               (select max(x.last_answered_at) from public.scenario_results x where x.user_id = p.id))
    from public.profiles p
    order by p.created_at;
end $$;

create or replace function public.admin_user_progress(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  return jsonb_build_object(
    'learned', coalesce((select jsonb_agg(entry_id order by entry_id) from public.playbook_progress
                         where user_id = p_user and learned), '[]'::jsonb),
    'scenarios', coalesce((select jsonb_agg(jsonb_build_object('id', scenario_id, 'attempts', attempts,
                           'correct_count', correct_count, 'last_correct', last_correct) order by scenario_id)
                           from public.scenario_results where user_id = p_user), '[]'::jsonb),
    'gates', coalesce((select jsonb_agg(gate_key order by gate_key) from public.playbook_gate_checks
                       where user_id = p_user and checked), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_role not in ('learner','editor','admin') then raise exception 'bad role'; end if;
  if p_role <> 'admin'
     and (select role from public.profiles where id = p_user) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'cannot remove the last admin';
  end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

------------------------------------------------------------------------------
-- 5. Privileges: anonymous visitors get nothing; signed-in users go through RLS.
------------------------------------------------------------------------------
revoke all on public.profiles, public.user_notes, public.playbook_progress, public.playbook_gate_checks,
              public.scenario_results, public.bible_items, public.bible_revisions from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- The trigger functions and validators must not be callable as RPC by clients:
revoke execute on function public.handle_new_user(), public.profiles_guard(),
                           public.bible_items_before(), public.bible_items_after(),
                           public.touch_updated_at(), public.progress_before() from authenticated;

-- OPTIONAL but recommended: protect the supplier directory the same way.
-- alter table public.suppliers_iscc enable row level security;
-- create policy suppliers_read on public.suppliers_iscc for select to authenticated using (true);
-- revoke all on public.suppliers_iscc from anon;

-- FIRST ADMIN: sign up in the app, then run (replace the email):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
