-- TheYep: follows and the Seguindo feed.
-- Run once after 0004_likes_comments.sql.
-- The client inserts only following_id. The trigger sets follower_id and created_at.
-- list_posts stays security invoker, so the posts SELECT policy still hides a
-- campus post from another school. The Seguindo filter repeats that rule.
-- list_author_posts is unchanged: it is already security invoker.
--
-- Account deletion: profiles.id references auth.users on delete cascade (0001).
-- Both follows columns reference profiles on delete cascade, so deleting the
-- auth user removes the profile and every follow in both directions.
-- Follower counts are computed from this table. They are not stored.

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc);

create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc);

create or replace function public.follows_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if new.follower_id is not null and new.follower_id is distinct from auth.uid() then
    raise exception 'cannot follow as another user';
  end if;

  new.follower_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.follows_before_insert() from public, anon;
grant execute on function public.follows_before_insert() to authenticated;

drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert
  before insert on public.follows
  for each row
  execute function public.follows_before_insert();

alter table public.follows enable row level security;

revoke all on public.follows from public, anon, authenticated;

grant select, delete on public.follows to authenticated;
grant insert (following_id) on public.follows to authenticated;

drop policy if exists "le seguidores" on public.follows;
create policy "le seguidores"
  on public.follows
  for select
  to authenticated
  using (true);

drop policy if exists "segue alguem" on public.follows;
create policy "segue alguem"
  on public.follows
  for insert
  to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "deixa de seguir" on public.follows;
create policy "deixa de seguir"
  on public.follows
  for delete
  to authenticated
  using (follower_id = auth.uid());

-- Same signature and return columns as 0004. Geral and Campus stay the same.
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
        and l.user_id = auth.uid()
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
        and p.school_id = (select pf.school_id from public.profiles pf where pf.id = auth.uid())
      )
      or (
        p_tab = 'seguindo'
        and p.author_id in (
          select f.following_id
          from public.follows f
          where f.follower_id = auth.uid()
        )
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (select pf.school_id from public.profiles pf where pf.id = auth.uid())
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
      where f.follower_id = auth.uid()
        and f.following_id = p_profile
    );
$$;

revoke all on function public.follow_stats(uuid) from public, anon;
grant execute on function public.follow_stats(uuid) to authenticated;

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

notify pgrst, 'reload schema';
