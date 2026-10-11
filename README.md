# TheYep

> Bringing back the fun, colorful and social internet, made for students and schools.

**Status:** v1 in development 🚧

TheYep is a lightweight social network for school communities: you sign up with your email, set up your profile and follow what people at your school are posting. It is mobile-first and can be installed as an app (PWA). The app's interface is in Brazilian Portuguese.

## Features

### Working now

- Sign up and log in with email and password (Supabase Auth)
- Profile page with name, bio, photo (or the name's initial) and join date. The profile is created automatically on sign-up
- Log out
- Light and dark theme, following the system or chosen by the user
- Mobile-first navigation: bottom tab bar on phones and top menu on desktop
- PWA: manifest and icons for installing to the home screen
- Posts with text (up to 500 characters) and/or one photo. A post can go to the general feed, the campus feed, or both. Campus is available only when the profile has a school
- General feed and campus feed on the home screen, newest first, 20 posts per page
- Delete your own post, which also removes its photo
- Database with Row Level Security: each user can only create and edit their own profile, publish as themselves, and upload files to their own folder. Campus posts and their photos are visible only to people at that school. Post photos live in a private bucket and are shown with short-lived signed URLs

### In progress (v1 scope)

- Likes and comments
- Deleting your own account

Campus uses `profiles.school_id`. The profile screen does not edit that field yet, so a profile with no school only sees Geral.

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

4. Set up the database: open the Supabase **SQL Editor** and run [`supabase/migrations/0001_foundation.sql`](supabase/migrations/0001_foundation.sql) once. Before that, replace the placeholder names `[ESCOLA_1]`, `[ESCOLA_2]` and `[ESCOLA_3]` with real schools. Then run [`supabase/migrations/0002_posts.sql`](supabase/migrations/0002_posts.sql) once. It creates `posts` and makes the `post-photos` bucket private (2 MB, JPEG/PNG/WebP). Do not re-run the bucket section of `0001` after that, or the bucket becomes public again — if you do, run `0002` again.

5. In **Storage**, confirm `post-photos` exists and the public toggle is off. `avatars` stays public.

6. Start the development server:

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
