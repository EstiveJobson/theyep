-- TheYep: block another person.
-- Run once after 0005_follows.sql.
-- The client inserts only blocked_id. The trigger sets blocker_id and created_at.
-- The blocked person cannot read the blocks table.
--
-- Who is in a block with the caller is NOT a public function. PostgREST would
-- expose public.is_blocked_between(any, any) and anyone could ask who blocked
-- whom. The helpers live in schema private, which is not an exposed API schema.
-- Do not add "private" to the Data API exposed schemas. authenticated can
-- execute them only so policies can. They return ids for the caller, never an
-- arbitrary pair, and they are not reachable at /rest/v1/rpc/.
--
-- Blocking deletes follows in both directions. Unblocking does not put them back.
-- like_count and comment_count stay as stored totals. A block hides rows, not
-- those counters (v1).
--
-- Account deletion: profiles.id references auth.users on delete cascade (0001).
-- Both block columns reference profiles on delete cascade, so deleting the auth
-- user removes the profile and every block in both directions.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

-- Ids of everyone in a block with the caller, either direction.
-- Not granted through the Data API: schema private is not exposed.
create or replace function private.my_block_partners()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    array_agg(
      case
        when b.blocker_id = (select auth.uid()) then b.blocked_id
        else b.blocker_id
      end
    ),
    '{}'
  )
  from public.blocks b
  where b.blocker_id = (select auth.uid())
     or b.blocked_id = (select auth.uid());
$$;

-- Ids of people who blocked the caller. Not the people the caller blocked,
-- so the blocker can still read that profile while the other person cannot.
create or replace function private.my_hidden_profiles()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(b.blocker_id), '{}')
  from public.blocks b
  where b.blocked_id = (select auth.uid());
$$;

revoke all on function private.my_block_partners() from public, anon;
revoke all on function private.my_hidden_profiles() from public, anon;
grant execute on function private.my_block_partners() to authenticated;
grant execute on function private.my_hidden_profiles() to authenticated;

create or replace function public.blocks_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if new.blocker_id is not null and new.blocker_id is distinct from uid then
    raise exception 'cannot block as another user';
  end if;

  new.blocker_id := uid;
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.blocks_before_insert() from public, anon;
grant execute on function public.blocks_before_insert() to authenticated;

drop trigger if exists blocks_before_insert on public.blocks;
create trigger blocks_before_insert
  before insert on public.blocks
  for each row
  execute function public.blocks_before_insert();

alter table public.blocks enable row level security;

revoke all on public.blocks from public, anon, authenticated;

grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

drop policy if exists "le os proprios bloqueios" on public.blocks;
create policy "le os proprios bloqueios"
  on public.blocks
  for select
  to authenticated
  using (blocker_id = (select auth.uid()));

drop policy if exists "bloqueia alguem" on public.blocks;
create policy "bloqueia alguem"
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = (select auth.uid()));

drop policy if exists "desbloqueia" on public.blocks;
create policy "desbloqueia"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- Each person can only delete their own follow, so this runs as the owner.
create or replace function public.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.follows f
  where (f.follower_id = new.blocker_id and f.following_id = new.blocked_id)
     or (f.follower_id = new.blocked_id and f.following_id = new.blocker_id);
  return new;
end;
$$;

revoke all on function public.blocks_after_insert() from public, anon, authenticated;

drop trigger if exists blocks_after_insert on public.blocks;
create trigger blocks_after_insert
  after insert on public.blocks
  for each row
  execute function public.blocks_after_insert();

-- Posts: same audience as 0002, plus neither side of a block can see the post.
-- The partner list is one InitPlan, not a function call per row.
drop policy if exists "le posts do feed" on public.posts;
create policy "le posts do feed"
  on public.posts
  for select
  to authenticated
  using (
    author_id not in (select unnest(private.my_block_partners()))
    and (
      to_general
      or (
        to_campus
        and school_id is not null
        and school_id = (
          select p.school_id
          from public.profiles p
          where p.id = (select auth.uid())
        )
      )
    )
  );

-- security invoker, so the posts policy above still applies on top of this.
create or replace function public.can_read_post(p_post uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.posts p
      where p.id = p_post
        and p.author_id not in (select unnest(private.my_block_partners()))
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (
              select pr.school_id
              from public.profiles pr
              where pr.id = (select auth.uid())
            )
          )
        )
    );
$$;

revoke all on function public.can_read_post(uuid) from public, anon;
grant execute on function public.can_read_post(uuid) to authenticated;

-- Storage bypasses posts RLS. Repeat the feed rule and the block rule here.
create or replace function public.can_read_post_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.posts p
      where p.photo_path = object_name
        and p.author_id not in (select unnest(private.my_block_partners()))
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (
              select pr.school_id
              from public.profiles pr
              where pr.id = (select auth.uid())
            )
          )
        )
    );
$$;

revoke all on function public.can_read_post_photo(text) from public, anon;
grant execute on function public.can_read_post_photo(text) to authenticated;

-- Likes SELECT keeps can_read_post and also hides a like whose author is in a
-- block with the viewer. The stored like_count is not filtered.
drop policy if exists "le curtidas de posts visiveis" on public.likes;
create policy "le curtidas de posts visiveis"
  on public.likes
  for select
  to authenticated
  using (
    public.can_read_post(post_id)
    and user_id not in (select unnest(private.my_block_partners()))
  );

-- Comments SELECT hides a comment whose author is in a block with the viewer,
-- and a comment on a post the viewer cannot read. The partner list is computed
-- once. Direct selects stay on RLS. like_count / comment_count are not filtered.
drop policy if exists "le comentarios de posts visiveis" on public.comments;
create policy "le comentarios de posts visiveis"
  on public.comments
  for select
  to authenticated
  using (
    user_id not in (select unnest(private.my_block_partners()))
    and exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and p.author_id not in (select unnest(private.my_block_partners()))
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (
              select pr.school_id
              from public.profiles pr
              where pr.id = (select auth.uid())
            )
          )
        )
    )
  );

-- One readability check for this post, then the block set. security definer so
-- the comments RLS policy (which also protects a direct select) is not applied
-- again to every comment in this page. The function repeats that filter.
create or replace function public.list_comments(
  p_post uuid,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  user_id uuid,
  text text,
  created_at timestamptz,
  author_name text,
  avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(public.can_read_post(p_post), false) then
    return;
  end if;

  return query
  select
    c.id,
    c.user_id,
    c.text,
    c.created_at,
    pr.name,
    pr.avatar_url
  from public.comments c
  join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
    and c.user_id not in (select unnest(private.my_block_partners()))
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (c.created_at, c.id) > (p_cursor_at, p_cursor_id)
      )
    )
  order by c.created_at asc, c.id asc
  limit least(greatest(coalesce(p_limit, 50), 1), 51);
end;
$$;

revoke all on function public.list_comments(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_comments(uuid, timestamptz, uuid, integer) to authenticated;

-- A block must not be distinguishable from a missing profile (both 23503).
-- The raised error is a copy of the real follows.following_id foreign key.
create or replace function public.follows_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := (select auth.uid());
  sentinel constant uuid := '00000000-0000-0000-0000-000000000000';
  fk_message text;
  fk_detail text;
  fk_constraint text;
  fk_schema text;
  fk_table text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if new.follower_id is not null and new.follower_id is distinct from uid then
    raise exception 'cannot follow as another user';
  end if;

  new.follower_id := uid;
  new.created_at := now();

  if new.following_id is not null
     and new.following_id = any (private.my_block_partners()) then
    begin
      insert into public.follows (following_id)
      values (sentinel);
    exception
      when foreign_key_violation then
        get stacked diagnostics
          fk_message = message_text,
          fk_detail = pg_exception_detail,
          fk_constraint = constraint_name,
          fk_schema = schema_name,
          fk_table = table_name;
    end;

    if fk_detail is not null and position(sentinel::text in fk_detail) > 0 then
      fk_detail := replace(fk_detail, sentinel::text, new.following_id::text);
    end if;

    raise exception using
      errcode = '23503',
      message = coalesce(
        fk_message,
        'insert or update on table "follows" violates foreign key constraint "follows_following_id_fkey"'
      ),
      detail = coalesce(
        fk_detail,
        format(
          'Key (following_id)=(%s) is not present in table "profiles".',
          new.following_id
        )
      ),
      constraint = coalesce(fk_constraint, 'follows_following_id_fkey'),
      schema = coalesce(fk_schema, 'public'),
      table = coalesce(fk_table, 'follows');
  end if;

  return new;
end;
$$;

revoke all on function public.follows_before_insert() from public, anon;
grant execute on function public.follows_before_insert() to authenticated;

drop policy if exists "le seguidores" on public.follows;
create policy "le seguidores"
  on public.follows
  for select
  to authenticated
  using (
    follower_id not in (select unnest(private.my_block_partners()))
    and following_id not in (select unnest(private.my_block_partners()))
  );

drop policy if exists "segue alguem" on public.follows;
create policy "segue alguem"
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and following_id not in (select unnest(private.my_block_partners()))
  );

-- list_follows stays security invoker. Hide a person who is in a block with the viewer.
create or replace function public.list_follows(
  p_profile uuid,
  p_direction text,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  profile_id uuid,
  name text,
  avatar_url text,
  school_short_name text,
  followed_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    pr.id,
    pr.name,
    pr.avatar_url,
    s.short_name,
    f.created_at
  from public.follows f
  join public.profiles pr
    on pr.id = case
      when p_direction = 'seguidores' then f.follower_id
      else f.following_id
    end
  left join public.schools s on s.id = pr.school_id
  where p_direction in ('seguidores', 'seguindo')
    and (
      (p_direction = 'seguidores' and f.following_id = p_profile)
      or (p_direction = 'seguindo' and f.follower_id = p_profile)
    )
    and pr.id not in (select unnest(private.my_block_partners()))
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (f.created_at, pr.id) < (p_cursor_at, p_cursor_id)
      )
    )
  order by f.created_at desc, pr.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21);
$$;

revoke all on function public.list_follows(uuid, text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_follows(uuid, text, timestamptz, uuid, integer) to authenticated;

-- The blocked person cannot read the blocker's profile.
-- The blocker can still read the blocked person's profile.
drop policy if exists "perfis sao visiveis" on public.profiles;

create policy "perfis sao visiveis"
  on public.profiles
  for select
  to anon
  using (true);

drop policy if exists "perfis autenticados respeitam bloqueio" on public.profiles;
create policy "perfis autenticados respeitam bloqueio"
  on public.profiles
  for select
  to authenticated
  using (
    id not in (select unnest(private.my_hidden_profiles()))
  );

create or replace function public.list_blocks(
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  profile_id uuid,
  name text,
  avatar_url text,
  blocked_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    pr.id,
    pr.name,
    pr.avatar_url,
    b.created_at
  from public.blocks b
  join public.profiles pr on pr.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (b.created_at, pr.id) < (p_cursor_at, p_cursor_id)
      )
    )
  order by b.created_at desc, pr.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21);
$$;

revoke all on function public.list_blocks(timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_blocks(timestamptz, uuid, integer) to authenticated;

drop function if exists public.is_blocked_between(uuid, uuid);

-- auth.uid() is volatile to the planner. (select auth.uid()) is one InitPlan,
-- so list_posts can use the follows index on the Seguindo tab instead of
-- scanning every follow. Behavior and security invoker stay the same.
create or replace function public.list_posts(
  p_tab text,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  author_id uuid,
  text text,
  photo_path text,
  created_at timestamptz,
  author_name text,
  avatar_url text,
  school_short_name text,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.author_id,
    p.text,
    p.photo_path,
    p.created_at,
    pr.name,
    pr.avatar_url,
    s.short_name,
    p.like_count,
    p.comment_count,
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = (select auth.uid())
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.schools s on s.id = p.school_id
  where p_tab in ('geral', 'campus', 'seguindo')
    and (
      (p_tab = 'geral' and p.to_general)
      or (
        p_tab = 'campus'
        and p.to_campus
        and p.school_id is not null
        and p.school_id = (
          select pf.school_id from public.profiles pf where pf.id = (select auth.uid())
        )
      )
      or (
        p_tab = 'seguindo'
        and p.author_id in (
          select f.following_id
          from public.follows f
          where f.follower_id = (select auth.uid())
        )
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (
              select pf.school_id from public.profiles pf where pf.id = (select auth.uid())
            )
          )
        )
      )
    )
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (p.created_at, p.id) < (p_cursor_at, p_cursor_id)
      )
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21);
$$;

revoke all on function public.list_posts(text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_posts(text, timestamptz, uuid, integer) to authenticated;

create or replace function public.list_author_posts(
  p_author uuid,
  p_cursor_at timestamptz default null,
  p_cursor_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  author_id uuid,
  text text,
  photo_path text,
  created_at timestamptz,
  author_name text,
  avatar_url text,
  school_short_name text,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.author_id,
    p.text,
    p.photo_path,
    p.created_at,
    pr.name,
    pr.avatar_url,
    s.short_name,
    p.like_count,
    p.comment_count,
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = (select auth.uid())
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.schools s on s.id = p.school_id
  where p.author_id = p_author
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (p.created_at, p.id) < (p_cursor_at, p_cursor_id)
      )
    )
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 21);
$$;

revoke all on function public.list_author_posts(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_author_posts(uuid, timestamptz, uuid, integer) to authenticated;

create or replace function public.get_post(p_id uuid)
returns table (
  id uuid,
  author_id uuid,
  text text,
  photo_path text,
  created_at timestamptz,
  author_name text,
  avatar_url text,
  school_short_name text,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.author_id,
    p.text,
    p.photo_path,
    p.created_at,
    pr.name,
    pr.avatar_url,
    s.short_name,
    p.like_count,
    p.comment_count,
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = (select auth.uid())
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.schools s on s.id = p.school_id
  where p.id = p_id;
$$;

revoke all on function public.get_post(uuid) from public, anon;
grant execute on function public.get_post(uuid) to authenticated;

create or replace function public.follow_stats(p_profile uuid)
returns table (
  followers bigint,
  following_count bigint,
  viewer_follows boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    (select count(*) from public.follows f where f.following_id = p_profile),
    (select count(*) from public.follows f where f.follower_id = p_profile),
    exists (
      select 1
      from public.follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = p_profile
    );
$$;

revoke all on function public.follow_stats(uuid) from public, anon;
grant execute on function public.follow_stats(uuid) to authenticated;

notify pgrst, 'reload schema';
