-- TheYep: a profile photo path can only point at that user's own folder.
-- Run once after 0008_pre_deploy_app.sql.
-- Does not alter storage tables.
-- The filename must start with a letter, digit, underscore, or hyphen.
-- Existing values are cleared unless the whole string already matches.
-- Do not substring a URL: '<id>/s%20x.jpg?token=...' becomes null, not '<id>/s'.

update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~ ('^' || id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]*$');

alter table public.profiles drop constraint if exists profiles_avatar_path_check;

alter table public.profiles
  add constraint profiles_avatar_path_check
  check (
    avatar_url is null
    or avatar_url ~ ('^' || id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]*$')
  );

notify pgrst, 'reload schema';
