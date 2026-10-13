-- Proves the pre-deploy pass: private profiles, photo deletes, list_follows,
-- follows inserted by seed/admin, and the real schools.
-- Run in the Supabase SQL Editor (as postgres) after 0007_pre_deploy.sql.
-- The script starts a transaction and rolls it back, so it leaves no data.
-- A failing check aborts with FAIL: ...
-- Schools used below are created in this test. The placeholders from 0001 are inactive.

begin;

do $$
declare
  n int;
  total int;
  short text;
  is_active boolean;
  got_city text;
begin
  select count(*) into n
  from public.schools s
  where (s.slug, s.name, s.short_name, s.city, s.kind, s.active) in (
    ('unifacs', 'Unifacs – Universidade Salvador', 'Unifacs', 'Salvador', 'universidade', true),
    ('ufba', 'UFBA – Universidade Federal da Bahia', 'UFBA', 'Salvador', 'universidade', true),
    ('uneb', 'UNEB – Universidade do Estado da Bahia', 'UNEB', 'Salvador', 'universidade', true),
    ('unijorge', 'UniJorge', 'UniJorge', 'Salvador', 'universidade', true),
    ('unime-salvador', 'Unime – Salvador', 'Unime SSA', 'Salvador', 'universidade', true),
    ('unime-lauro-de-freitas', 'Unime – Lauro de Freitas', 'Unime Lauro', 'Lauro de Freitas', 'universidade', true),
    ('sartre-salvador', 'Colégio Sartre – Salvador', 'Sartre SSA', 'Salvador', 'escola', true),
    ('sartre-lauro-de-freitas', 'Colégio Sartre – Lauro de Freitas', 'Sartre Lauro', 'Lauro de Freitas', 'escola', true),
    ('marista-salvador', 'Colégio Marista', 'Marista', 'Salvador', 'escola', true),
    ('vieira-salvador', 'Colégio Vieira', 'Vieira', 'Salvador', 'escola', true)
  );
  if n <> 10 then
    raise exception 'FAIL: real schools missing or wrong (%)', n;
  end if;

  select count(*) into n
  from public.schools
  where active
    and slug not in (
      'unifacs', 'ufba', 'uneb', 'unijorge', 'unime-salvador', 'unime-lauro-de-freitas',
      'sartre-salvador', 'sartre-lauro-de-freitas', 'marista-salvador', 'vieira-salvador'
    );
  if n <> 0 then
    raise exception 'FAIL: a school outside the real ten is active';
  end if;

  select count(*) into n
  from public.schools
  where name in ('[ESCOLA_1]', '[ESCOLA_2]', '[ESCOLA_3]')
    and active = false;
  if n <> 3 then
    raise exception 'FAIL: fictional schools should stay and be inactive (%)', n;
  end if;

  select count(*) into total from public.schools;
  update public.schools
  set short_name = 'TEMP', city = 'X', active = false
  where slug = 'vieira-salvador';

  insert into public.schools (slug, name, short_name, city, kind, active)
  values
    ('unifacs', 'Unifacs – Universidade Salvador', 'Unifacs', 'Salvador', 'universidade', true),
    ('ufba', 'UFBA – Universidade Federal da Bahia', 'UFBA', 'Salvador', 'universidade', true),
    ('uneb', 'UNEB – Universidade do Estado da Bahia', 'UNEB', 'Salvador', 'universidade', true),
    ('unijorge', 'UniJorge', 'UniJorge', 'Salvador', 'universidade', true),
    ('unime-salvador', 'Unime – Salvador', 'Unime SSA', 'Salvador', 'universidade', true),
    ('unime-lauro-de-freitas', 'Unime – Lauro de Freitas', 'Unime Lauro', 'Lauro de Freitas', 'universidade', true),
    ('sartre-salvador', 'Colégio Sartre – Salvador', 'Sartre SSA', 'Salvador', 'escola', true),
    ('sartre-lauro-de-freitas', 'Colégio Sartre – Lauro de Freitas', 'Sartre Lauro', 'Lauro de Freitas', 'escola', true),
    ('marista-salvador', 'Colégio Marista', 'Marista', 'Salvador', 'escola', true),
    ('vieira-salvador', 'Colégio Vieira', 'Vieira', 'Salvador', 'escola', true)
  on conflict (slug) do update
  set
    name = excluded.name,
    short_name = excluded.short_name,
    city = excluded.city,
    kind = excluded.kind,
    active = true;

  if (select count(*) from public.schools) <> total then
    raise exception 'FAIL: running the school seed again duplicated rows';
  end if;
  if (select count(*) from public.schools where slug = 'vieira-salvador') <> 1 then
    raise exception 'FAIL: vieira slug is not unique after the second seed';
  end if;

  select short_name, city, active
  into short, got_city, is_active
  from public.schools
  where slug = 'vieira-salvador';
  if short is distinct from 'Vieira' or got_city is distinct from 'Salvador' or is_active is not true then
    raise exception 'FAIL: second seed did not restore Vieira (% % %)', short, got_city, is_active;
  end if;

  raise notice 'ok: ten real schools, inactive placeholders, seed is idempotent';
end $$;

insert into public.schools (id, name, short_name, slug, active)
values
  ('d1111111-1111-4111-8111-111111111111', 'QA Pre Deploy', 'QPD', 'qa-pre-deploy', true),
  ('d2222222-2222-4222-8222-222222222222', 'QA Pre Inativa', 'QPI', 'qa-pre-inativa', false);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role anon;

do $$
declare
  n int;
  item text;
  calls text[] := array[
    'list_follows|select * from public.list_follows(''00000000-0000-0000-0000-000000000000''::uuid, ''seguidores'', null, null, 20)',
    'follow_stats|select * from public.follow_stats(''00000000-0000-0000-0000-000000000000''::uuid)',
    'list_posts|select * from public.list_posts(''geral'', null, null, 20)',
    'get_post|select * from public.get_post(''00000000-0000-0000-0000-000000000000''::uuid)',
    'list_author_posts|select * from public.list_author_posts(''00000000-0000-0000-0000-000000000000''::uuid, null, null, 20)',
    'list_comments|select * from public.list_comments(''00000000-0000-0000-0000-000000000000''::uuid, null, null, 50)',
    'list_blocks|select * from public.list_blocks(null, null, 20)'
  ];
begin
  select count(*) into n from public.schools where slug = 'ufba';
  if n <> 1 then
    raise exception 'FAIL: anon cannot read an active school';
  end if;

  select count(*) into n from public.schools where slug = 'qa-pre-deploy';
  if n <> 1 then
    raise exception 'FAIL: anon cannot read a test active school';
  end if;

  select count(*) into n
  from public.schools
  where slug in ('qa-pre-inativa', 'escola-1')
     or name like '[ESCOLA_%]'
     or active = false;
  if n <> 0 then
    raise exception 'FAIL: anon can see an inactive school (%)', n;
  end if;

  begin
    perform 1 from public.profiles;
    raise exception 'FAIL: anon read profiles';
  exception
    when insufficient_privilege then
      raise notice 'ok: anon cannot read profiles';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: anon profile read failed for the wrong reason (%)', sqlerrm;
  end;

  foreach item in array calls
  loop
    begin
      execute split_part(item, '|', 2);
      raise exception 'FAIL: anon called %', split_part(item, '|', 1);
    exception
      when insufficient_privilege then
        null;
      when others then
        if sqlerrm like 'FAIL:%' then
          raise;
        end if;
        raise exception 'FAIL: anon % failed for the wrong reason (%)', split_part(item, '|', 1), sqlerrm;
    end;
  end loop;

  raise notice 'ok: anon sees only active schools and cannot call profile functions';
end $$;

reset role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  id,
  'authenticated',
  'authenticated',
  email,
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '', '', '', ''
from (
  values
    ('aa000000-0000-4000-8000-00000000000a'::uuid, 'pre-ana@theyep.test'),
    ('b0000000-0000-4000-8000-000000000001'::uuid, 'pre-b1@theyep.test'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, 'pre-b2@theyep.test'),
    ('b0000000-0000-4000-8000-000000000003'::uuid, 'pre-b3@theyep.test'),
    ('c0000000-0000-4000-8000-000000000001'::uuid, 'pre-c1@theyep.test'),
    ('c0000000-0000-4000-8000-000000000002'::uuid, 'pre-c2@theyep.test'),
    ('c0000000-0000-4000-8000-000000000003'::uuid, 'pre-c3@theyep.test'),
    ('d0000000-0000-4000-8000-00000000000d'::uuid, 'pre-davi@theyep.test'),
    ('e0000000-0000-4000-8000-00000000000e'::uuid, 'pre-eva@theyep.test')
) as people(id, email);

update public.profiles
set
  name = case id::text
    when 'aa000000-0000-4000-8000-00000000000a' then 'Ana'
    when 'b0000000-0000-4000-8000-000000000001' then 'B1'
    when 'b0000000-0000-4000-8000-000000000002' then 'B2'
    when 'b0000000-0000-4000-8000-000000000003' then 'B3'
    when 'c0000000-0000-4000-8000-000000000001' then 'C1'
    when 'c0000000-0000-4000-8000-000000000002' then 'C2'
    when 'c0000000-0000-4000-8000-000000000003' then 'C3'
    when 'd0000000-0000-4000-8000-00000000000d' then 'Davi'
    else 'Eva'
  end,
  school_id = 'd1111111-1111-4111-8111-111111111111'
where id in (
  'aa000000-0000-4000-8000-00000000000a',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003',
  'd0000000-0000-4000-8000-00000000000d',
  'e0000000-0000-4000-8000-00000000000e'
);

insert into storage.objects (bucket_id, name)
values
  ('post-photos', 'aa000000-0000-4000-8000-00000000000a/used.jpg'),
  ('post-photos', 'aa000000-0000-4000-8000-00000000000a/orphan.jpg');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aa000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-00000000000a', true);
set local role authenticated;

insert into public.posts (text, photo_path, to_general, to_campus)
values (
  'com foto',
  'aa000000-0000-4000-8000-00000000000a/used.jpg',
  true,
  false
);

do $$
declare
  n int;
begin
  delete from storage.objects
  where bucket_id = 'post-photos'
    and name = 'aa000000-0000-4000-8000-00000000000a/used.jpg';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'FAIL: owner deleted a photo that a post uses (%)', n;
  end if;

  if not exists (
    select 1
    from storage.objects
    where name = 'aa000000-0000-4000-8000-00000000000a/used.jpg'
  ) then
    raise exception 'FAIL: published photo row disappeared';
  end if;

  delete from storage.objects
  where bucket_id = 'post-photos'
    and name = 'aa000000-0000-4000-8000-00000000000a/orphan.jpg';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: owner could not delete an orphan photo (%)', n;
  end if;

  delete from public.posts
  where photo_path = 'aa000000-0000-4000-8000-00000000000a/used.jpg';

  delete from storage.objects
  where bucket_id = 'post-photos'
    and name = 'aa000000-0000-4000-8000-00000000000a/used.jpg';
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'FAIL: owner could not delete the photo after the post was removed (%)', n;
  end if;

  raise notice 'ok: published photo stays, orphan and post-delete cleanup work';
end $$;

insert into public.posts (text, to_general, to_campus)
values ('ola pre', true, false);

insert into public.comments (post_id, text)
select id, 'um comentario'
from public.posts
where text = 'ola pre';

do $$
declare
  n int;
  seen text;
  post_id uuid;
begin
  select name into seen
  from public.profiles
  where id = 'aa000000-0000-4000-8000-00000000000a';
  if seen is distinct from 'Ana' then
    raise exception 'FAIL: authenticated user cannot read a profile (%)', seen;
  end if;

  select count(*) into n from public.list_posts('geral', null, null, 20) where text = 'ola pre';
  if n <> 1 then
    raise exception 'FAIL: authenticated list_posts missed the post (%)', n;
  end if;

  select id into post_id from public.posts where text = 'ola pre';

  select count(*) into n from public.get_post(post_id) where text = 'ola pre';
  if n <> 1 then
    raise exception 'FAIL: authenticated get_post missed the post';
  end if;

  select count(*) into n
  from public.list_author_posts('aa000000-0000-4000-8000-00000000000a', null, null, 20)
  where text = 'ola pre';
  if n <> 1 then
    raise exception 'FAIL: authenticated list_author_posts missed the post';
  end if;

  select author_name into seen
  from public.list_comments(post_id, null, null, 50)
  where text = 'um comentario';
  if seen is distinct from 'Ana' then
    raise exception 'FAIL: authenticated list_comments missed the author (%)', seen;
  end if;

  perform * from public.follow_stats('aa000000-0000-4000-8000-00000000000a');
  perform * from public.list_follows('aa000000-0000-4000-8000-00000000000a', 'seguidores', null, null, 20);
  perform * from public.list_blocks(null, null, 20);

  raise notice 'ok: authenticated user can read profiles and call profile functions';
end $$;

do $$
begin
  begin
    insert into public.follows (following_id)
    values ('aa000000-0000-4000-8000-00000000000a');
    raise exception 'FAIL: self-follow was inserted';
  exception
    when check_violation then
      raise notice 'ok: authenticated self-follow rejected';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: self-follow failed for the wrong reason (%)', sqlerrm;
  end;
end $$;

insert into public.follows (following_id)
values ('b0000000-0000-4000-8000-000000000001');

do $$
declare
  follower uuid;
begin
  select follower_id into follower
  from public.follows
  where following_id = 'b0000000-0000-4000-8000-000000000001';
  if follower is distinct from 'aa000000-0000-4000-8000-00000000000a' then
    raise exception 'FAIL: authenticated follow did not force follower_id (%)', follower;
  end if;
  raise notice 'ok: authenticated follow forces follower_id';
end $$;

reset role;
grant insert (follower_id, following_id) on public.follows to authenticated;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aa000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-00000000000a', true);
set local role authenticated;

do $$
begin
  begin
    insert into public.follows (follower_id, following_id)
    values (
      'b0000000-0000-4000-8000-000000000002',
      'b0000000-0000-4000-8000-000000000003'
    );
    raise exception 'FAIL: followed as another user';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      if sqlerrm not like '%cannot follow as another user%' then
        raise exception 'FAIL: forged follow failed for the wrong reason (%)', sqlerrm;
      end if;
      raise notice 'ok: authenticated cannot follow as another user';
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
begin
  insert into public.blocks (blocked_id)
  values ('e0000000-0000-4000-8000-00000000000e');

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
    values ('e0000000-0000-4000-8000-00000000000e');
    raise exception 'FAIL: followed a blocked profile';
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

  if missing_state is distinct from '23503' or blocked_state is distinct from missing_state then
    raise exception 'FAIL: follow sqlstate missing=% blocked=%', missing_state, blocked_state;
  end if;
  if blocked_message is distinct from missing_message then
    raise exception 'FAIL: follow message differs missing=% blocked=%', missing_message, blocked_message;
  end if;
  if blocked_detail is distinct from missing_detail
     and replace(
       coalesce(missing_detail, ''),
       'abababab-abab-4aba-8aba-abababababab',
       'e0000000-0000-4000-8000-00000000000e'
     ) is distinct from coalesce(blocked_detail, '') then
    raise exception 'FAIL: follow detail differs missing=% blocked=%', missing_detail, blocked_detail;
  end if;
  raise notice 'ok: authenticated block follow matches a missing profile';
end $$;

reset role;

delete from public.follows
where follower_id in (
  'aa000000-0000-4000-8000-00000000000a',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003'
)
or following_id in (
  'aa000000-0000-4000-8000-00000000000a',
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000003'
);

insert into public.follows (follower_id, following_id, created_at)
values
  (
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    '2020-01-01 00:00:00+00'
  );

do $$
declare
  got timestamptz;
  follower uuid;
begin
  select follower_id, created_at
  into follower, got
  from public.follows
  where follower_id = 'b0000000-0000-4000-8000-000000000002'
    and following_id = 'b0000000-0000-4000-8000-000000000001';
  if follower is distinct from 'b0000000-0000-4000-8000-000000000002'
     or got is distinct from '2020-01-01 00:00:00+00' then
    raise exception 'FAIL: postgres follow was rewritten (% %)', follower, got;
  end if;
  raise notice 'ok: postgres can insert a follow with follower_id and created_at';
end $$;

delete from public.follows
where follower_id = 'b0000000-0000-4000-8000-000000000002'
  and following_id = 'b0000000-0000-4000-8000-000000000001';

set local role service_role;

insert into public.follows (follower_id, following_id, created_at)
values (
  'c0000000-0000-4000-8000-000000000002',
  'c0000000-0000-4000-8000-000000000001',
  '2021-02-02 00:00:00+00'
);

do $$
declare
  got timestamptz;
begin
  begin
    insert into public.follows (follower_id, following_id)
    values (
      'aa000000-0000-4000-8000-00000000000a',
      'aa000000-0000-4000-8000-00000000000a'
    );
    raise exception 'FAIL: service_role self-follow was inserted';
  exception
    when check_violation then
      raise notice 'ok: service_role self-follow rejected';
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
      raise exception 'FAIL: service_role self-follow failed for the wrong reason (%)', sqlerrm;
  end;

  select created_at into got
  from public.follows
  where follower_id = 'c0000000-0000-4000-8000-000000000002'
    and following_id = 'c0000000-0000-4000-8000-000000000001';
  if got is distinct from '2021-02-02 00:00:00+00' then
    raise exception 'FAIL: service_role follow was rewritten (%)', got;
  end if;
  raise notice 'ok: service_role can insert a follow with follower_id';
end $$;

reset role;

delete from public.follows
where follower_id = 'c0000000-0000-4000-8000-000000000002'
  and following_id = 'c0000000-0000-4000-8000-000000000001';

insert into public.follows (follower_id, following_id, created_at)
values
  ('b0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-00000000000a', '2024-01-03 00:00:00+00'),
  ('b0000000-0000-4000-8000-000000000003', 'aa000000-0000-4000-8000-00000000000a', '2024-01-02 00:00:00+00'),
  ('b0000000-0000-4000-8000-000000000002', 'aa000000-0000-4000-8000-00000000000a', '2024-01-02 00:00:00+00'),
  ('aa000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000001', '2024-01-03 00:00:00+00'),
  ('aa000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000003', '2024-01-02 00:00:00+00'),
  ('aa000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000002', '2024-01-02 00:00:00+00');

select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'aa000000-0000-4000-8000-00000000000a', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'aa000000-0000-4000-8000-00000000000a', true);
set local role authenticated;

do $$
declare
  ids uuid[];
  cursor_id uuid;
  cursor_at timestamptz;
  short text;
  followers bigint;
  following_count bigint;
begin
  select coalesce(array_agg(x.profile_id order by x.n), '{}'), max(x.school_short_name)
  into ids, short
  from (
    select profile_id, school_short_name, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguidores',
      null,
      null,
      20
    )
  ) x;

  if ids <> array[
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000002'
  ]::uuid[] then
    raise exception 'FAIL: seguidores order %', ids;
  end if;
  if short is distinct from 'QPD' then
    raise exception 'FAIL: seguidores school %', short;
  end if;

  select x.profile_id, x.followed_at
  into cursor_id, cursor_at
  from (
    select profile_id, followed_at, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguidores',
      null,
      null,
      2
    )
  ) x
  where x.n = 2;

  if cursor_id is distinct from 'b0000000-0000-4000-8000-000000000003' then
    raise exception 'FAIL: seguidores page cursor %', cursor_id;
  end if;

  select coalesce(array_agg(x.profile_id order by x.n), '{}')
  into ids
  from (
    select profile_id, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguidores',
      cursor_at,
      cursor_id,
      20
    )
  ) x;

  if ids <> array['b0000000-0000-4000-8000-000000000002']::uuid[] then
    raise exception 'FAIL: seguidores second page %', ids;
  end if;

  select coalesce(array_agg(x.profile_id order by x.n), '{}')
  into ids
  from (
    select profile_id, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguindo',
      null,
      null,
      20
    )
  ) x;

  if ids <> array[
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000003',
    'c0000000-0000-4000-8000-000000000002'
  ]::uuid[] then
    raise exception 'FAIL: seguindo order %', ids;
  end if;

  select x.profile_id, x.followed_at
  into cursor_id, cursor_at
  from (
    select profile_id, followed_at, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguindo',
      null,
      null,
      2
    )
  ) x
  where x.n = 2;

  select coalesce(array_agg(x.profile_id order by x.n), '{}')
  into ids
  from (
    select profile_id, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguindo',
      cursor_at,
      cursor_id,
      20
    )
  ) x;

  if ids <> array['c0000000-0000-4000-8000-000000000002']::uuid[] then
    raise exception 'FAIL: seguindo second page %', ids;
  end if;

  select s.followers, s.following_count
  into followers, following_count
  from public.follow_stats('aa000000-0000-4000-8000-00000000000a') s;
  if followers <> 3 or following_count <> 3 then
    raise exception 'FAIL: follow stats % / %', followers, following_count;
  end if;

  raise notice 'ok: list_follows order and pagination match both directions';
end $$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', 'd0000000-0000-4000-8000-00000000000d', 'role', 'authenticated')::text,
  true
);
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-00000000000d', true);
set local role authenticated;

insert into public.blocks (blocked_id)
values ('c0000000-0000-4000-8000-000000000003');

do $$
declare
  ids uuid[];
begin
  select coalesce(array_agg(x.profile_id order by x.n), '{}')
  into ids
  from (
    select profile_id, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguindo',
      null,
      null,
      2
    )
  ) x;

  if ids <> array[
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002'
  ]::uuid[] then
    raise exception 'FAIL: block left a hole in seguindo %', ids;
  end if;

  select coalesce(array_agg(x.profile_id order by x.n), '{}')
  into ids
  from (
    select profile_id, row_number() over () as n
    from public.list_follows(
      'aa000000-0000-4000-8000-00000000000a',
      'seguidores',
      null,
      null,
      20
    )
  ) x;

  if ids <> array[
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000002'
  ]::uuid[] then
    raise exception 'FAIL: block hid an unrelated follower %', ids;
  end if;

  raise notice 'ok: list_follows hides a blocked profile and keeps the rest in order';
end $$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

do $$
declare
  n int;
  hot uuid;
begin
  select id into hot from public.posts where text = 'ola pre';
  select count(*) into n from public.list_comments(hot, null, null, 50);
  if n <> 0 then
    raise exception 'FAIL: list_comments returned rows without a session (%)', n;
  end if;
  if not exists (select 1 from public.comments c where c.post_id = hot) then
    raise exception 'FAIL: the comment row is gone';
  end if;
  raise notice 'ok: list_comments returns nothing when auth.uid() is null';
end $$;

rollback;
