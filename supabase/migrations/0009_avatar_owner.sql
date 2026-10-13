-- TheYep: a profile photo path can only point at that user's own folder.
-- Run once after 0008_pre_deploy_app.sql.
-- Does not alter storage tables.

-- Keep a path that was saved as a full Storage URL when the folder is this profile.
update public.profiles as p
set avatar_url = src.path
from (
  select
    id,
    lower(
      substring(
        avatar_url
        from '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+)'
      )
    ) as path
  from public.profiles
  where avatar_url is not null
    and avatar_url !~ ('^' || id::text || '/[A-Za-z0-9._-]+$')
) as src
where p.id = src.id
  and src.path is not null
  and src.path ~ ('^' || p.id::text || '/[A-Za-z0-9._-]+$');

update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~ ('^' || id::text || '/[A-Za-z0-9._-]+$');

alter table public.profiles drop constraint if exists profiles_avatar_path_check;

alter table public.profiles
  add constraint profiles_avatar_path_check
  check (
    avatar_url is null
    or avatar_url ~ ('^' || id::text || '/[A-Za-z0-9._-]+$')
  );

notify pgrst, 'reload schema';
