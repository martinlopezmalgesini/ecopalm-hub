-- Run against a database with 001_cloud.sql and 002_bible_seed.sql applied.
-- Simulates Supabase sessions by setting request.jwt.claim.sub and the role.
\set ON_ERROR_STOP on
\set QUIET on

-- test users (as superuser, auth.uid() is null)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1','admin@test.io','{"display_name":"Ana Admin"}'),
  ('00000000-0000-0000-0000-0000000000e1','editor@test.io','{}'),
  ('00000000-0000-0000-0000-0000000000b1','bea@test.io','{}'),
  ('00000000-0000-0000-0000-0000000000c1','carl@test.io','{}')
on conflict do nothing;
update public.profiles set role='admin'  where email='admin@test.io';
update public.profiles set role='editor' where email='editor@test.io';

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $f$;

create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $f$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'PASS  (blocked) %: %', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL  (should have been blocked) %', label;
end $f$;

create or replace function pg_temp.expect_count(sql text, expected bigint, label text) returns void language plpgsql as $f$
declare n bigint;
begin
  execute sql into n;
  if n is distinct from expected then raise exception 'FAIL % (got %, expected %)', label, n, expected; end if;
  raise notice 'PASS  % = %', label, n;
end $f$;

-- 0. profile trigger worked
select pg_temp.expect_count($$select count(*) from public.profiles where email like '%@test.io'$$, 4, 'profiles created by trigger');

-- 1. learners keep their own data private
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into public.user_notes (scope,item_id,body) values ('playbook','pay-lc','Bea private note');
insert into public.playbook_progress (entry_id, learned) values ('pay-lc', true);
select pg_temp.expect_count($$select count(*) from public.playbook_progress where learned_at is not null$$, 1, 'learned_at set by trigger, not by client');
select public.record_scenario_answer('sc-blind-chain', true);
select public.record_scenario_answer('sc-blind-chain', false);
select pg_temp.expect_count($$select attempts from public.scenario_results where scenario_id='sc-blind-chain'$$, 2, 'attempts counted');
select pg_temp.expect_count($$select correct_count from public.scenario_results where scenario_id='sc-blind-chain'$$, 1, 'correct_count counted');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($$select count(*) from public.user_notes$$, 0, 'Carl sees none of Bea notes');
select pg_temp.expect_count($$select count(*) from public.playbook_progress$$, 0, 'Carl sees none of Bea progress');
select pg_temp.expect_fail($$insert into public.user_notes (user_id,scope,item_id,body) values ('00000000-0000-0000-0000-0000000000b1','playbook','x','forged')$$, 'Carl cannot write as Bea');
select pg_temp.expect_count($$with u as (update public.user_notes set body='hacked' returning 1) select count(*) from u$$, 0, 'Carl cannot modify Bea notes (0 rows)');
select pg_temp.expect_fail($$insert into public.user_notes (scope,item_id,body) values ('other','x','bad scope')$$, 'invalid scope rejected');

-- 2. role escalation is blocked
select pg_temp.expect_fail($$update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1'$$, 'learner cannot make himself admin');
select pg_temp.expect_fail($$select public.admin_set_role('00000000-0000-0000-0000-0000000000c1','admin')$$, 'learner cannot call admin_set_role');
select pg_temp.expect_fail($$select * from public.admin_progress_summary()$$, 'learner cannot read team summary');
select pg_temp.expect_count($$select count(*) from public.profiles$$, 1, 'learner only sees own profile');
update public.profiles set display_name='Carl C.' where id='00000000-0000-0000-0000-0000000000c1';
select pg_temp.expect_count($$select count(*) from public.profiles where display_name='Carl C.'$$, 1, 'learner can rename himself');

-- 3. content: learners read, cannot write
select pg_temp.expect_count($$select count(*) from public.bible_items where kind='entry'$$, 190, 'learner reads all entries');
select pg_temp.expect_count($$with u as (update public.bible_items set data = data || '{"title":"hacked"}'::jsonb where id='pay-lc' returning 1) select count(*) from u$$, 0, 'learner cannot edit content (0 rows)');
select pg_temp.expect_fail($$insert into public.bible_items (kind,id,data) values ('entry','sneaky','{"id":"sneaky","title":"x","in_plain_words":"x","in_detail":"x","sector":"payments","level":"core","confidence":"high","stages":["stage0"]}')$$, 'learner cannot insert VALID content (blocked by RLS)');
select pg_temp.expect_fail($$select * from public.bible_recent_changes(10)$$, 'learner cannot read history');
select pg_temp.expect_count($$select count(*) from public.bible_revisions$$, 0, 'learner sees no revisions');

-- 4. editor can edit, validation and history work, optimistic concurrency works
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_count($$with u as (update public.bible_items set data = data || '{"in_plain_words":"Edited by editor."}'::jsonb, change_note='clarified' where kind='entry' and id='pay-lc' and version=1 returning 1) select count(*) from u$$, 1, 'editor edit with expected version');
select pg_temp.expect_count($$with u as (update public.bible_items set change_note='stale' where kind='entry' and id='pay-lc' and version=1 returning 1) select count(*) from u$$, 0, 'stale version edit affects 0 rows');
select pg_temp.expect_count($$select version from public.bible_items where kind='entry' and id='pay-lc'$$, 2, 'version bumped to 2');
select pg_temp.expect_fail($$update public.bible_items set data = data || '{"confidence":"banana"}'::jsonb where kind='entry' and id='pay-lc'$$, 'bad confidence rejected');
select pg_temp.expect_fail($$update public.bible_items set data = (data - 'title') where kind='entry' and id='pay-lc'$$, 'missing title rejected');
select pg_temp.expect_fail($$update public.bible_items set data = data || '{"confidence":"verify"}'::jsonb - 'verify_note' where kind='entry' and id='pay-lc'$$, 'verify without note rejected');
select pg_temp.expect_fail($$update public.bible_items set data = data || '{"correct":9}'::jsonb where kind='scenario' and id='sc-blind-chain'$$, 'scenario correct index out of range rejected');
select pg_temp.expect_fail($$update public.bible_items set id='renamed' where kind='entry' and id='pay-lc'$$, 'id cannot be changed');
select pg_temp.expect_count($$select count(*) from public.bible_history('entry','pay-lc')$$, 2, 'history has 2 versions');
select pg_temp.expect_count($$select count(*) from public.bible_history('entry','pay-lc') where edited_by_name='editor'$$, 1, 'history shows editor name');
select pg_temp.expect_count($$with d as (delete from public.bible_items where kind='entry' and id='pay-lc' returning 1) select count(*) from d$$, 0, 'editor cannot hard-delete');
select pg_temp.expect_fail($$update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000e1'$$, 'editor cannot promote himself');
select pg_temp.expect_fail($$select * from public.admin_progress_summary()$$, 'editor cannot read team summary');

-- soft delete hides content from learners
update public.bible_items set deleted=true, change_note='retired' where kind='entry' and id='pay-escrow';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_count($$select count(*) from public.bible_items where kind='entry'$$, 189, 'soft-deleted entry hidden from learners');

-- 5. admin: team summary (counts only), roles, last-admin protection
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_count($$select learned_count from public.admin_progress_summary() where email='bea@test.io'$$, 1, 'admin sees Bea learned count');
select pg_temp.expect_count($$select notes_count from public.admin_progress_summary() where email='bea@test.io'$$, 1, 'admin sees note COUNT only');
select pg_temp.expect_count($$select count(*) from public.user_notes$$, 0, 'admin cannot read note bodies through the API');
select pg_temp.expect_count($$select jsonb_array_length(public.admin_user_progress('00000000-0000-0000-0000-0000000000b1') -> 'learned')$$, 1, 'admin user drill-down works');
select public.admin_set_role('00000000-0000-0000-0000-0000000000c1','editor');
select pg_temp.expect_count($$select count(*) from public.profiles where email='carl@test.io' and role='editor'$$, 1, 'admin promoted Carl');
select public.admin_set_role('00000000-0000-0000-0000-0000000000c1','learner');
select pg_temp.expect_fail($$select public.admin_set_role('00000000-0000-0000-0000-0000000000a1','learner')$$, 'last admin cannot be demoted');
select pg_temp.expect_count($$with d as (delete from public.bible_items where kind='entry' and id='pay-escrow' returning 1) select count(*) from d$$, 1, 'admin can hard-delete');

-- 6. anonymous visitors get nothing
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
select pg_temp.expect_fail($$select count(*) from public.bible_items$$, 'anon cannot read content');
select pg_temp.expect_fail($$select count(*) from public.profiles$$, 'anon cannot read profiles');
select pg_temp.expect_fail($$select public.is_admin()$$, 'anon cannot call helper functions');
reset role;

do $$ begin raise notice 'ALL RLS TESTS PASSED'; end $$;
