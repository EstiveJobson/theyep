-- Proves blocks are one-way to read, mutual to enforce, and do not weaken Campus.
-- There is no public function that answers "did A block B?".
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

insert into public.likes (post_id)
select id from public.posts where text = 'c geral';

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
  perform set_config(
    'app.c_geral',
    (select id::text from public.posts where text = 'c geral'),
    true
  );

  select count(*) into n from public.comments where text in ('b em a', 'a em b', 'b em c');
  if n <> 3 then
    raise exception 'FAIL: comments were not created before the block (%)', n;
  end if;
end $$;

insert into public.likes (post_id)
select id from public.posts where text = 'c geral';

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
begin
  begin
    execute 'select public.is_blocked_between($1, $2)'
      using
        'e3333333-3333-4333-8333-333333333333'::uuid,
        'e4444444-4444-4444-8444-444444444444'::uuid;
    raise exception 'FAIL: B could call is_blocked_between';
  exception
    when undefined_function then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: is_blocked_between failed differently (%)', sqlerrm;
  end;

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
declare
  missing_state text;
  missing_message text;
  missing_detail text;
  blocked_state text;
  blocked_message text;
  blocked_detail text;
  n int;
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

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.c_geral')::uuid
    and user_id = 'e3333333-3333-4333-8333-333333333333';
  if n <> 0 then
    raise exception 'FAIL: B can see A like on C post';
  end if;

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.c_geral')::uuid
    and user_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 1 then
    raise exception 'FAIL: B lost their own like on C post';
  end if;

  begin
    insert into public.follows (following_id)
    values ('abababab-abab-4aba-8aba-abababababab');
    raise exception 'FAIL: followed a missing profile';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      get stacked diagnostics
        missing_state = returned_sqlstate,
        missing_message = message_text,
        missing_detail = pg_exception_detail;
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
      get stacked diagnostics
        blocked_state = returned_sqlstate,
        blocked_message = message_text,
        blocked_detail = pg_exception_detail;
  end;

  if missing_state is distinct from '23503'
     or blocked_state is distinct from missing_state then
    raise exception 'FAIL: follow sqlstate missing=% blocked=%', missing_state, blocked_state;
  end if;
  if blocked_message is distinct from missing_message then
    raise exception 'FAIL: follow message differs missing=% blocked=%', missing_message, blocked_message;
  end if;
  if blocked_detail is distinct from missing_detail
     and replace(
       coalesce(missing_detail, ''),
       'abababab-abab-4aba-8aba-abababababab',
       'e3333333-3333-4333-8333-333333333333'
     ) is distinct from coalesce(blocked_detail, '') then
    raise exception 'FAIL: follow detail differs missing=% blocked=%', missing_detail, blocked_detail;
  end if;
  raise notice 'ok: follow during a block matches a missing profile';
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

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.c_geral')::uuid
    and user_id = 'e4444444-4444-4444-8444-444444444444';
  if n <> 0 then
    raise exception 'FAIL: A can see B like on C post';
  end if;

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.c_geral')::uuid
    and user_id = 'e3333333-3333-4333-8333-333333333333';
  if n <> 1 then
    raise exception 'FAIL: A lost their own like on C post';
  end if;

  select like_count into n
  from public.posts
  where id = current_setting('app.c_geral')::uuid;
  if n <> 2 then
    raise exception 'FAIL: like_count dropped a hidden like (%)', n;
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

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.c_geral')::uuid
    and user_id in (
      'e3333333-3333-4333-8333-333333333333',
      'e4444444-4444-4444-8444-444444444444'
    );
  if n <> 2 then
    raise exception 'FAIL: C lost a like that is not part of C''s block (%)', n;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.proname in ('is_blocked_between', 'my_block_partners', 'my_hidden_profiles')
  ) then
    raise exception 'FAIL: block helper is exposed in public';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prosrc ilike '%is_blocked_between%'
  ) then
    raise exception 'FAIL: a public function still mentions is_blocked_between';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'private'
      and p.proname = 'my_block_partners'
      and p.prosecdef
  ) or not exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'private'
      and p.proname = 'my_hidden_profiles'
      and p.prosecdef
  ) then
    raise exception 'FAIL: private block helpers are missing';
  end if;

  begin
    execute 'select public.is_blocked_between($1, $2)'
      using
        'e5555555-5555-4555-8555-555555555555'::uuid,
        'e3333333-3333-4333-8333-333333333333'::uuid;
    raise exception 'FAIL: is_blocked_between returned a row';
  exception
    when undefined_function then
      null;
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: is_blocked_between failed differently (%)', sqlerrm;
  end;

  select count(*) into n from public.blocks;
  if n <> 0 then
    raise exception 'FAIL: C can read a block between A and B (%)', n;
  end if;

  select count(*) into n
  from public.profiles
  where id in (
    'e3333333-3333-4333-8333-333333333333',
    'e4444444-4444-4444-8444-444444444444'
  );
  if n <> 2 then
    raise exception 'FAIL: C lost a profile that did not block them';
  end if;
  raise notice 'ok: campus rule still holds for C';
  raise notice 'ok: no public block oracle';
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
