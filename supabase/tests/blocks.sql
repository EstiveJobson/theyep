-- Proves blocks are one-way to read, mutual to enforce, and do not weaken Campus.
-- Run in the Supabase SQL Editor (as postgres) after 0006_blocks.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

insert into public.schools (id, name, short_name, active)
values
  ('e1111111-1111-4111-8111-111111111111', 'QA Block Escola 1', 'BE1', true),
  ('e2222222-2222-4222-8222-222222222222', 'QA Block Escola 2', 'BE2', true);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'e3333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'blocks-a@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e4444444-4444-4444-8444-444444444444',
    'authenticated', 'authenticated', 'blocks-b@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'e5555555-5555-4555-8555-555555555555',
    'authenticated', 'authenticated', 'blocks-c@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

update public.profiles
set name = 'A', school_id = 'e1111111-1111-4111-8111-111111111111'
where id = 'e3333333-3333-4333-8333-333333333333';

update public.profiles
set name = 'B', school_id = 'e2222222-2222-4222-8222-222222222222'
where id = 'e4444444-4444-4444-8444-444444444444';

update public.profiles
set name = 'C', school_id = 'e1111111-1111-4111-8111-111111111111'
where id = 'e5555555-5555-4555-8555-555555555555';

do $$
begin
  if (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'blocks_blocked_id_idx'
  ) <> 1 then
    raise exception 'FAIL: blocks index on blocked_id is missing';
  end if;
  raise notice 'ok: blocked_id index exists';
end $$;

-- A
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.blocks (blocked_id)
    values ('e3333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: self-block was inserted';
  exception
    when check_violation then
      raise notice 'ok: self-block rejected';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: self-block failed for the wrong reason (%)', sqlerrm;
  end;

  if exists (
    select 1
    from public.blocks
    where blocker_id = 'e3333333-3333-4333-8333-333333333333'
      and blocked_id = 'e3333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'FAIL: self-block row remained';
  end if;
end $$;

insert into public.posts (text, to_general, to_campus)
values ('a geral', true, false);

insert into public.posts (text, to_general, to_campus)
values ('a campus', false, true);

insert into public.follows (following_id)
values ('e4444444-4444-4444-8444-444444444444');

insert into public.follows (following_id)
values ('e5555555-5555-4555-8555-555555555555');

-- B
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

insert into public.posts (text, to_general, to_campus)
values ('b geral', true, false);

insert into public.posts (text, to_general, to_campus)
values ('b campus', false, true);

insert into public.follows (following_id)
values ('e3333333-3333-4333-8333-333333333333');

insert into public.follows (following_id)
values ('e5555555-5555-4555-8555-555555555555');

insert into public.comments (post_id, text)
select id, 'b em a'
from public.posts
where text = 'a geral';

-- C
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e5555555-5555-4555-8555-555555555555', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e5555555-5555-4555-8555-555555555555', true);
set local role authenticated;

insert into public.posts (text, to_general, to_campus)
values ('c geral', true, false);

insert into public.posts (text, to_general, to_campus)
values ('c campus', false, true);

insert into public.follows (following_id)
values ('e3333333-3333-4333-8333-333333333333');

-- A comments on B, then blocks B
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

insert into public.comments (post_id, text)
select id, 'a em b'
from public.posts
where text = 'b geral';

-- B comments on C's general post (visible to A and C)
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

insert into public.comments (post_id, text)
select id, 'b em c'
from public.posts
where text = 'c geral';

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
declare
  n int;
  a_geral uuid;
begin
  select id into a_geral from public.posts where text = 'a geral';
  if a_geral is null then
    raise exception 'FAIL: a geral post is missing';
  end if;
  perform set_config('app.a_geral', a_geral::text, true);

  select count(*) into n from public.comments where text in ('b em a', 'a em b', 'b em c');
  if n <> 3 then
    raise exception 'FAIL: comments were not created before the block (%)', n;
  end if;
end $$;

insert into public.blocks (blocked_id)
values ('e4444444-4444-4444-8444-444444444444');

do $$
begin
  begin
    insert into public.blocks (blocked_id)
    values ('e4444444-4444-4444-8444-444444444444');
    raise exception 'FAIL: duplicate block was inserted';
  exception
    when unique_violation then
      raise notice 'ok: duplicate block rejected';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: duplicate block failed for the wrong reason (%)', sqlerrm;
  end;

  if (
    select count(*)
    from public.blocks
    where blocker_id = 'e3333333-3333-4333-8333-333333333333'
      and blocked_id = 'e4444444-4444-4444-8444-444444444444'
  ) <> 1 then
    raise exception 'FAIL: block row count is not 1';
  end if;
end $$;

do $$
begin
  begin
    update public.blocks
    set created_at = now()
    where blocker_id = 'e3333333-3333-4333-8333-333333333333';
    raise exception 'FAIL: update was allowed';
  exception
    when insufficient_privilege then
      raise notice 'ok: cannot update blocks';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: update failed for the wrong reason (%)', sqlerrm;
  end;
end $$;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.follows
  where (follower_id = 'e3333333-3333-4333-8333-333333333333' and following_id = 'e4444444-4444-4444-8444-444444444444')
     or (follower_id = 'e4444444-4444-4444-8444-444444444444' and following_id = 'e3333333-3333-4333-8333-333333333333');
  if n <> 0 then
    raise exception 'FAIL: follows between A and B remained (% )', n;
  end if;

  if not exists (
    select 1
    from public.follows
    where follower_id = 'e3333333-3333-4333-8333-333333333333'
      and following_id = 'e5555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'FAIL: unrelated follow A to C was removed';
  end if;
  raise notice 'ok: block removed follows in both directions only';
end $$;

-- B cannot see the block, A's profile, or A's posts, and cannot engage.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

do $$
declare
  n int;
  blocked boolean;
begin
  select public.is_blocked_between(
    'e3333333-3333-4333-8333-333333333333',
    'e4444444-4444-4444-8444-444444444444'
  ) into blocked;
  if blocked is distinct from true then
    raise exception 'FAIL: is_blocked_between did not return true';
  end if;

  select count(*) into n from public.blocks;
  if n <> 0 then
    raise exception 'FAIL: B can read block rows (%)', n;
  end if;

  select count(*) into n
  from public.profiles
  where id = 'e3333333-3333-4333-8333-333333333333';
  if n <> 0 then
    raise exception 'FAIL: B can read A profile';
  end if;

  select count(*) into n
  from public.posts
  where text in ('a geral', 'a campus');
  if n <> 0 then
    raise exception 'FAIL: B can read A posts';
  end if;

  select count(*) into n
  from public.list_posts('geral', null, null, 20)
  where text = 'a geral';
  if n <> 0 then
    raise exception 'FAIL: geral feed leaked A to B';
  end if;

  select count(*) into n
  from public.list_author_posts('e3333333-3333-4333-8333-333333333333', null, null, 20);
  if n <> 0 then
    raise exception 'FAIL: A profile posts leaked to B';
  end if;

  select count(*) into n
  from public.comments
  where text in ('a em b', 'b em a');
  if n <> 0 then
    raise exception 'FAIL: comments between A and B are visible to B';
  end if;

  -- A cannot see this row (B is blocked), so check it as B.
  if not exists (
    select 1
    from public.follows
    where follower_id = 'e4444444-4444-4444-8444-444444444444'
      and following_id = 'e5555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'FAIL: unrelated follow B to C was removed';
  end if;
  raise notice 'ok: B cannot see the block, A, or their posts and comments';
end $$;

do $$
begin
  begin
    delete from public.blocks
    where blocker_id = 'e3333333-3333-4333-8333-333333333333'
      and blocked_id = 'e4444444-4444-4444-8444-444444444444';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: B delete of A block raised (%)', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.likes (post_id)
    values (current_setting('app.a_geral')::uuid);
    raise exception 'FAIL: B liked A post';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: B cannot like A (%)', sqlerrm;
  end;

  begin
    insert into public.comments (post_id, text)
    values (current_setting('app.a_geral')::uuid, 'nao devia');
    raise exception 'FAIL: B commented on A';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: B cannot comment on A (%)', sqlerrm;
  end;

  begin
    insert into public.follows (following_id)
    values ('e3333333-3333-4333-8333-333333333333');
    raise exception 'FAIL: B followed A while blocked';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: B cannot follow A (%)', sqlerrm;
  end;
end $$;

-- A still sees B's profile, but not B's posts, comments, or list entry.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
declare
  n int;
  seen_name text;
begin
  select count(*), max(name) into n, seen_name
  from public.profiles
  where id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 1 or seen_name is distinct from 'B' then
    raise exception 'FAIL: A cannot read B profile (% %)', n, seen_name;
  end if;

  select count(*) into n
  from public.posts
  where text in ('b geral', 'b campus');
  if n <> 0 then
    raise exception 'FAIL: A can read B posts';
  end if;

  select count(*) into n
  from public.comments
  where text in ('b em a', 'a em b', 'b em c');
  if n <> 0 then
    raise exception 'FAIL: A can read B comments';
  end if;

  select count(*) into n
  from public.list_follows('e3333333-3333-4333-8333-333333333333', 'seguindo', null, null, 20)
  where profile_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 0 then
    raise exception 'FAIL: B still appears in A following list';
  end if;

  select count(*) into n
  from public.list_follows('e3333333-3333-4333-8333-333333333333', 'seguidores', null, null, 20)
  where profile_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 0 then
    raise exception 'FAIL: B still appears in A followers list';
  end if;

  select count(*) into n
  from public.list_follows('e5555555-5555-4555-8555-555555555555', 'seguidores', null, null, 20)
  where profile_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 0 then
    raise exception 'FAIL: A can see B in C followers';
  end if;

  begin
    insert into public.follows (following_id)
    values ('e4444444-4444-4444-8444-444444444444');
    raise exception 'FAIL: A followed B while blocked';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: A cannot follow B (%)', sqlerrm;
  end;
  raise notice 'ok: A still reads B profile but not posts, comments, or lists';
end $$;

-- C still sees A's campus post and not B's, and still sees B's comment on C.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e5555555-5555-4555-8555-555555555555', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e5555555-5555-4555-8555-555555555555', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where text = 'a campus';
  if n <> 1 then
    raise exception 'FAIL: C lost A campus post';
  end if;

  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where text = 'b campus';
  if n <> 0 then
    raise exception 'FAIL: C can see the other school campus post';
  end if;

  select count(*) into n
  from public.list_author_posts('e3333333-3333-4333-8333-333333333333', null, null, 20)
  where text = 'a campus';
  if n <> 1 then
    raise exception 'FAIL: C cannot see A campus post on the profile';
  end if;

  select count(*) into n
  from public.comments
  where text = 'b em c';
  if n <> 1 then
    raise exception 'FAIL: C lost B comment on C post';
  end if;

  select count(*) into n
  from public.list_follows('e5555555-5555-4555-8555-555555555555', 'seguidores', null, null, 20)
  where profile_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 1 then
    raise exception 'FAIL: C cannot see B in their own followers';
  end if;
  raise notice 'ok: campus rule still holds for C';
end $$;

-- The block row must still exist after B's delete attempt.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.blocks
  where blocker_id = 'e3333333-3333-4333-8333-333333333333'
    and blocked_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 1 then
    raise exception 'FAIL: B was able to remove A block';
  end if;
  raise notice 'ok: B cannot delete A block';
end $$;

delete from public.blocks
where blocker_id = 'e3333333-3333-4333-8333-333333333333'
  and blocked_id = 'e4444444-4444-4444-8444-444444444444';

do $$
declare
  n int;
begin
  select count(*) into n
  from public.follows
  where (follower_id = 'e3333333-3333-4333-8333-333333333333' and following_id = 'e4444444-4444-4444-8444-444444444444')
     or (follower_id = 'e4444444-4444-4444-8444-444444444444' and following_id = 'e3333333-3333-4333-8333-333333333333');
  if n <> 0 then
    raise exception 'FAIL: unblocking restored follows';
  end if;
  raise notice 'ok: unblocking does not restore follows';
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n from public.posts where text = 'a geral';
  if n <> 1 then
    raise exception 'FAIL: B still cannot see A general post after unblock';
  end if;

  select count(*) into n from public.posts where text = 'a campus';
  if n <> 0 then
    raise exception 'FAIL: unblock revealed the other school campus post';
  end if;

  select count(*) into n
  from public.profiles
  where id = 'e3333333-3333-4333-8333-333333333333';
  if n <> 1 then
    raise exception 'FAIL: B still cannot read A profile after unblock';
  end if;
  raise notice 'ok: unblock restores visibility but not the other school campus';
end $$;

insert into public.follows (following_id)
values ('e3333333-3333-4333-8333-333333333333');

-- Block again, then delete A. Blocks in both directions go away. B blocking C stays.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e3333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e3333333-3333-4333-8333-333333333333', true);
set local role authenticated;

insert into public.blocks (blocked_id)
values ('e4444444-4444-4444-8444-444444444444');

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e5555555-5555-4555-8555-555555555555', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e5555555-5555-4555-8555-555555555555', true);
set local role authenticated;

insert into public.blocks (blocked_id)
values ('e3333333-3333-4333-8333-333333333333');

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'e4444444-4444-4444-8444-444444444444', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-8444-444444444444', true);
set local role authenticated;

insert into public.blocks (blocked_id)
values ('e5555555-5555-4555-8555-555555555555');

reset role;

delete from auth.users
where id = 'e3333333-3333-4333-8333-333333333333';

do $$
declare
  n int;
begin
  select count(*) into n
  from public.blocks
  where blocker_id = 'e3333333-3333-4333-8333-333333333333'
     or blocked_id = 'e3333333-3333-4333-8333-333333333333';
  if n <> 0 then
    raise exception 'FAIL: deleting A left blocks (% )', n;
  end if;

  if not exists (
    select 1
    from public.blocks
    where blocker_id = 'e4444444-4444-4444-8444-444444444444'
      and blocked_id = 'e5555555-5555-4555-8555-555555555555'
  ) then
    raise exception 'FAIL: deleting A removed an unrelated block';
  end if;

  if exists (
    select 1 from public.profiles where id = 'e3333333-3333-4333-8333-333333333333'
  ) then
    raise exception 'FAIL: deleting the auth user left the profile';
  end if;
  raise notice 'ok: deleting the auth user removes blocks in both directions';
end $$;

rollback;
