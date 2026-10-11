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
- General feed and campus feed on the home screen, newest first, 20 posts per page
- Delete your own post, which also removes its photo, likes and comments
- Like a post once. The heart is filled pink when it's yours, with the count beside it. A second tap removes the like
- Comments on the post page (`/post/[id]`), up to 300 characters, oldest first. The card says “1 comentário” or “X comentários”. You can delete your own comment, and the post's author can delete any comment on it
- Database with Row Level Security: each user can only create and edit their own profile, publish as themselves, and upload files to their own folder. Campus posts, their photos, likes and comments are visible only to people at that school. Post photos live in a private bucket and are shown with short-lived signed URLs

### In progress (v1 scope)

- Deleting your own account

Campus uses `profiles.school_id`. A person can choose a school only once, through `set_my_school`, and only while the field is empty. Sign-up and your own profile both call that function. They never write `school_id` directly, and `handle_new_user` still does not set a school. A direct update of `school_id` is rejected. Logged-out visitors can already read active schools: `0001` grants `anon` `select` and the policy “escolas ativas sao publicas” keeps the rows to `active = true`. The sign-up list asks only for `id`, `name` and `short_name`, so no new migration was added. A profile with no school only sees Geral.

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
│   │   ├── perfil/          # /perfil  Login, sign-up and profile
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css      # theme and colors
│   ├── components/          # Shell, feed, composer and profile
│   ├── lib/
│   │   ├── supabase/        # Supabase clients (browser, server and middleware)
│   │   └── relative-time.ts
│   ├── server/posts.ts      # feed, create and delete
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

   1. [`supabase/migrations/0001_foundation.sql`](supabase/migrations/0001_foundation.sql) once. Before that, replace `[ESCOLA_1]`, `[ESCOLA_2]` and `[ESCOLA_3]` with real schools.
   2. [`supabase/migrations/0002_posts.sql`](supabase/migrations/0002_posts.sql) once. It creates `posts` and makes `post-photos` private (2 MB, JPEG/PNG/WebP).
   3. [`supabase/migrations/0003_security_fixes.sql`](supabase/migrations/0003_security_fixes.sql) once. It stops users from changing `school_id` (only `name`, `bio` and `avatar_url` stay editable), forces each post's id and time on the server, drops in-place replacement of post photos, and lets the owner delete an upload that never became a post. `set_my_school` can set the school once while it is still empty.
   4. [`supabase/migrations/0004_likes_comments.sql`](supabase/migrations/0004_likes_comments.sql) once. It adds `likes` (one per person per post) and `comments` (1 to 300 characters). Both follow the same visibility as the post: Geral, or Campus for your own school. You can delete your own like. You can delete a comment you wrote, and the author of the post can delete any comment on it. Deleting a post or a profile removes the related likes and comments. It also replaces `list_posts` so the feed returns the like count, the comment count and whether you liked the post in the same query.

   There is no fifth migration. The school picker reads active schools with the `anon` key, which `0001` already allows. In the app, a chosen school is stored only by calling `set_my_school`.

   If you use the Supabase CLI, `supabase db push` runs the same files in order. Do not re-run `0001` after this. Its bucket section makes `post-photos` public again, and its grants let `authenticated` update every profile column, including `school_id`, and restore the photo replace policy. If you do re-run it, run `0002`, then `0003`, then `0004` again.

5. In **Storage**, confirm `post-photos` exists and the public toggle is off. `avatars` stays public. There should be no update policy on `post-photos`.

6. Optional checks, in the SQL Editor (each script rolls back, so it leaves no rows). A line starting with `FAIL:` means that check did not pass.

   - [`supabase/tests/school_lock.sql`](supabase/tests/school_lock.sql) after `0003`. A direct `school_id` update is blocked, an inactive school is rejected, `set_my_school` works once, a second call fails, updating `name` and `bio` still works, and the trigger still blocks `school_id` even if that column is granted.
   - [`supabase/tests/likes_comments.sql`](supabase/tests/likes_comments.sql) after `0004`. Two schools and three users: the other school cannot see, like or comment on a Campus post; a like is unique; the comment length is 1 to 300 characters; the author of a comment can delete it; the author of the post can delete someone else's comment; a third person cannot; deleting the post or the profile removes likes and comments.

   With `psql` or the CLI: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/school_lock.sql` and the same for `supabase/tests/likes_comments.sql`.

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
