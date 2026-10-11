-- TheYep: block another person.
-- Run once after 0005_follows.sql.
-- The client inserts only blocked_id. The trigger sets blocker_id and created_at.
-- The blocked person cannot read the blocks table. is_blocked_between is the only
-- security-definer function that reads it, and it returns a boolean, never a row.
-- Blocking deletes follows in both directions. Unblocking does not put them back.
--
-- Account deletion: profiles.id references auth.users on delete cascade (0001).
-- Both block columns reference profiles on delete cascade, so deleting the auth
-- user removes the profile and every block in both directions.

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

create or replace function public.blocks_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if new.blocker_id is not null and new.blocker_id is distinct from auth.uid() then
    raise exception 'cannot block as another user';
  end if;

  new.blocker_id := auth.uid();
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
  using (blocker_id = auth.uid());

drop policy if exists "bloqueia alguem" on public.blocks;
create policy "bloqueia alguem"
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "desbloqueia" on public.blocks;
create policy "desbloqueia"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

-- True when either person blocked the other. No other columns.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b)
       or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

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
drop policy if exists "le posts do feed" on public.posts;
create policy "le posts do feed"
  on public.posts
  for select
  to authenticated
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (
      to_general
      or (
        to_campus
        and school_id is not null
        and school_id = (select p.school_id from public.profiles p where p.id = auth.uid())
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
  select auth.uid() is not null
    and exists (
      select 1
      from public.posts p
      where p.id = p_post
        and not public.is_blocked_between(auth.uid(), p.author_id)
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (
              select pr.school_id from public.profiles pr where pr.id = auth.uid()
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
  select auth.uid() is not null
    and exists (
      select 1
      from public.posts p
      where p.photo_path = object_name
        and not public.is_blocked_between(auth.uid(), p.author_id)
        and (
          p.to_general
          or (
            p.to_campus
            and p.school_id is not null
            and p.school_id = (select pr.school_id from public.profiles pr where pr.id = auth.uid())
          )
        )
    );
$$;

revoke all on function public.can_read_post_photo(text) from public, anon;
grant execute on function public.can_read_post_photo(text) to authenticated;

-- Likes and comments INSERT already require can_read_post, so a block stops both.
-- Comments SELECT also hides a comment whose author is blocked either way,
-- including an old comment on someone else's post.
drop policy if exists "le comentarios de posts visiveis" on public.comments;
create policy "le comentarios de posts visiveis"
  on public.comments
  for select
  to authenticated
  using (
    public.can_read_post(post_id)
    and not public.is_blocked_between(auth.uid(), user_id)
  );

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

  if public.is_blocked_between(new.follower_id, new.following_id) then
    raise exception 'blocked';
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
    not public.is_blocked_between(auth.uid(), follower_id)
    and not public.is_blocked_between(auth.uid(), following_id)
  );

drop policy if exists "segue alguem" on public.follows;
create policy "segue alguem"
  on public.follows
  for insert
  to authenticated
  with check (
    follower_id = auth.uid()
    and not public.is_blocked_between(follower_id, following_id)
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
    and not public.is_blocked_between(auth.uid(), pr.id)
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
-- The blocker can still read the blocked person's profile: their own block row
-- is visible, and is_blocked_between alone would hide both directions.
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
    not (
      public.is_blocked_between(id, auth.uid())
      and not exists (
        select 1
        from public.blocks b
        where b.blocker_id = auth.uid()
          and b.blocked_id = profiles.id
      )
    )
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
  where b.blocker_id = auth.uid()
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

notify pgrst, 'reload schema';
