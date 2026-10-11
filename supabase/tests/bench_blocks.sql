-- Timings for the block checks. Safe to run in the SQL editor: it rolls back.
-- About 10k blocks, 20k posts, 10k follows, and one post with 1000 comments.
-- Prints Execution Time for the home feed, get_post, follow_stats, list_follows
-- and list_comments. Needs 0006 applied. Run as postgres, not as the API role.

begin;

create or replace function pg_temp.bench_user(n integer)
returns uuid
language sql
immutable
as $$
  select (
    'c' || lpad(to_hex(n), 7, '0') || '-1111-4111-8111-' || lpad(to_hex(n), 12, '0')
  )::uuid;
$$;

create or replace function pg_temp.bench_post(n integer)
returns uuid
language sql
immutable
as $$
  select (
    'd' || lpad(to_hex(n), 7, '0') || '-1111-4111-8111-' || lpad(to_hex(n), 12, '0')
  )::uuid;
$$;

insert into public.schools (id, name, short_name, active)
values ('c0000000-0000-4000-8000-000000000001', 'QA Bench Escola', 'QBE', true);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  pg_temp.bench_user(n),
  'authenticated',
  'authenticated',
  'bench-' || n || '@theyep.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', ''
from generate_series(1, 4000) as n;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'c1111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'bench-viewer@theyep.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', ''
);

update public.profiles
set name = 'Bench ' || id::text,
    school_id = 'c0000000-0000-4000-8000-000000000001'
where id = 'c1111111-1111-4111-8111-111111111111'
   or id in (select pg_temp.bench_user(n) from generate_series(1, 2000) as n);

alter table public.blocks disable trigger user;
alter table public.posts disable trigger user;
alter table public.follows disable trigger user;
alter table public.comments disable trigger user;

-- 4000 + 4000 pairs among the bench users, plus 2000 blocks owned by the viewer.
insert into public.blocks (blocker_id, blocked_id)
select pg_temp.bench_user(n), pg_temp.bench_user(1 + (n % 4000))
from generate_series(1, 4000) as n;

insert into public.blocks (blocker_id, blocked_id)
select pg_temp.bench_user(n), pg_temp.bench_user(1 + ((n + 17) % 4000))
from generate_series(1, 4000) as n
where 1 + ((n + 17) % 4000) <> n
  and 1 + ((n + 17) % 4000) <> 1 + (n % 4000);

insert into public.blocks (blocker_id, blocked_id)
select 'c1111111-1111-4111-8111-111111111111', pg_temp.bench_user(n)
from generate_series(2001, 4000) as n;

insert into public.posts (
  id, author_id, text, to_general, to_campus, school_id, created_at, like_count, comment_count
)
select
  pg_temp.bench_post(n),
  pg_temp.bench_user(1 + ((n - 1) % 4000)),
  'bench post ' || n,
  true,
  (n % 5 = 0),
  case when n % 5 = 0 then 'c0000000-0000-4000-8000-000000000001'::uuid else null end,
  now() - make_interval(secs => n),
  0,
  case when n = 1 then 1000 else 0 end
from generate_series(1, 20000) as n;

insert into public.follows (follower_id, following_id, created_at)
select pg_temp.bench_user(n), pg_temp.bench_user(1), now() - make_interval(secs => n)
from generate_series(2, 4000) as n;

insert into public.follows (follower_id, following_id, created_at)
select
  'c1111111-1111-4111-8111-111111111111',
  pg_temp.bench_user(n),
  now() - make_interval(secs => n)
from generate_series(1, 400) as n;

insert into public.follows (follower_id, following_id, created_at)
select
  pg_temp.bench_user(1 + ((n * 3) % 4000)),
  pg_temp.bench_user(1 + ((n * 11) % 4000)),
  now() - make_interval(secs => n)
from generate_series(1, 6000) as n
where 1 + ((n * 3) % 4000) <> 1 + ((n * 11) % 4000)
on conflict do nothing;

insert into public.comments (post_id, user_id, text, created_at)
select
  pg_temp.bench_post(1),
  pg_temp.bench_user(1 + ((n - 1) % 1500)),
  'comentario ' || n,
  now() + make_interval(secs => n)
from generate_series(1, 1000) as n;

alter table public.blocks enable trigger user;
alter table public.posts enable trigger user;
alter table public.follows enable trigger user;
alter table public.comments enable trigger user;

analyze public.blocks;
analyze public.posts;
analyze public.follows;
analyze public.comments;
analyze public.profiles;
analyze public.likes;

do $$
declare
  n_blocks bigint;
  n_posts bigint;
  n_follows bigint;
  n_comments bigint;
begin
  select count(*) into n_blocks from public.blocks;
  select count(*) into n_posts from public.posts;
  select count(*) into n_follows from public.follows;
  select count(*) into n_comments from public.comments where post_id = pg_temp.bench_post(1);
  raise notice 'bench rows blocks=% posts=% follows=% comments_on_hot=%',
    n_blocks, n_posts, n_follows, n_comments;
end $$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'c1111111-1111-4111-8111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
set local role authenticated;

do $$
declare
  line text;
  queries text[] := array[
    'list_posts geral|select * from public.list_posts(''geral'', null, null, 20)',
    'list_posts campus|select * from public.list_posts(''campus'', null, null, 20)',
    'list_posts seguindo|select * from public.list_posts(''seguindo'', null, null, 20)',
    'get_post|select * from public.get_post(''' || pg_temp.bench_post(1)::text || ''')',
    'follow_stats|select * from public.follow_stats(''' || pg_temp.bench_user(1)::text || ''')',
    'list_follows|select * from public.list_follows(''' || pg_temp.bench_user(1)::text || ''', ''seguidores'', null, null, 20)',
    'list_comments|select * from public.list_comments(''' || pg_temp.bench_post(1)::text || ''', null, null, 50)'
  ];
  item text;
  label text;
  query text;
begin
  foreach item in array queries
  loop
    label := split_part(item, '|', 1);
    query := split_part(item, '|', 2);
    for line in execute 'explain (analyze, timing) ' || query
    loop
      if line like 'Execution Time:%' or line like 'Planning Time:%' then
        raise notice 'bench % %', label, line;
      end if;
    end loop;
  end loop;
end $$;

rollback;
