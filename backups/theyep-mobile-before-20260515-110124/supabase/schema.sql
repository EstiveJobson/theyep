create extension if not exists "pgcrypto";

create type public.theyep_language as enum ('pt-BR', 'en');
create type public.theyep_campus as enum ('Campus Paralela', 'Campus Tancredo Neves');
create type public.theyep_audience as enum ('general', 'campus');
create type public.theyep_post_visibility as enum ('main', 'community', 'both');
create type public.theyep_reaction as enum ('yep', 'nope', 'loud', 'mood', 'iconic', 'in');
create type public.theyep_lost_found_status as enum ('Lost', 'Found');
create type public.theyep_event_vote as enum ('true', 'false');
create type public.theyep_report_severity as enum ('Low', 'Medium', 'High');
create type public.theyep_report_status as enum ('Open', 'Reviewing', 'Resolved');
create type public.theyep_notification_type as enum ('reaction', 'follow', 'direct', 'lostfound', 'system');
create type public.theyep_direct_kind as enum ('social', 'lostfound');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null check (email ~ '^[0-9]{10}@ulife\.com\.br$'),
  handle text unique not null check (handle ~ '^[a-z0-9._-]{3,24}$'),
  first_name text not null,
  last_name text not null,
  display_name text not null,
  campus public.theyep_campus not null,
  language public.theyep_language not null default 'pt-BR',
  course text not null default 'Unifacs',
  semester text not null default 'Student',
  avatar text not null default 'YP',
  photo_url text,
  bio text not null default '' check (char_length(bio) <= 160),
  vibe text not null default 'new',
  favorite_spot text not null default '',
  interests text[] not null default '{}',
  theme text not null default 'pink' check (theme in ('pink', 'cyan', 'yellow', 'lime')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  campus public.theyep_campus not null,
  name text not null check (char_length(name) between 1 and 42),
  category text not null check (char_length(category) between 1 and 28),
  description text not null check (char_length(description) <= 180),
  accent text not null default '#00b8d9',
  avatar_url text,
  top_post text not null default 'First post is waiting',
  created_at timestamptz not null default now()
);

create unique index communities_one_creator on public.communities (creator_id);

create table public.community_members (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  campus public.theyep_campus not null,
  audience public.theyep_audience not null default 'campus',
  visibility public.theyep_post_visibility not null default 'main',
  body text not null check (char_length(body) <= 2000),
  mood text not null,
  image_url text,
  video_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  root_id uuid references public.post_comments(id) on delete cascade,
  reply_to_id uuid references public.post_comments(id) on delete set null,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction public.theyep_reaction not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, reaction)
);

create or replace function public.limit_three_reactions()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.post_reactions
    where post_id = new.post_id and user_id = new.user_id
  ) >= 3 then
    raise exception 'Each user can pick up to 3 reactions per post.';
  end if;

  return new;
end;
$$;

create trigger post_reactions_limit_three
before insert on public.post_reactions
for each row execute function public.limit_three_reactions();

create table public.drops (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  campus public.theyep_campus not null,
  body text not null check (char_length(body) <= 500),
  image_url text,
  tags text[] not null default '{}',
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  campus public.theyep_campus not null,
  title text not null,
  category text not null,
  location text not null,
  starts_at timestamptz not null,
  edit_count int not null default 0 check (edit_count between 0 and 2),
  true_votes int not null default 0,
  false_votes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_votes (
  event_id uuid not null references public.events(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  choice public.theyep_event_vote not null,
  created_at timestamptz not null default now(),
  primary key (event_id, voter_id)
);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.lost_found (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  campus public.theyep_campus not null,
  status public.theyep_lost_found_status not null,
  item text not null,
  location text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.theyep_direct_kind not null default 'social',
  title text,
  avatar_url text,
  is_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.direct_participants (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  image_url text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type public.theyep_notification_type not null,
  message text not null,
  target_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target text not null,
  reason text not null,
  severity public.theyep_report_severity not null default 'Low',
  status public.theyep_report_status not null default 'Open',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reactions enable row level security;
alter table public.drops enable row level security;
alter table public.events enable row level security;
alter table public.event_votes enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.lost_found enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_participants enable row level security;
alter table public.direct_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

create policy "profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "authenticated read follows" on public.follows for select to authenticated using (true);
create policy "users follow as self" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "users unfollow as self" on public.follows for delete to authenticated using (auth.uid() = follower_id);

create policy "authenticated read communities" on public.communities for select to authenticated using (true);
create policy "users create own community" on public.communities for insert to authenticated with check (auth.uid() = creator_id);
create policy "creators update communities" on public.communities for update to authenticated using (auth.uid() = creator_id);
create policy "creators delete communities" on public.communities for delete to authenticated using (auth.uid() = creator_id);

create policy "authenticated read community members" on public.community_members for select to authenticated using (true);
create policy "users join as self" on public.community_members for insert to authenticated with check (auth.uid() = user_id);
create policy "users leave as self" on public.community_members for delete to authenticated using (auth.uid() = user_id);

create policy "authenticated read posts" on public.posts for select to authenticated using (true);
create policy "users create own posts" on public.posts for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own posts" on public.posts for update to authenticated using (auth.uid() = author_id);
create policy "authors delete own posts" on public.posts for delete to authenticated using (auth.uid() = author_id);

create policy "authenticated read comments" on public.post_comments for select to authenticated using (true);
create policy "users create own comments" on public.post_comments for insert to authenticated with check (auth.uid() = author_id);
create policy "authors delete own comments" on public.post_comments for delete to authenticated using (auth.uid() = author_id);

create policy "authenticated read reactions" on public.post_reactions for select to authenticated using (true);
create policy "users react as self" on public.post_reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "users remove own reactions" on public.post_reactions for delete to authenticated using (auth.uid() = user_id);

create policy "authenticated read drops" on public.drops for select to authenticated using (true);
create policy "users create own drops" on public.drops for insert to authenticated with check (auth.uid() = author_id);
create policy "authors delete own drops" on public.drops for delete to authenticated using (auth.uid() = author_id);

create policy "authenticated read events" on public.events for select to authenticated using (true);
create policy "users create own events" on public.events for insert to authenticated with check (auth.uid() = author_id);
create policy "authors update own events" on public.events for update to authenticated using (auth.uid() = author_id);
create policy "authors delete own events" on public.events for delete to authenticated using (auth.uid() = author_id);

create policy "authenticated read event votes" on public.event_votes for select to authenticated using (true);
create policy "users vote as self" on public.event_votes for insert to authenticated with check (auth.uid() = voter_id);
create policy "users change own vote" on public.event_votes for update to authenticated using (auth.uid() = voter_id);

create policy "authenticated read rsvps" on public.event_rsvps for select to authenticated using (true);
create policy "users rsvp as self" on public.event_rsvps for insert to authenticated with check (auth.uid() = user_id);
create policy "users remove own rsvp" on public.event_rsvps for delete to authenticated using (auth.uid() = user_id);

create policy "authenticated read lost found" on public.lost_found for select to authenticated using (true);
create policy "users create own lost found" on public.lost_found for insert to authenticated with check (auth.uid() = author_id);
create policy "authors delete own lost found" on public.lost_found for delete to authenticated using (auth.uid() = author_id);

create policy "participants read direct conversations" on public.direct_conversations
for select to authenticated
using (
  exists (
    select 1 from public.direct_participants
    where direct_participants.conversation_id = id
    and direct_participants.user_id = auth.uid()
  )
);

create policy "authenticated create direct conversations" on public.direct_conversations
for insert to authenticated
with check (true);

create policy "participants read participant rows" on public.direct_participants
for select to authenticated
using (
  exists (
    select 1 from public.direct_participants mine
    where mine.conversation_id = direct_participants.conversation_id
    and mine.user_id = auth.uid()
  )
);

create policy "users add self to direct" on public.direct_participants
for insert to authenticated
with check (auth.uid() = user_id);

create policy "participants read direct messages" on public.direct_messages
for select to authenticated
using (
  exists (
    select 1 from public.direct_participants
    where direct_participants.conversation_id = direct_messages.conversation_id
    and direct_participants.user_id = auth.uid()
  )
);

create policy "participants send direct messages" on public.direct_messages
for insert to authenticated
with check (
  auth.uid() = author_id and exists (
    select 1 from public.direct_participants
    where direct_participants.conversation_id = direct_messages.conversation_id
    and direct_participants.user_id = auth.uid()
  )
);

create policy "users read own notifications" on public.notifications for select to authenticated using (auth.uid() = recipient_id);
create policy "users update own notifications" on public.notifications for update to authenticated using (auth.uid() = recipient_id);

create policy "authenticated create reports" on public.reports for insert to authenticated with check (auth.uid() = reporter_id);
