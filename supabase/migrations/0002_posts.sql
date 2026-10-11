-- TheYep: posts, feed and private post photos.
-- Run this once in the Supabase SQL Editor, after 0001_foundation.sql.
-- 0001 created the post-photos bucket as public. This file makes it private.
-- If you re-run 0001 later, run this file again so the bucket stays private.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text,
  photo_path text,
  to_general boolean not null default false,
  to_campus boolean not null default false,
  school_id uuid references public.schools (id),
  created_at timestamptz not null default now(),
  constraint posts_text_len check (text is null or char_length(text) <= 500),
  constraint posts_photo_len check (photo_path is null or char_length(photo_path) <= 300),
  constraint posts_has_body check (
    photo_path is not null
    or (text is not null and char_length(btrim(text)) > 0)
  ),
  constraint posts_has_audience check (to_general or to_campus),
  constraint posts_campus_school check ((not to_campus) or school_id is not null)
);

create index if not exists posts_created_at_id_idx
  on public.posts (created_at desc, id desc);

create index if not exists posts_to_general_idx
  on public.posts (to_general);

create index if not exists posts_campus_feed_idx
  on public.posts (school_id, to_campus, created_at desc);

-- The client never chooses the author or the school. Both come from the session.
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  profile_school uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.author_id := auth.uid();

  select p.school_id into profile_school
  from public.profiles p
  where p.id = auth.uid();

  new.school_id := profile_school;

  if profile_school is null then
    new.to_campus := false;
  end if;

  if new.text is not null then
    new.text := nullif(btrim(new.text), '');
  end if;

  if new.photo_path is not null then
    new.photo_path := nullif(btrim(new.photo_path), '');
  end if;

  if new.photo_path is not null
     and new.photo_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'invalid photo path';
  end if;

  return new;
end;
$$;

revoke all on function public.posts_before_insert() from public, anon;
grant execute on function public.posts_before_insert() to authenticated;

drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert
  before insert on public.posts
  for each row
  execute function public.posts_before_insert();

alter table public.posts enable row level security;

revoke all on public.posts from anon, authenticated;
grant select, insert, delete on public.posts to authenticated;

drop policy if exists "le posts do feed" on public.posts;
create policy "le posts do feed"
  on public.posts
  for select
  to authenticated
  using (
    to_general
    or (
      to_campus
      and school_id is not null
      and school_id = (select p.school_id from public.profiles p where p.id = auth.uid())
    )
  );

drop policy if exists "cria o proprio post" on public.posts;
create policy "cria o proprio post"
  on public.posts
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and school_id is not distinct from (
      select p.school_id from public.profiles p where p.id = auth.uid()
    )
  );

drop policy if exists "apaga o proprio post" on public.posts;
create policy "apaga o proprio post"
  on public.posts
  for delete
  to authenticated
  using (author_id = auth.uid());

-- Keyset page for the two feeds. security invoker, so the RLS above still applies.
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
  school_short_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.author_id,
    p.text,
    p.photo_path,
    p.created_at,
    pr.name,
    pr.avatar_url,
    s.short_name
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

-- Signed URLs call this. security definer so Storage can see the row, but the
-- same feed rules are repeated here (RLS is bypassed on purpose).
create or replace function public.can_read_post_photo(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.posts p
      where p.photo_path = object_name
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-photos',
  'post-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos de post publicas para leitura" on storage.objects;

drop policy if exists "le fotos de posts permitidos" on storage.objects;
create policy "le fotos de posts permitidos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'post-photos'
    and public.can_read_post_photo(name)
  );

-- 0001 already lets each user write only inside their own folder.
-- Recreate those rules so a project that skipped them still enforces the folder.
drop policy if exists "usuario envia a propria foto" on storage.objects;
create policy "usuario envia a propria foto"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "usuario apaga a propria foto" on storage.objects;
create policy "usuario apaga a propria foto"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
