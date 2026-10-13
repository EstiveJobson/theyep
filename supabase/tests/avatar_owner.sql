-- Proves 0009: avatar_url is null or {own user id}/{file}.
-- Run in the Supabase SQL Editor (as postgres) after 0009_avatar_owner.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aa000000-0000-4000-8000-00000000000a',
    'authenticated',
    'authenticated',
    'avatar-ana@theyep.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'bb000000-0000-4000-8000-00000000000b',
    'authenticated',
    'authenticated',
    'avatar-bia@theyep.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '', '', '', ''
  );

-- The upgrade keeps a value only when the whole string already matches.
-- '{id}/s%20x.jpg?token=abc' must become null, not '{id}/s'.
alter table public.profiles drop constraint profiles_avatar_path_check;

update public.profiles
set avatar_url = 'aa000000-0000-4000-8000-00000000000a/s%20x.jpg?token=abc'
where id = 'aa000000-0000-4000-8000-00000000000a';

update public.profiles
set avatar_url = 'bb000000-0000-4000-8000-00000000000b/face.webp'
where id = 'bb000000-0000-4000-8000-00000000000b';

update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~ ('^' || id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]*$');

do $$
declare
  ana text;
  bia text;
begin
  select avatar_url into ana
  from public.profiles
  where id = 'aa000000-0000-4000-8000-00000000000a';
  if ana is not null then
    raise exception 'FAIL: encoded avatar URL was kept or rewritten (%)', ana;
  end if;

  select avatar_url into bia
  from public.profiles
  where id = 'bb000000-0000-4000-8000-00000000000b';
  if bia is distinct from 'bb000000-0000-4000-8000-00000000000b/face.webp' then
    raise exception 'FAIL: a valid avatar path was cleared (%)', bia;
  end if;

  raise notice 'ok: upgrade clears non-matching avatar values without rewriting them';
end $$;

alter table public.profiles
  add constraint profiles_avatar_path_check
  check (
    avatar_url is null
    or avatar_url ~ ('^' || id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]*$')
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"aa000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-00000000000a', true);
set local role authenticated;

do $$
begin
  update public.profiles
  set avatar_url = 'aa000000-0000-4000-8000-00000000000a/face.webp'
  where id = 'aa000000-0000-4000-8000-00000000000a';
  if not found then
    raise exception 'FAIL: own avatar path was not saved';
  end if;

  update public.profiles
  set avatar_url = null
  where id = 'aa000000-0000-4000-8000-00000000000a';

  begin
    update public.profiles
    set avatar_url = 'bb000000-0000-4000-8000-00000000000b/face.webp'
    where id = 'aa000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: stored another user''s avatar path';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: foreign avatar path failed for the wrong reason (%)', sqlerrm;
  end;

  begin
    update public.profiles
    set avatar_url = 'https://proj.supabase.co/storage/v1/object/public/avatars/aa000000-0000-4000-8000-00000000000a/face.webp'
    where id = 'aa000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: stored a full avatar URL';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: avatar URL failed for the wrong reason (%)', sqlerrm;
  end;

  begin
    update public.profiles
    set avatar_url = 'aa000000-0000-4000-8000-00000000000a/..'
    where id = 'aa000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: stored .. as an avatar file';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: .. avatar path failed for the wrong reason (%)', sqlerrm;
  end;

  begin
    update public.profiles
    set avatar_url = 'aa000000-0000-4000-8000-00000000000a/.'
    where id = 'aa000000-0000-4000-8000-00000000000a';
    raise exception 'FAIL: stored . as an avatar file';
  exception
    when check_violation then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: . avatar path failed for the wrong reason (%)', sqlerrm;
  end;

  raise notice 'ok: avatar_url is null or the owner folder';
end $$;

rollback;
