-- Proves follows, the Seguindo feed, and account-deletion cascade.
-- Run in the Supabase SQL Editor (as postgres) after 0005_follows.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

do $$
begin
  if (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in ('follows_following_created_idx', 'follows_follower_created_idx')
  ) <> 2 then
    raise exception 'FAIL: follow indexes missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('follower_count', 'following_count')
  ) then
    raise exception 'FAIL: follow counts are stored on profiles';
  end if;

  raise notice 'ok: indexes exist and counts are not stored';
end $$;

insert into public.schools (id, name, short_name, active)
values
  ('a1111111-1111-4111-8111-111111111111', 'QA Follow A', 'FA', true),
  ('b2222222-2222-4222-8222-222222222222', 'QA Follow B', 'FB', true);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'c1111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'follows-a@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c2222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'follows-b@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c3333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'follows-c@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'c4444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'follows-d@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

update public.profiles
set name = 'Ana', school_id = 'a1111111-1111-4111-8111-111111111111'
where id = 'c1111111-1111-4111-8111-111111111111';

update public.profiles
set name = 'Bruno', school_id = 'b2222222-2222-4222-8222-222222222222'
where id = 'c2222222-2222-4222-8222-222222222222';

update public.profiles
set name = 'Caio', school_id = 'a1111111-1111-4111-8111-111111111111'
where id = 'c3333333-3333-4333-8333-333333333333';

update public.profiles
set name = 'Davi', school_id = 'b2222222-2222-4222-8222-222222222222'
where id = 'c4444444-4444-4444-8444-444444444444';

-- Ana.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.follows (following_id)
    values ('c1111111-1111-4111-8111-111111111111');
    raise exception 'FAIL: self-follow was inserted';
  exception
    when check_violation then
      raise notice 'ok: self-follow rejected (%)', sqlerrm;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: self-follow failed for the wrong reason (%)', sqlerrm;
  end;

  if exists (
    select 1
    from public.follows
    where follower_id = 'c1111111-1111-4111-8111-111111111111'
      and following_id = 'c1111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'FAIL: a self-follow row remains';
  end if;
end $$;

do $$
begin
  insert into public.follows (following_id)
  values ('c2222222-2222-4222-8222-222222222222');

  begin
    insert into public.follows (following_id)
    values ('c2222222-2222-4222-8222-222222222222');
    raise exception 'FAIL: duplicate follow was inserted';
  exception
    when unique_violation then
      raise notice 'ok: duplicate follow rejected';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: duplicate follow failed for the wrong reason (%)', sqlerrm;
  end;

  if (
    select count(*)
    from public.follows
    where follower_id = 'c1111111-1111-4111-8111-111111111111'
      and following_id = 'c2222222-2222-4222-8222-222222222222'
  ) <> 1 then
    raise exception 'FAIL: Ana does not follow Bruno exactly once';
  end if;
end $$;

do $$
begin
  begin
    insert into public.follows (follower_id, following_id)
    values (
      'c2222222-2222-4222-8222-222222222222',
      'c3333333-3333-4333-8333-333333333333'
    );
    raise exception 'FAIL: inserted a follow as another user';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: cannot follow as another user (%)', sqlerrm;
  end;

  if exists (
    select 1
    from public.follows
    where follower_id = 'c2222222-2222-4222-8222-222222222222'
      and following_id = 'c3333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'FAIL: a forged follow row remains';
  end if;
end $$;

insert into public.follows (following_id)
values ('c3333333-3333-4333-8333-333333333333');

reset role;

-- Bruno.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c2222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
set local role authenticated;

insert into public.follows (following_id)
values ('c1111111-1111-4111-8111-111111111111');

do $$
declare
  n int;
begin
  delete from public.follows
  where follower_id = 'c1111111-1111-4111-8111-111111111111'
    and following_id = 'c2222222-2222-4222-8222-222222222222';

  select count(*) into n
  from public.follows
  where follower_id = 'c1111111-1111-4111-8111-111111111111'
    and following_id = 'c2222222-2222-4222-8222-222222222222';

  if n <> 1 then
    raise exception 'FAIL: Bruno deleted Ana''s follow';
  end if;
  raise notice 'ok: cannot delete another user''s follow';
end $$;

do $$
begin
  begin
    update public.follows
    set created_at = now()
    where follower_id = 'c2222222-2222-4222-8222-222222222222';
    raise exception 'FAIL: update was allowed';
  exception
    when insufficient_privilege then
      raise notice 'ok: cannot update follows';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: update failed for the wrong reason (%)', sqlerrm;
  end;
end $$;

reset role;
set local role anon;

do $$
begin
  begin
    perform 1 from public.follows;
    raise exception 'FAIL: anon read follows';
  exception
    when insufficient_privilege then
      raise notice 'ok: anon cannot read follows';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: anon read failed for the wrong reason (%)', sqlerrm;
  end;
end $$;

reset role;

-- Posts. Bruno is at the other school. Caio shares Ana's school.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c2222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
set local role authenticated;

insert into public.posts (text, to_general, to_campus)
values
  ('bruno campus', false, true),
  ('bruno geral', true, false),
  ('bruno ambos', true, true);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

insert into public.posts (text, to_general, to_campus)
values
  ('ana campus', false, true),
  ('ana geral', true, false);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

insert into public.posts (text, to_general, to_campus)
values ('caio campus', false, true);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
declare
  n int;
  followers bigint;
  following_count bigint;
  viewer_follows boolean;
begin
  select count(*) into n from public.posts where text = 'bruno campus';
  if n <> 0 then
    raise exception 'FAIL: Ana can read Bruno''s campus post directly';
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'bruno campus';
  if n <> 0 then
    raise exception 'FAIL: Seguindo showed another school''s campus post';
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'bruno geral';
  if n <> 1 then
    raise exception 'FAIL: Seguindo hid a followed Geral post (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'bruno ambos';
  if n <> 1 then
    raise exception 'FAIL: a Geral+Campus post should appear once in Seguindo (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'caio campus';
  if n <> 1 then
    raise exception 'FAIL: same-school campus post missing from Seguindo (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'ana geral';
  if n <> 0 then
    raise exception 'FAIL: Seguindo included Ana''s own post';
  end if;

  select count(*) into n
  from public.list_author_posts('c2222222-2222-4222-8222-222222222222', null, null, 20)
  where text = 'bruno campus';
  if n <> 0 then
    raise exception 'FAIL: profile posts leaked another school''s campus post';
  end if;

  select count(*) into n
  from public.list_author_posts('c2222222-2222-4222-8222-222222222222', null, null, 20)
  where text = 'bruno geral';
  if n <> 1 then
    raise exception 'FAIL: profile hid a Geral post (%)', n;
  end if;

  select count(*) into n
  from public.list_author_posts('c3333333-3333-4333-8333-333333333333', null, null, 20)
  where text = 'caio campus';
  if n <> 1 then
    raise exception 'FAIL: same-school campus post missing on the profile (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('geral', null, null, 20)
  where text = 'bruno geral';
  if n <> 1 then
    raise exception 'FAIL: Geral tab changed (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('geral', null, null, 20)
  where text = 'bruno campus';
  if n <> 0 then
    raise exception 'FAIL: Geral tab showed a campus-only post';
  end if;

  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where text = 'caio campus';
  if n <> 1 then
    raise exception 'FAIL: Campus tab hid a same-school post (%)', n;
  end if;

  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where text = 'bruno campus';
  if n <> 0 then
    raise exception 'FAIL: Campus tab showed another school';
  end if;

  select s.followers, s.following_count, s.viewer_follows
  into followers, following_count, viewer_follows
  from public.follow_stats('c2222222-2222-4222-8222-222222222222') s;

  if followers <> 1 or following_count <> 1 or viewer_follows is distinct from true then
    raise exception 'FAIL: Bruno stats % / % / %', followers, following_count, viewer_follows;
  end if;

  if followers is distinct from (
    select count(*) from public.follows
    where following_id = 'c2222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'FAIL: follower count is not the row count';
  end if;

  raise notice 'ok: Seguindo and profile posts respect campus privacy';
  raise notice 'ok: counts come from follow rows';
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c2222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.posts where text = 'ana campus';
  if n <> 0 then
    raise exception 'FAIL: Bruno can read Ana''s campus post directly';
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'ana campus';
  if n <> 0 then
    raise exception 'FAIL: Bruno''s Seguindo showed Ana''s campus post';
  end if;

  select count(*) into n
  from public.list_posts('seguindo', null, null, 20)
  where text = 'ana geral';
  if n <> 1 then
    raise exception 'FAIL: Bruno''s Seguindo hid Ana''s Geral post (%)', n;
  end if;

  select count(*) into n
  from public.list_author_posts('c1111111-1111-4111-8111-111111111111', null, null, 20)
  where text = 'ana campus';
  if n <> 0 then
    raise exception 'FAIL: Bruno sees Ana''s campus post on her profile';
  end if;

  select count(*) into n
  from public.list_author_posts('c1111111-1111-4111-8111-111111111111', null, null, 20)
  where text = 'ana geral';
  if n <> 1 then
    raise exception 'FAIL: Bruno cannot see Ana''s Geral post on her profile';
  end if;

  raise notice 'ok: the other school stays hidden on the profile';
end $$;

reset role;

-- Newest follow first. Owner can set created_at; signed-in users cannot.
update public.follows
set created_at = now() - interval '2 minutes'
where follower_id = 'c1111111-1111-4111-8111-111111111111'
  and following_id = 'c2222222-2222-4222-8222-222222222222';

update public.follows
set created_at = now() - interval '1 minute'
where follower_id = 'c1111111-1111-4111-8111-111111111111'
  and following_id = 'c3333333-3333-4333-8333-333333333333';

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
declare
  first_id uuid;
begin
  select profile_id into first_id
  from public.list_follows(
    'c1111111-1111-4111-8111-111111111111',
    'seguindo',
    null,
    null,
    20
  )
  limit 1;

  if first_id is distinct from 'c3333333-3333-4333-8333-333333333333' then
    raise exception 'FAIL: following list is not newest first (%)', first_id;
  end if;
  raise notice 'ok: following list is newest first';
end $$;

reset role;

-- Davi follows Ana, and Ana follows Davi, so both directions can be checked.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c1111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

insert into public.follows (following_id)
values ('c4444444-4444-4444-8444-444444444444');

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'c4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'c4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

insert into public.follows (following_id)
values ('c1111111-1111-4111-8111-111111111111');

reset role;

delete from public.profiles
where id = 'c2222222-2222-4222-8222-222222222222';

do $$
begin
  if exists (select 1 from public.profiles where id = 'c2222222-2222-4222-8222-222222222222') then
    raise exception 'FAIL: Bruno''s profile was not deleted';
  end if;

  if exists (
    select 1
    from public.follows
    where follower_id = 'c2222222-2222-4222-8222-222222222222'
       or following_id = 'c2222222-2222-4222-8222-222222222222'
  ) then
    raise exception 'FAIL: deleting the profile left follows';
  end if;

  if not exists (
    select 1
    from public.follows
    where follower_id = 'c1111111-1111-4111-8111-111111111111'
      and following_id = 'c3333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'FAIL: deleting Bruno removed an unrelated follow';
  end if;

  if not exists (
    select 1
    from public.follows
    where follower_id = 'c1111111-1111-4111-8111-111111111111'
      and following_id = 'c4444444-4444-4444-8444-444444444444'
  ) or not exists (
    select 1
    from public.follows
    where follower_id = 'c4444444-4444-4444-8444-444444444444'
      and following_id = 'c1111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'FAIL: Davi follows were removed with Bruno';
  end if;

  raise notice 'ok: deleting a profile removes follows in both directions';
end $$;

delete from auth.users
where id = 'c4444444-4444-4444-8444-444444444444';

do $$
begin
  if exists (select 1 from public.profiles where id = 'c4444444-4444-4444-8444-444444444444') then
    raise exception 'FAIL: deleting the auth user left the profile';
  end if;

  if exists (
    select 1
    from public.follows
    where follower_id = 'c4444444-4444-4444-8444-444444444444'
       or following_id = 'c4444444-4444-4444-8444-444444444444'
  ) then
    raise exception 'FAIL: deleting the auth user left follows';
  end if;

  if not exists (
    select 1
    from public.follows
    where follower_id = 'c1111111-1111-4111-8111-111111111111'
      and following_id = 'c3333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'FAIL: deleting Davi removed Ana''s follow of Caio';
  end if;

  raise notice 'ok: deleting the auth user cascades follows in both directions';
end $$;

rollback;
