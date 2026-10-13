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

  raise notice 'ok: avatar_url is null or the owner folder';
end $$;

rollback;
