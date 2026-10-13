# TheYep

> Bringing back the fun, colorful and social internet, made for students and schools.

**Status:** v1 in development 🚧

TheYep is a lightweight social network for school communities: you sign up with your email, set up your profile and follow what people at your school are posting. It is mobile-first and can be installed as an app (PWA). The app's interface is in Brazilian Portuguese.

## Features

### Working now

- Sign up and log in with email and password (Supabase Auth)
- Profile page with name, bio, photo (or the name's initial) and join date. The profile is created automatically on sign-up
- Optional school on sign-up. The list is the active schools in the database, plus “Pular – não estudo em nenhuma dessas”. With e-mail confirmation on, the choice is saved as `pending_school_id` and applied with `set_my_school` on the first signed-in session. If a session already exists, it is applied immediately. An inactive school is skipped, and the person can choose later
- “Escolher minha escola” on your own profile, only while the school is empty. Confirming calls `set_my_school` once. The button never appears on someone else's profile
- Log out
- Light and dark theme, following the system or chosen by the user
- Mobile-first navigation: bottom tab bar on phones and top menu on desktop
- PWA: manifest and icons for installing to the home screen
- Posts with text (up to 500 characters) and/or one photo. A post can go to the general feed, the campus feed, or both. Campus is available only when the profile has a school
- General feed, campus feed and following feed on the home screen, newest first, 20 posts per page
- Delete your own post, which also removes its photo, likes and comments
- Like a post once. The heart is filled pink when it's yours, with the count beside it. A second tap removes the like
- Comments on the post page (`/post/[id]`), up to 300 characters, oldest first. The card says “1 comentário” or “X comentários”. You can delete your own comment, and the post's author can delete any comment on it
- Follow someone from their profile. The button says “Seguir” and then “Seguindo”. It never appears on your own profile. A person cannot follow themselves, and the same follow cannot be saved twice
- “X seguidores” and “Y seguindo” on every profile while you are signed in. One follower is “1 seguidor”. The numbers are counted from the `follows` table, not stored. Each counter opens `/perfil/[id]/seguidores` or `/perfil/[id]/seguindo` (avatar, name and school, newest first, 20 per page)
- A “Seguindo” tab on the home feed, beside Geral and Campus. It lists posts from people you follow: anything they sent to Geral, plus their Campus posts only when you are at the same school. Campus posts from another school stay hidden there and on that person's profile
- Block someone from their profile. The “…” menu asks “Bloquear [nome]? Vocês deixam de se seguir e não vão mais ver os posts um do outro. A pessoa não é avisada.” Blocking removes follows in both directions and hides posts, comments, likes and follow lists either way. The blocked person is not told. Your own profile has no block button. Opening someone you blocked shows only their name, photo and “Desbloquear”, and the page does not send the bio or the other profile fields to the browser. Opening someone who blocked you shows the same “Perfil indisponível” page as a profile that does not exist. Trying to follow either person fails the same way as following a profile that does not exist. Like and comment counts on a post stay as stored totals: a block hides those rows, and v1 does not subtract them from the counters
- Configurações (`/configuracoes`), linked from your own profile, lists “Contas bloqueadas” with photo, name and “Desbloquear”, newest first, 20 at a time. Unblocking does not restore follows
- Database with Row Level Security: each user can only create and edit their own profile, publish as themselves, follow as themselves, block as themselves, and upload files to their own folder. Campus posts, their photos, likes and comments are visible only to people at that school. A block hides posts, comments, likes and follow lists in both directions. The blocked person cannot see that a block row exists, and cannot open the blocker's profile. There is no public function that answers whether two people blocked each other. The checks live in schema `private` (`my_block_partners` and `my_hidden_profiles`), which is not one of the Data API exposed schemas, so `/rest/v1/rpc/my_block_partners` and `/rest/v1/rpc/is_blocked_between` return no rows. Do not add `private` to Exposed schemas. Any signed-in user can read follows that do not involve someone they blocked or who blocked them. Logged-out visitors cannot read profiles or run `list_follows`, `follow_stats`, `list_posts`, `get_post`, `list_author_posts`, `list_comments`, or `list_blocks`. Opening a profile without a session shows “Entre para ver o perfil” and does not load that profile. Anonymous users can still read active schools, which is what sign-up needs. The owner can delete a file in their own `post-photos` folder only when no post still stores that path. Deleting a post removes the row first and the file after, so that still works, and an upload that never became a post can still be removed. Post photos live in a private bucket and are shown with short-lived signed URLs

### In progress (v1 scope)

- Deleting your own account. The database already removes that person's follows and blocks in both directions when the auth user is deleted, because the profile cascades from the user and those rows cascade from the profile. There is still no button for it in the app

Campus uses `profiles.school_id`. A person can choose a school only once, through `set_my_school`, and only while the field is empty. Sign-up and your own profile both call that function. They never write `school_id` directly, and `handle_new_user` still does not set a school. A direct update of `school_id` is rejected. Logged-out visitors can read active schools: `0001` grants `anon` `select` and the policy “escolas ativas sao publicas” keeps the rows to `active = true`. They cannot read profiles. The sign-up list asks only for `id`, `name` and `short_name`. `0007` adds `slug` (unique), `city`, and `kind` (`universidade` or `escola`), and makes `name` unique. It upserts ten active schools in Salvador and Lauro de Freitas: Unifacs, UFBA, UNEB, UniJorge, Unime Salvador, Unime Lauro de Freitas, Colégio Sartre in both cities, Colégio Marista, and Colégio Vieira. Every other school, including the placeholders from `0001`, stays in the table with `active = false` so existing profiles and posts keep their reference. Running that upsert again does not duplicate them. There is no separate seed file. Sign-up and the Campus tab read the active rows from `schools`; school names are not hardcoded. `list_follows` runs one query for seguidores and one for seguindo, each ordered so it can use the existing follow index. The cursor is still the profile id. A follow inserted by `postgres` or `service_role` keeps the given `follower_id`. A signed-in insert still requires a session, forces `follower_id` to that session, and a block still fails with the same foreign-key error as a missing profile. A profile with no school sees Geral and Seguindo, not Campus.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com/): auth, Postgres and Storage (`@supabase/ssr` and `@supabase/supabase-js`)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Lucide](https://lucide.dev/) icons and the Nunito font (`next/font`)
- ESLint + Prettier

Brand colors: pink `#F06292`, blue `#42A5F5` and yellow `#FFD54F`.

Logo sources are in [`brand/`](brand/README.md) (outlined SVGs, plus editable masters that need Luckiest Guy). The font file is not part of the app; the UI stays on Nunito. The header uses the soft burst, because the sharp one turns to noise at that size: the color mark in the light theme and the dark-background mark (white halo, for `#212121`) in the dark theme. Home-screen icons and the 1200×630 share image (`public/og.png`) are exports of the Y icon and the bold burst.

## Project structure

```
.
├── brand/                   # logo SVGs (outlined and editable) and the Luckiest Guy license
├── public/                  # icons, favicon, og.png and manifest.webmanifest (PWA)
├── src/
│   ├── app/                 # routes (App Router)
│   │   ├── layout.tsx       # root layout, font, theme and metadata
│   │   ├── page.tsx         # /        Home (feed)
│   │   ├── post/            # /post/[id]  Post, likes and comments
│   │   ├── postar/          # /postar  Post
│   │   ├── perfil/          # /perfil, /perfil/[id], seguidores and seguindo
│   │   ├── configuracoes/   # /configuracoes  Blocked accounts
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css      # theme and colors
│   ├── components/          # Shell, feed, composer, profile and follows
│   ├── lib/
│   │   ├── supabase/        # Supabase clients (browser, server and middleware)
│   │   └── relative-time.ts
│   ├── server/posts.ts      # feed, create and delete
│   ├── server/follows.ts    # follow, unfollow, counts and lists
│   ├── server/blocks.ts     # block, unblock and the blocked-accounts list
│   ├── server/engagement.ts # likes, comments and the post page
│   └── middleware.ts        # refreshes the Supabase session on every request
├── supabase/migrations/     # database SQL (tables, RLS, trigger and buckets)
├── .env.example             # required environment variables
└── next.config.ts
```

## Running locally

**Requirements:** Node.js 20 or later (tested with Node 22), npm and a free [Supabase](https://supabase.com/) project.

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/EstiveJobson/theyep.git
   cd theyep
   npm install
   ```

2. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

3. In `.env.local`, fill in your Supabase project details (under **Project Settings → API**):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_SITE_URL=
   ```

   Only use the `anon` key. Never put the `service_role` key in the project and never commit `.env.local`.

   `NEXT_PUBLIC_SITE_URL` is optional. When set to an absolute URL (for example `https://theyep.example`), Open Graph and Twitter tags use it. If it is empty, the app uses `https://$VERCEL_URL` on Vercel, then `http://localhost:3000`.

4. Set up the database in the Supabase **SQL Editor**, in this order:

   1. [`supabase/migrations/0001_foundation.sql`](supabase/migrations/0001_foundation.sql) once. Leave `[ESCOLA_1]`, `[ESCOLA_2]` and `[ESCOLA_3]` as they are. `0007` marks those placeholders inactive and adds the real schools. If two rows already share a name, `0007` stops; rename one and run it again.
   2. [`supabase/migrations/0002_posts.sql`](supabase/migrations/0002_posts.sql) once. It creates `posts` and makes `post-photos` private (2 MB, JPEG/PNG/WebP).
   3. [`supabase/migrations/0003_security_fixes.sql`](supabase/migrations/0003_security_fixes.sql) once. It stops users from changing `school_id` (only `name`, `bio` and `avatar_url` stay editable), forces each post's id and time on the server, drops in-place replacement of post photos, and lets the owner delete an upload that never became a post. `set_my_school` can set the school once while it is still empty.
   4. [`supabase/migrations/0004_likes_comments.sql`](supabase/migrations/0004_likes_comments.sql) once. It adds `likes` (one per person per post) and `comments` (1 to 300 characters). Both follow the same visibility as the post: Geral, or Campus for your own school. You can delete your own like. You can delete a comment you wrote, and the author of the post can delete any comment on it. Deleting a post or a profile removes the related likes and comments. It also replaces `list_posts` so the feed returns the like count, the comment count and whether you liked the post in the same query.
   5. [`supabase/migrations/0005_follows.sql`](supabase/migrations/0005_follows.sql) once. It adds `follows` (one row per pair, no self-follows) and replaces `list_posts` with a `seguindo` tab. A signed-in user can read every follow, insert only their own, and delete only their own. Campus posts of someone you follow appear only when you share their school. Deleting a profile, or the auth user that owns it, removes follows in both directions.
   6. [`supabase/migrations/0006_blocks.sql`](supabase/migrations/0006_blocks.sql) once. It adds `blocks` (one row per pair, no self-blocks) and schema `private`. You can read, insert and delete only your own blocks. Blocking removes follows in both directions. Posts, comments, likes and follows stay hidden in both directions, and the blocker's profile stays hidden from the person they blocked. The blocker can still open that profile. Unblocking does not restore follows. A follow aimed at someone in a block fails with the same foreign-key error as a profile that does not exist. `like_count` and `comment_count` are not reduced when a block hides those rows. Deleting a profile, or the auth user that owns it, removes blocks in both directions. Leave `private` out of the API exposed schemas.
   7. [`supabase/migrations/0007_pre_deploy.sql`](supabase/migrations/0007_pre_deploy.sql) once, after `0006`. It revokes anonymous `select` on `profiles` and anonymous `execute` on the functions that return profile fields. It lets the owner delete a `post-photos` object only when no post stores that path. It replaces `list_follows` with one query per direction. It lets `postgres` and `service_role` insert a follow with the given `follower_id`. It adds `slug`, `city`, and `kind`, upserts the ten real schools, and sets every other school to `active = false`. Do not delete the inactive rows.

   If you use the Supabase CLI, `supabase db push` runs the same files in order. Do not re-run `0001` after this. Its bucket section makes `post-photos` public again, and its grants let `authenticated` update every profile column, including `school_id`, and restore the photo replace policy. `0006` also recreates the anonymous profile policy. If you do re-run an older file, run every later file again, through `0007`.

5. In **Storage**, confirm `post-photos` exists and the public toggle is off. `avatars` stays public. There should be no update policy on `post-photos`. Deleting a `post-photos` object is allowed only for the owner's folder and only when no post still stores that path.

6. Optional checks, in the SQL Editor (each script rolls back, so it leaves no rows). A line starting with `FAIL:` means that check did not pass.

   Each script inserts its own schools and rolls them back. The placeholders from `0001` are inactive, so the tests do not use them. Run them after `0007`, because a school row needs a `slug`.

   - [`supabase/tests/school_lock.sql`](supabase/tests/school_lock.sql). A direct `school_id` update is blocked, an inactive school is rejected, `set_my_school` works once, a second call fails, updating `name` and `bio` still works, and the trigger still blocks `school_id` even if that column is granted.
   - [`supabase/tests/likes_comments.sql`](supabase/tests/likes_comments.sql). Two schools and three users: the other school cannot see, like or comment on a Campus post; a like is unique; the comment length is 1 to 300 characters; the author of a comment can delete it; the author of the post can delete someone else's comment; a third person cannot; deleting the post or the profile removes likes and comments.
   - [`supabase/tests/follows.sql`](supabase/tests/follows.sql). No self-follow and no duplicate pair; nobody can insert or delete a follow for another user; follows cannot be updated; anonymous users cannot read them. Following someone at another school shows their Geral post and hides their Campus post, in the Seguindo tab and on their profile. A campus post from the same school is visible. Deleting a profile, and deleting an auth user, removes follows in both directions. Counts come from the rows, not a stored column.
   - [`supabase/tests/blocks.sql`](supabase/tests/blocks.sql). No self-block and no duplicate pair. The blocked person cannot read the block row. Blocking removes follows in both directions. Neither person can read the other's posts, like, comment or follow. Old comments between them are hidden. Likes by either person on someone else's post are hidden from the other. Follow lists hide each other. The blocked person cannot read the blocker's profile, and the blocker still can. Following during a block returns the same error as a missing profile. Nothing in `public` tells a third person that the block exists. Unblocking does not restore follows. Deleting the auth user removes blocks in both directions. Someone at the same school can still read a Campus post. `like_count` still includes a like hidden by the block.
   - [`supabase/tests/pre_deploy.sql`](supabase/tests/pre_deploy.sql). Anonymous users cannot read profiles or call the profile functions, and a signed-in user still can. A photo used by a post cannot be deleted by its owner; an orphan photo can, and so can the photo after the post row is gone. `list_follows` keeps the same order in both directions, including pagination and a block. `follows_before_insert` still rejects a signed-in insert that breaks the old rules, and `postgres` / `service_role` can insert with the given `follower_id`. The ten real schools exist, are active, and running the upsert again does not duplicate them. The fictional schools are inactive. Anonymous users still see only active schools.
   - [`supabase/tests/bench_blocks.sql`](supabase/tests/bench_blocks.sql). Builds about 10k blocks, 20k posts, 10k follows and a post with 1000 comments, prints `EXPLAIN ANALYZE` timings for the feed, `get_post`, `follow_stats`, `list_follows` and `list_comments`, then rolls back.

   With `psql` or the CLI: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/school_lock.sql` and the same for `supabase/tests/likes_comments.sql`, `supabase/tests/follows.sql`, `supabase/tests/blocks.sql`, `supabase/tests/pre_deploy.sql` and `supabase/tests/bench_blocks.sql`.

7. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:8080](http://localhost:8080).

Without the Supabase variables the app still opens, but login is disabled and a notice is shown.

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Development server on port 8080                 |
| `npm run build`     | Production build (outputs to `.next-build`)     |
| `npm run preview`   | Serves the production build on `127.0.0.1:8081` |
| `npm run typecheck` | Type checking with TypeScript                   |
| `npm run lint`      | ESLint                                          |
| `npm run format`    | Formats the code with Prettier                  |

> **Windows:** `build` and `preview` set the `NEXT_DIST_DIR` variable Linux/macOS-style, which doesn't work in PowerShell or CMD. On Windows, run those two from Git Bash or WSL. `npm run dev` works normally.

## Deploying to Vercel

1. Import the repository on [Vercel](https://vercel.com/new). The Next.js framework is detected automatically.
2. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optionally set `NEXT_PUBLIC_SITE_URL` to the public `https` URL so share links do not depend on the Vercel hostname.
3. Deploy.
4. In Supabase, under **Authentication → URL Configuration**, set your Vercel domain as the _Site URL_ so email confirmation links work.

## Roadmap

Planned for after v1:

- Direct messages and groups
- The Clips
- Verified student badge
- Search

## License

Distributed under the MIT License. See [LICENSE](LICENSE).

## Author

Made by **Sérgio Vieira** · GitHub [@EstiveJobson](https://github.com/EstiveJobson)
