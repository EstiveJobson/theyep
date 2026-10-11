-- Proves likes and comments follow post visibility.
-- Run in the Supabase SQL Editor (as postgres) after 0004_likes_comments.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...

begin;

insert into public.schools (id, name, short_name, active)
values
  ('44444444-4444-4444-8444-444444444444', 'QA Escola 1', 'E1', true),
  ('55555555-5555-4555-8555-555555555555', 'QA Escola 2', 'E2', true);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated', 'authenticated', 'likes-a@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated', 'authenticated', 'likes-b@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated', 'authenticated', 'likes-c@theyep.test', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

insert into public.profiles (id, name, school_id)
values
  ('11111111-1111-4111-8111-111111111111', 'Ana', '44444444-4444-4444-8444-444444444444'),
  ('22222222-2222-4222-8222-222222222222', 'Bruno', '55555555-5555-4555-8555-555555555555'),
  ('33333333-3333-4333-8333-333333333333', 'Caio', '44444444-4444-4444-8444-444444444444')
on conflict (id) do update
set name = excluded.name, school_id = excluded.school_id;

select set_config('app.user_a', '11111111-1111-4111-8111-111111111111', true);
select set_config('app.user_b', '22222222-2222-4222-8222-222222222222', true);
select set_config('app.user_c', '33333333-3333-4333-8333-333333333333', true);

select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
declare
  new_id uuid;
begin
  insert into public.posts (text, to_general, to_campus)
  values ('só o campus', false, true)
  returning id into new_id;
  perform set_config('app.campus_post', new_id::text, true);

  insert into public.posts (text, to_general, to_campus)
  values ('para todo mundo', true, false)
  returning id into new_id;
  perform set_config('app.general_post', new_id::text, true);
end $$;

reset role;

-- Bruno is at the other school.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.posts
  where id = current_setting('app.campus_post')::uuid;
  if n <> 0 then
    raise exception 'FAIL: other school can see the campus post';
  end if;
  raise notice 'ok: campus post hidden';
end $$;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.get_post(current_setting('app.campus_post')::uuid);
  if n <> 0 then
    raise exception 'FAIL: get_post leaked the campus post';
  end if;
  raise notice 'ok: get_post hides the campus post';
end $$;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where id = current_setting('app.campus_post')::uuid;
  if n <> 0 then
    raise exception 'FAIL: campus feed leaked the other school';
  end if;
  raise notice 'ok: campus feed stays in school';
end $$;

do $$
begin
  begin
    insert into public.likes (post_id)
    values (current_setting('app.campus_post')::uuid);
    raise exception 'FAIL: other school liked the campus post';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: campus like blocked (%)', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.comments (post_id, text)
    values (current_setting('app.campus_post')::uuid, 'não devia');
    raise exception 'FAIL: other school commented on the campus post';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: campus comment blocked (%)', sqlerrm;
  end;
end $$;

do $$
declare
  new_id uuid;
begin
  insert into public.likes (post_id)
  values (current_setting('app.general_post')::uuid);

  begin
    insert into public.likes (post_id)
    values (current_setting('app.general_post')::uuid);
    raise exception 'FAIL: duplicate like was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: duplicate like rejected (%)', sqlerrm;
  end;

  insert into public.comments (post_id, text)
  values (current_setting('app.general_post')::uuid, 'comentário do Bruno')
  returning id into new_id;
  perform set_config('app.comment_b', new_id::text, true);
  raise notice 'ok: like and comment on a general post';
end $$;

do $$
declare
  likes bigint;
  mine boolean;
begin
  select like_count, liked_by_me
  into likes, mine
  from public.list_posts('geral', null, null, 20)
  where id = current_setting('app.general_post')::uuid;
  if likes is distinct from 1 or mine is distinct from true then
    raise exception 'FAIL: feed like state is % liked %', likes, mine;
  end if;
  raise notice 'ok: feed returns like count and liked_by_me';
end $$;

do $$
declare
  n int;
begin
  delete from public.likes
  where post_id = current_setting('app.general_post')::uuid
    and user_id = current_setting('app.user_b')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: unlike did not remove the like';
  end if;

  select count(*) into n
  from public.likes
  where post_id = current_setting('app.general_post')::uuid
    and user_id = current_setting('app.user_b')::uuid;
  if n <> 0 then
    raise exception 'FAIL: like still there after unlike';
  end if;
  raise notice 'ok: unlike';

  insert into public.likes (post_id)
  values (current_setting('app.general_post')::uuid);
end $$;

do $$
begin
  begin
    update public.likes set created_at = now();
    raise exception 'FAIL: like update was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: like update blocked (%)', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.comments (post_id, text)
    values (current_setting('app.general_post')::uuid, repeat('a', 301));
    raise exception 'FAIL: 301 character comment was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: 301 character comment rejected (%)', sqlerrm;
  end;
end $$;

do $$
begin
  begin
    insert into public.comments (post_id, text)
    values (current_setting('app.general_post')::uuid, '   ');
    raise exception 'FAIL: blank comment was accepted';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise notice 'ok: blank comment rejected (%)', sqlerrm;
  end;
end $$;

do $$
declare
  new_id uuid;
  got int;
begin
  insert into public.comments (post_id, text)
  values (current_setting('app.general_post')::uuid, repeat('b', 300))
  returning id into new_id;
  select char_length(text) into got from public.comments where id = new_id;
  if got <> 300 then
    raise exception 'FAIL: 300 character comment was stored as %', got;
  end if;
  delete from public.comments where id = new_id;
  raise notice 'ok: 300 character comment';
end $$;

reset role;

-- Caio can read the general post, but he did not write the comment and he does not own the post.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '33333333-3333-4333-8333-333333333333', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
set local role authenticated;

do $$
declare
  n int;
begin
  select count(*) into n
  from public.list_posts('campus', null, null, 20)
  where id = current_setting('app.campus_post')::uuid;
  if n <> 1 then
    raise exception 'FAIL: same school cannot see the campus post';
  end if;
  raise notice 'ok: same school sees the campus post';
end $$;

do $$
declare
  n int;
begin
  delete from public.comments where id = current_setting('app.comment_b')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: third person deleted a comment';
  end if;

  select count(*) into n
  from public.comments
  where id = current_setting('app.comment_b')::uuid;
  if n <> 1 then
    raise exception 'FAIL: comment disappeared after the third person tried to delete it';
  end if;
  raise notice 'ok: third person cannot delete';
end $$;

reset role;

-- Bruno deletes his own comment, then writes another one for Ana to remove.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
set local role authenticated;

do $$
declare
  n int;
  new_id uuid;
begin
  delete from public.comments where id = current_setting('app.comment_b')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: author could not delete their own comment';
  end if;
  raise notice 'ok: comment author can delete';

  insert into public.comments (post_id, text)
  values (current_setting('app.general_post')::uuid, 'apaga esse, Ana')
  returning id into new_id;
  perform set_config('app.comment_b2', new_id::text, true);
end $$;

reset role;

-- Ana deletes Bruno's comment because she wrote the post, and checks campus engagement.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
declare
  n int;
begin
  delete from public.comments where id = current_setting('app.comment_b2')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: post author could not delete someone else''s comment';
  end if;
  raise notice 'ok: post author can delete a comment';

  insert into public.likes (post_id)
  values (current_setting('app.campus_post')::uuid);
  insert into public.comments (post_id, text)
  values (current_setting('app.campus_post')::uuid, 'só a escola vê');

  delete from public.posts where id = current_setting('app.campus_post')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: author could not delete the campus post';
  end if;
end $$;

reset role;

do $$
declare
  likes int;
  comments int;
begin
  select count(*) into likes from public.likes where post_id = current_setting('app.campus_post')::uuid;
  select count(*) into comments from public.comments where post_id = current_setting('app.campus_post')::uuid;
  if likes <> 0 or comments <> 0 then
    raise exception 'FAIL: deleting the post left % likes and % comments', likes, comments;
  end if;
  raise notice 'ok: deleting a post removes likes and comments';
end $$;

do $$
declare
  posts int;
  likes int;
  comments int;
begin
  delete from public.profiles where id = current_setting('app.user_b')::uuid;
  select count(*) into likes from public.likes where user_id = current_setting('app.user_b')::uuid;
  select count(*) into comments from public.comments where user_id = current_setting('app.user_b')::uuid;
  select count(*) into posts from public.posts where id = current_setting('app.general_post')::uuid;
  if likes <> 0 or comments <> 0 or posts <> 1 then
    raise exception 'FAIL: profile delete left likes %, comments %, post %', likes, comments, posts;
  end if;
  raise notice 'ok: deleting a profile removes that person''s likes and comments';
end $$;

rollback;
