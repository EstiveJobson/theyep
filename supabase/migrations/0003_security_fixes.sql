-- TheYep: lock school_id, stop forged post timestamps, and let owners delete orphan photos.
-- Run once after 0002_posts.sql.
-- handle_new_user (0001) is unchanged. It is security definer and still inserts
-- the profile (id, name) on signup. It does not set a school.

revoke insert, update on public.profiles from authenticated;
grant update (name, bio, avatar_url) on public.profiles to authenticated;

create or replace function public.profiles_before_update()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.school_id is distinct from old.school_id
     and current_user in ('authenticated', 'anon') then
    raise exception 'school_id cannot be changed directly';
  end if;
  return new;
end;
$$;

revoke all on function public.profiles_before_update() from public, anon;
grant execute on function public.profiles_before_update() to authenticated;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update
  before update on public.profiles
  for each row
  execute function public.profiles_before_update();

-- One-time choice. The function owner bypasses the trigger check above.
create or replace function public.set_my_school(p_school uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_school uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select p.school_id into current_school
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  if current_school is not null then
    raise exception 'school already chosen';
  end if;

  if not exists (
    select 1
    from public.schools s
    where s.id = p_school
      and s.active = true
  ) then
    raise exception 'school is inactive or does not exist';
  end if;

  update public.profiles
  set school_id = p_school
  where id = auth.uid();
end;
$$;

revoke all on function public.set_my_school(uuid) from public, anon;
grant execute on function public.set_my_school(uuid) to authenticated;

-- Same rules as 0002, plus a server-side id and created_at.
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  profile_school uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  new.id := gen_random_uuid();
  new.created_at := now();
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

revoke insert on public.posts from authenticated;
grant insert (text, photo_path, to_general, to_campus) on public.posts to authenticated;

-- 0001 let the author replace a file in place. A published photo must stay put.
drop policy if exists "usuario atualiza a propria foto" on storage.objects;

-- Supabase checks SELECT before DELETE. Own-folder reads also cover orphan uploads.
drop policy if exists "le a propria pasta de fotos" on storage.objects;
create policy "le a propria pasta de fotos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
