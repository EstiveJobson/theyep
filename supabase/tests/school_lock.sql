-- Proves a user cannot edit school_id, and set_my_school works only once.
-- Run in the Supabase SQL Editor (as postgres) after 0003_security_fixes.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

create temp table qa_ids (
  user_id uuid not null,
  active_school uuid not null,
  inactive_school uuid not null
);

insert into qa_ids
select gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

insert into public.schools (id, name, short_name, active)
select active_school, 'QA Ativa', 'QA', true from qa_ids
union all
select inactive_school, 'QA Inativa', 'OFF', false from qa_ids;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  user_id,
  'authenticated',
  'authenticated',
  'school-lock@theyep.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
from qa_ids;

insert into public.profiles (id, name)
select user_id, 'QA' from qa_ids
on conflict (id) do nothing;

select set_config('request.jwt.claims', (select json_build_object('sub', user_id, 'role', 'authenticated')::text from qa_ids), true);
select set_config('request.jwt.claim.sub', (select user_id::text from qa_ids), true);
select set_config('app.qa_user', (select user_id::text from qa_ids), true);
select set_config('app.qa_active', (select active_school::text from qa_ids), true);
select set_config('app.qa_inactive', (select inactive_school::text from qa_ids), true);

set local role authenticated;

do $$
begin
  begin
    update public.profiles
    set school_id = current_setting('app.qa_active')::uuid
    where id = current_setting('app.qa_user')::uuid;
    raise exception 'FAIL: direct school update succeeded';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: direct school update blocked (%)', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    perform public.set_my_school(current_setting('app.qa_inactive')::uuid);
    raise exception 'FAIL: inactive school was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: inactive school rejected (%)', sqlerrm;
  end;
end $$;

select public.set_my_school(current_setting('app.qa_active')::uuid);

do $$
declare
  got uuid;
begin
  select school_id into got
  from public.profiles
  where id = current_setting('app.qa_user')::uuid;
  if got is distinct from current_setting('app.qa_active')::uuid then
    raise exception 'FAIL: set_my_school did not save the school';
  end if;
  raise notice 'ok: set_my_school once';
end $$;

do $$
begin
  begin
    perform public.set_my_school(current_setting('app.qa_active')::uuid);
    raise exception 'FAIL: second set_my_school succeeded';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: second set_my_school rejected (%)', sqlerrm;
  end;
end $$;

update public.profiles
set name = 'Novo nome', bio = 'Nova bio'
where id = current_setting('app.qa_user')::uuid;

do $$
declare
  got_name text;
  got_bio text;
  got_school uuid;
begin
  select name, bio, school_id
  into got_name, got_bio, got_school
  from public.profiles
  where id = current_setting('app.qa_user')::uuid;
  if got_name is distinct from 'Novo nome' or got_bio is distinct from 'Nova bio' then
    raise exception 'FAIL: name/bio update did not stick';
  end if;
  if got_school is distinct from current_setting('app.qa_active')::uuid then
    raise exception 'FAIL: name/bio update changed the school';
  end if;
  raise notice 'ok: name and bio update';
end $$;

do $$
begin
  begin
    update public.profiles
    set school_id = current_setting('app.qa_inactive')::uuid
    where id = current_setting('app.qa_user')::uuid;
    raise exception 'FAIL: school change after set_my_school succeeded';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: later school update blocked (%)', sqlerrm;
  end;
end $$;

-- Defense in depth: even with UPDATE on school_id, the trigger still rejects
-- a change that did not come from set_my_school.
reset role;

grant update (school_id) on public.profiles to authenticated;

set local role authenticated;

do $$
declare
  still uuid;
begin
  begin
    update public.profiles
    set school_id = current_setting('app.qa_inactive')::uuid
    where id = current_setting('app.qa_user')::uuid;
    raise exception 'FAIL: trigger allowed a direct school change';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      if sqlerrm not like '%school_id cannot be changed directly%' then
        raise exception 'FAIL: expected the school trigger, got %', sqlerrm;
      end if;
      raise notice 'ok: trigger blocks school_id (%)', sqlerrm;
  end;

  select school_id into still
  from public.profiles
  where id = current_setting('app.qa_user')::uuid;

  if still is distinct from current_setting('app.qa_active')::uuid then
    raise exception 'FAIL: trigger let the school change';
  end if;
end $$;

rollback;
