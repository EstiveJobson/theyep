-- TheYep: escolas, perfis e buckets de foto.
-- A lista de escolas é dado. Para incluir uma escola, insira uma linha.
-- Rode este arquivo no SQL Editor do Supabase (uma vez).

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  bio text not null default '',
  avatar_url text,
  school_id uuid references public.schools (id),
  created_at timestamptz not null default now()
);

create index if not exists profiles_school_id_idx on public.profiles (school_id);

insert into public.schools (name, short_name)
select v.name, v.short_name
from (
  values
    ('[ESCOLA_1]', '[ESCOLA_1]'),
    ('[ESCOLA_2]', '[ESCOLA_2]'),
    ('[ESCOLA_3]', '[ESCOLA_3]')
) as v(name, short_name)
where not exists (
  select 1 from public.schools s where s.name = v.name
);

alter table public.schools enable row level security;
alter table public.profiles enable row level security;

revoke all on public.schools from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select on public.schools to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

drop policy if exists "escolas ativas sao publicas" on public.schools;
create policy "escolas ativas sao publicas"
  on public.schools
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "perfis sao visiveis" on public.profiles;
create policy "perfis sao visiveis"
  on public.profiles
  for select
  to anon, authenticated
  using (true);

drop policy if exists "cria o proprio perfil" on public.profiles;
create policy "cria o proprio perfil"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "edita o proprio perfil" on public.profiles;
create policy "edita o proprio perfil"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    2097152,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'post-photos',
    'post-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Arquivos ficam em {id-do-usuario}/nome-do-arquivo
drop policy if exists "avatares publicos para leitura" on storage.objects;
create policy "avatares publicos para leitura"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "usuario envia o proprio avatar" on storage.objects;
create policy "usuario envia o proprio avatar"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "usuario atualiza o proprio avatar" on storage.objects;
create policy "usuario atualiza o proprio avatar"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "usuario apaga o proprio avatar" on storage.objects;
create policy "usuario apaga o proprio avatar"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "fotos de post publicas para leitura" on storage.objects;
create policy "fotos de post publicas para leitura"
  on storage.objects
  for select
  to public
  using (bucket_id = 'post-photos');

drop policy if exists "usuario envia a propria foto" on storage.objects;
create policy "usuario envia a propria foto"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "usuario atualiza a propria foto" on storage.objects;
create policy "usuario atualiza a propria foto"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
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
