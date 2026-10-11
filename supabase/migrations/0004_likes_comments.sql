-- TheYep: likes and comments.
-- Run once after 0003_security_fixes.sql.
-- A person can see, like, or comment on a post only when they can read it
-- (Geral, or Campus for their own school). The client does not choose the author.

create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists likes_user_id_idx on public.likes (user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  constraint comments_text_len check (char_length(btrim(text)) between 1 and 300)
);

create index if not exists comments_post_created_idx
  on public.comments (post_id, created_at);

create index if not exists comments_user_id_idx on public.comments (user_id);

-- Same audience rule as the posts SELECT policy in 0002.
-- security invoker, so that policy still applies on top of the predicate.
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

create or replace function public.likes_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.user_id := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

revoke all on function public.likes_before_insert() from public, anon;
grant execute on function public.likes_before_insert() to authenticated;

drop trigger if exists likes_before_insert on public.likes;
create trigger likes_before_insert
  before insert on public.likes
  for each row
  execute function public.likes_before_insert();

create or replace function public.comments_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.id := gen_random_uuid();
  new.user_id := auth.uid();
  new.created_at := now();
  if new.text is not null then
    new.text := btrim(new.text);
  end if;
  return new;
end;
$$;

revoke all on function public.comments_before_insert() from public, anon;
grant execute on function public.comments_before_insert() to authenticated;

drop trigger if exists comments_before_insert on public.comments;
create trigger comments_before_insert
  before insert on public.comments
  for each row
  execute function public.comments_before_insert();

alter table public.likes enable row level security;
alter table public.comments enable row level security;

revoke all on public.likes from public, anon, authenticated;
revoke all on public.comments from public, anon, authenticated;

grant select, delete on public.likes to authenticated;
grant insert (post_id) on public.likes to authenticated;

grant select, delete on public.comments to authenticated;
grant insert (post_id, text) on public.comments to authenticated;

drop policy if exists "le curtidas de posts visiveis" on public.likes;
create policy "le curtidas de posts visiveis"
  on public.likes
  for select
  to authenticated
  using (public.can_read_post(post_id));

drop policy if exists "curte um post visivel" on public.likes;
create policy "curte um post visivel"
  on public.likes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_read_post(post_id)
  );

drop policy if exists "descurte a propria curtida" on public.likes;
create policy "descurte a propria curtida"
  on public.likes
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "le comentarios de posts visiveis" on public.comments;
create policy "le comentarios de posts visiveis"
  on public.comments
  for select
  to authenticated
  using (public.can_read_post(post_id));

drop policy if exists "comenta em post visivel" on public.comments;
create policy "comenta em post visivel"
  on public.comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.can_read_post(post_id)
  );

drop policy if exists "apaga comentario proprio ou do seu post" on public.comments;
create policy "apaga comentario proprio ou do seu post"
  on public.comments
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and p.author_id = auth.uid()
    )
  );

-- Return type changes, so replace list_posts from 0002. Feed rules stay the same.
drop function if exists public.list_posts(text, timestamptz, uuid, integer);

create function public.list_posts(
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
    (select count(*) from public.likes l where l.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id),
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = auth.uid()
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.schools s on s.id = p.school_id
  where p_tab in ('geral', 'campus')
    and (
      (p_tab = 'geral' and p.to_general)
      or (
        p_tab = 'campus'
        and p.to_campus
        and p.school_id is not null
        and p.school_id = (select pf.school_id from public.profiles pf where pf.id = auth.uid())
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
    (select count(*) from public.likes l where l.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id),
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = auth.uid()
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
    (select count(*) from public.likes l where l.post_id = p.id),
    (select count(*) from public.comments c where c.post_id = p.id),
    exists (
      select 1
      from public.likes l
      where l.post_id = p.id
        and l.user_id = auth.uid()
    )
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  left join public.schools s on s.id = p.school_id
  where p.id = p_id;
$$;

revoke all on function public.get_post(uuid) from public, anon;
grant execute on function public.get_post(uuid) to authenticated;

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
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
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
    and (
      p_cursor_at is null
      or (
        p_cursor_id is not null
        and (c.created_at, c.id) > (p_cursor_at, p_cursor_id)
      )
    )
  order by c.created_at asc, c.id asc
  limit least(greatest(coalesce(p_limit, 50), 1), 51);
$$;

revoke all on function public.list_comments(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_comments(uuid, timestamptz, uuid, integer) to authenticated;

notify pgrst, 'reload schema';
