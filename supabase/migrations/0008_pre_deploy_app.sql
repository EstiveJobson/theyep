-- TheYep: avatars are private, enrolled students still see an inactive school,
-- and service_role has explicit grants.
-- Run once after 0007_pre_deploy.sql.
-- Do not edit 0001-0007. post-photos and avatars already allow image/webp.

update storage.buckets
set public = false
where id = 'avatars';

alter table storage.objects enable row level security;

-- Anonymous clients could list every avatar path (user ids) and download the files.
drop policy if exists "avatares publicos para leitura" on storage.objects;

drop policy if exists "avatares visiveis para autenticados" on storage.objects;
create policy "avatares visiveis para autenticados"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

-- Signup and the profile picker still request active = true.
-- Someone already enrolled keeps name and short_name after the school is turned off.
drop policy if exists "escolas ativas sao publicas" on public.schools;
create policy "escolas ativas sao publicas"
  on public.schools
  for select
  to anon
  using (active = true);

drop policy if exists "autenticados leem escolas" on public.schools;
create policy "autenticados leem escolas"
  on public.schools
  for select
  to authenticated
  using (true);

-- Hosted Supabase usually grants these through default privileges.
-- State them here so a fresh install does not depend on that.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.schools to service_role;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.posts to service_role;
grant select, insert, update, delete on table public.likes to service_role;
grant select, insert, update, delete on table public.comments to service_role;
grant select, insert, update, delete on table public.follows to service_role;
grant select, insert, update, delete on table public.blocks to service_role;

grant usage on schema private to service_role;
grant execute on function private.my_block_partners() to service_role;
grant execute on function private.my_hidden_profiles() to service_role;

grant execute on function public.handle_new_user() to service_role;
grant execute on function public.profiles_before_update() to service_role;
grant execute on function public.set_my_school(uuid) to service_role;
grant execute on function public.posts_before_insert() to service_role;
grant execute on function public.can_read_post(uuid) to service_role;
grant execute on function public.can_read_post_photo(text) to service_role;
grant execute on function public.likes_before_insert() to service_role;
grant execute on function public.comments_before_insert() to service_role;
grant execute on function public.likes_count_change() to service_role;
grant execute on function public.comments_count_change() to service_role;
grant execute on function public.list_posts(text, timestamptz, uuid, integer) to service_role;
grant execute on function public.list_author_posts(uuid, timestamptz, uuid, integer) to service_role;
grant execute on function public.get_post(uuid) to service_role;
grant execute on function public.list_comments(uuid, timestamptz, uuid, integer) to service_role;
grant execute on function public.follows_before_insert() to service_role;
grant execute on function public.follow_stats(uuid) to service_role;
grant execute on function public.list_follows(uuid, text, timestamptz, uuid, integer) to service_role;
grant execute on function public.blocks_before_insert() to service_role;
grant execute on function public.blocks_after_insert() to service_role;
grant execute on function public.list_blocks(timestamptz, uuid, integer) to service_role;

notify pgrst, 'reload schema';
