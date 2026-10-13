-- TheYep: last database pass before the first deploy.
-- Run once after 0006_blocks.sql.
-- Logged-out visitors can read active schools and nothing about users.
-- A post photo can be deleted only when no post still stores that path.
-- list_follows reads one direction at a time so it can walk the follow indexes.
-- Roles other than authenticated and anon (postgres, service_role) may insert a
-- follow with the given follower_id. Signed-in follows keep the previous rules.
-- The real schools are upserted by slug. Every other school stays, inactive.

revoke select on table public.profiles from anon, public;

drop policy if exists "perfis sao visiveis" on public.profiles;

-- list_comments is security definer and returns a profile name and avatar.
-- A missing session returns no rows even if execute is granted later.
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
  if (select auth.uid()) is null then
    return;
  end if;

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

-- One branch per direction. Seguidores walks follows_following_created_idx
-- (following_id, created_at desc). Seguindo walks follows_follower_created_idx
-- (follower_id, created_at desc). The tie-break is the other id, which is the
-- profile id the app already sends as the cursor.
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
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  if p_direction = 'seguidores' then
    return query
    select
      pr.id,
      pr.name,
      pr.avatar_url,
      s.short_name,
      f.created_at
    from public.follows f
    join public.profiles pr on pr.id = f.follower_id
    left join public.schools s on s.id = pr.school_id
    where f.following_id = p_profile
      and pr.id not in (select unnest(private.my_block_partners()))
      and (
        p_cursor_at is null
        or (
          p_cursor_id is not null
          and (f.created_at, f.follower_id) < (p_cursor_at, p_cursor_id)
        )
      )
    order by f.created_at desc, f.follower_id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 21);
    return;
  end if;

  if p_direction = 'seguindo' then
    return query
    select
      pr.id,
      pr.name,
      pr.avatar_url,
      s.short_name,
      f.created_at
    from public.follows f
    join public.profiles pr on pr.id = f.following_id
    left join public.schools s on s.id = pr.school_id
    where f.follower_id = p_profile
      and pr.id not in (select unnest(private.my_block_partners()))
      and (
        p_cursor_at is null
        or (
          p_cursor_id is not null
          and (f.created_at, f.following_id) < (p_cursor_at, p_cursor_id)
        )
      )
    order by f.created_at desc, f.following_id desc
    limit least(greatest(coalesce(p_limit, 20), 1), 21);
    return;
  end if;
end;
$$;

revoke all on function public.list_follows(uuid, text, timestamptz, uuid, integer) from public, anon;
revoke all on function public.follow_stats(uuid) from public, anon;
revoke all on function public.list_posts(text, timestamptz, uuid, integer) from public, anon;
revoke all on function public.get_post(uuid) from public, anon;
revoke all on function public.list_author_posts(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.list_comments(uuid, timestamptz, uuid, integer) from public, anon;
revoke all on function public.list_blocks(timestamptz, uuid, integer) from public, anon;

grant execute on function public.list_follows(uuid, text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.follow_stats(uuid) to authenticated;
grant execute on function public.list_posts(text, timestamptz, uuid, integer) to authenticated;
grant execute on function public.get_post(uuid) to authenticated;
grant execute on function public.list_author_posts(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_comments(uuid, timestamptz, uuid, integer) to authenticated;
grant execute on function public.list_blocks(timestamptz, uuid, integer) to authenticated;

-- Same block error as 0006 when the caller is the API. Seed and admin roles
-- keep the follower_id they pass. The self-follow check and the primary key
-- still apply to every role.
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
  if current_user in ('authenticated', 'anon') then
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
  end if;

  return new;
end;
$$;

revoke all on function public.follows_before_insert() from public, anon;
grant execute on function public.follows_before_insert() to authenticated, service_role;

-- deletePost removes the post row first, then the file. A photo that never
-- became a post has no row, so the composer can still drop that upload.
drop policy if exists "usuario apaga a propria foto" on storage.objects;
create policy "usuario apaga a propria foto"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (
      select 1
      from public.posts p
      where p.photo_path = name
    )
  );

do $$
declare
  dup_name text;
begin
  select name into dup_name
  from public.schools
  group by name
  having count(*) > 1
  limit 1;

  if dup_name is not null then
    raise exception 'duplicate school names (for example "%"); resolve them before 0007', dup_name;
  end if;
end $$;

alter table public.schools add column if not exists slug text;
alter table public.schools add column if not exists city text;
alter table public.schools add column if not exists kind text;

update public.schools as s
set slug = src.slug
from (
  select
    id,
    case
      when n = 1 then base_slug
      else base_slug || '-' || n::text
    end as slug
  from (
    select
      id,
      base_slug,
      row_number() over (partition by base_slug order by id) as n
    from (
      select
        id,
        coalesce(
          nullif(
            trim(both '-' from regexp_replace(
              lower(translate(
                name,
                'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
                'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
              )),
              '[^a-z0-9]+',
              '-',
              'g'
            )),
            ''
          ),
          'escola'
        ) as base_slug
      from public.schools
      where slug is null or btrim(slug) = ''
    ) as raw
  ) as ranked
) as src
where s.id = src.id;

-- A row that already has one of the real names keeps that row and takes the slug.
update public.schools as s
set slug = v.slug
from (
  values
    ('unifacs', 'Unifacs – Universidade Salvador'),
    ('ufba', 'UFBA – Universidade Federal da Bahia'),
    ('uneb', 'UNEB – Universidade do Estado da Bahia'),
    ('unijorge', 'UniJorge'),
    ('unime-salvador', 'Unime – Salvador'),
    ('unime-lauro-de-freitas', 'Unime – Lauro de Freitas'),
    ('sartre-salvador', 'Colégio Sartre – Salvador'),
    ('sartre-lauro-de-freitas', 'Colégio Sartre – Lauro de Freitas'),
    ('marista-salvador', 'Colégio Marista'),
    ('vieira-salvador', 'Colégio Vieira')
) as v(slug, name)
where s.name = v.name
  and s.slug is distinct from v.slug
  and not exists (
    select 1
    from public.schools as other
    where other.slug = v.slug
      and other.id <> s.id
  );

do $$
begin
  if exists (
    select 1
    from public.schools
    where slug is null or btrim(slug) = ''
  ) then
    raise exception 'school slug backfill left an empty slug';
  end if;

  if exists (
    select 1
    from (
      values
        ('unifacs', 'Unifacs – Universidade Salvador'),
        ('ufba', 'UFBA – Universidade Federal da Bahia'),
        ('uneb', 'UNEB – Universidade do Estado da Bahia'),
        ('unijorge', 'UniJorge'),
        ('unime-salvador', 'Unime – Salvador'),
        ('unime-lauro-de-freitas', 'Unime – Lauro de Freitas'),
        ('sartre-salvador', 'Colégio Sartre – Salvador'),
        ('sartre-lauro-de-freitas', 'Colégio Sartre – Lauro de Freitas'),
        ('marista-salvador', 'Colégio Marista'),
        ('vieira-salvador', 'Colégio Vieira')
    ) as v(slug, name)
    join public.schools as s on s.name = v.name
    where s.slug is distinct from v.slug
  ) then
    raise exception 'a real school name is already used by a row whose slug cannot be aligned';
  end if;
end $$;

alter table public.schools alter column slug set not null;

alter table public.schools drop constraint if exists schools_slug_key;
alter table public.schools add constraint schools_slug_key unique (slug);

alter table public.schools drop constraint if exists schools_name_key;
alter table public.schools add constraint schools_name_key unique (name);

alter table public.schools drop constraint if exists schools_kind_check;
alter table public.schools
  add constraint schools_kind_check
  check (kind in ('universidade', 'escola'));

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

update public.schools
set active = false
where slug not in (
  'unifacs',
  'ufba',
  'uneb',
  'unijorge',
  'unime-salvador',
  'unime-lauro-de-freitas',
  'sartre-salvador',
  'sartre-lauro-de-freitas',
  'marista-salvador',
  'vieira-salvador'
);

notify pgrst, 'reload schema';
