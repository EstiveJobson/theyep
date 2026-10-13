-- Proves migration 0008: private avatars, inactive schools still readable
-- by signed-in users, and explicit service_role grants.
-- Run in the Supabase SQL Editor (as postgres) after 0008_pre_deploy_app.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

insert into public.schools (id, name, short_name, slug, active)
values
  ('d3333333-3333-4333-8333-333333333333', 'QA App Ativa', 'QAA', 'qa-app-ativa', true),
  ('d4444444-4444-4444-8444-444444444444', 'QA App Inativa', 'QAI', 'qa-app-inativa', false);

insert into storage.objects (bucket_id, name)
values ('avatars', 'aa000000-0000-4000-8000-00000000000a/face.webp');

do $$
declare
  is_public boolean;
  mimes text[];
  n int;
begin
  select public, allowed_mime_types into is_public, mimes
  from storage.buckets
  where id = 'avatars';
  if is_public is distinct from false then
    raise exception 'FAIL: avatars bucket is public';
  end if;
  if mimes is null or not (mimes @> array['image/webp']::text[]) then
    raise exception 'FAIL: avatars bucket rejects image/webp';
  end if;

  select public, allowed_mime_types into is_public, mimes
  from storage.buckets
  where id = 'post-photos';
  if is_public is distinct from false then
    raise exception 'FAIL: post-photos bucket is public';
  end if;
  if mimes is null or not (mimes @> array['image/webp']::text[]) then
    raise exception 'FAIL: post-photos bucket rejects image/webp';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'avatares publicos para leitura';
  if n <> 0 then
    raise exception 'FAIL: public avatar read policy still exists';
  end if;

  select count(*) into n
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname = 'avatares visiveis para autenticados';
  if n <> 1 then
    raise exception 'FAIL: authenticated avatar read policy missing (%)', n;
  end if;

  if not has_table_privilege('service_role', 'public.schools', 'select')
     or not has_table_privilege('service_role', 'public.schools', 'insert')
     or not has_table_privilege('service_role', 'public.profiles', 'select')
     or not has_table_privilege('service_role', 'public.profiles', 'update')
     or not has_table_privilege('service_role', 'public.profiles', 'delete')
     or not has_table_privilege('service_role', 'public.posts', 'insert')
     or not has_table_privilege('service_role', 'public.likes', 'delete')
     or not has_table_privilege('service_role', 'public.comments', 'insert')
     or not has_table_privilege('service_role', 'public.follows', 'select')
     or not has_table_privilege('service_role', 'public.blocks', 'insert') then
    raise exception 'FAIL: service_role is missing a table grant';
  end if;

  if not has_schema_privilege('service_role', 'private', 'usage')
     or not has_function_privilege('service_role', 'private.my_block_partners()', 'execute')
     or not has_function_privilege('service_role', 'private.my_hidden_profiles()', 'execute')
     or not has_function_privilege('service_role', 'public.set_my_school(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.list_posts(text, timestamptz, uuid, integer)', 'execute')
     or not has_function_privilege('service_role', 'public.list_follows(uuid, text, timestamptz, uuid, integer)', 'execute')
     or not has_function_privilege('service_role', 'public.follows_before_insert()', 'execute')
     or not has_function_privilege('service_role', 'public.handle_new_user()', 'execute') then
    raise exception 'FAIL: service_role is missing a function grant';
  end if;

  raise notice 'ok: private avatar bucket, webp allowed, service_role grants';
end $$;

set local role anon;

do $$
declare
  n int;
begin
  select count(*) into n from public.schools where slug = 'qa-app-ativa';
  if n <> 1 then
    raise exception 'FAIL: anon cannot read an active school';
  end if;

  select count(*) into n
  from public.schools
  where slug = 'qa-app-inativa'
     or active = false;
  if n <> 0 then
    raise exception 'FAIL: anon can see an inactive school (%)', n;
  end if;

  select count(*) into n
  from storage.objects
  where bucket_id = 'avatars';
  if n <> 0 then
    raise exception 'FAIL: anon can read avatars (%)', n;
  end if;

  raise notice 'ok: anon sees only active schools and no avatars';
end $$;

reset role;
set local role authenticated;

do $$
declare
  n int;
  school_name text;
  school_short text;
begin
  select name, short_name into school_name, school_short
  from public.schools
  where slug = 'qa-app-inativa';
  if school_name is distinct from 'QA App Inativa' or school_short is distinct from 'QAI' then
    raise exception 'FAIL: authenticated user lost an inactive school (% %)', school_name, school_short;
  end if;

  select count(*) into n
  from public.schools
  where active = true
    and slug = 'qa-app-inativa';
  if n <> 0 then
    raise exception 'FAIL: active filter includes an inactive school';
  end if;

  select count(*) into n
  from public.schools
  where active = true
    and slug = 'qa-app-ativa';
  if n <> 1 then
    raise exception 'FAIL: authenticated user cannot list an active school';
  end if;

  select count(*) into n
  from storage.objects
  where bucket_id = 'avatars'
    and name = 'aa000000-0000-4000-8000-00000000000a/face.webp';
  if n <> 1 then
    raise exception 'FAIL: authenticated user cannot read an avatar (%)', n;
  end if;

  raise notice 'ok: authenticated users read inactive school names and avatars';
end $$;

reset role;
set local role service_role;

do $$
declare
  school_short text;
begin
  select short_name into school_short
  from public.schools
  where slug = 'qa-app-inativa';
  if school_short is distinct from 'QAI' then
    raise exception 'FAIL: service_role cannot read an inactive school (%)', school_short;
  end if;
  raise notice 'ok: service_role can read schools';
end $$;

rollback;
