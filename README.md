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
- Database with Row Level Security: each user can only create and edit their own profile and only upload files to their own folder

### In progress (v1 scope)

- General feed and campus feed (the home screen is still a placeholder)
- Text and photo posts, with a choice of who can see them
- Likes and comments
- Deleting your own posts and your own account

The database already has the schools table and the photo buckets (`avatars` and `post-photos`) ready for these features.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com/): auth, Postgres and Storage (`@supabase/ssr` and `@supabase/supabase-js`)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Lucide](https://lucide.dev/) icons and the Nunito font (`next/font`)
- ESLint + Prettier

Brand colors: pink `#F06292`, blue `#42A5F5` and yellow `#FFD54F`.

## Project structure

```
.
├── public/                  # icons, favicon, OG image and manifest.webmanifest (PWA)
├── src/
│   ├── app/                 # routes (App Router)
│   │   ├── layout.tsx       # root layout, font, theme and metadata
│   │   ├── page.tsx         # /        Home (feed)
│   │   ├── postar/          # /postar  Post
│   │   ├── perfil/          # /perfil  Login, sign-up and profile
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css      # theme and colors
│   ├── components/          # Shell (header and tabs) and profile panel
│   ├── lib/
│   │   ├── supabase/        # Supabase clients (browser, server and middleware)
│   │   └── relative-time.ts
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
   ```

   Only use the `anon` key. Never put the `service_role` key in the project and never commit `.env.local`.

4. Set up the database: open the Supabase **SQL Editor** and run the contents of [`supabase/migrations/0001_foundation.sql`](supabase/migrations/0001_foundation.sql) once. Before that, replace the placeholder names `[ESCOLA_1]`, `[ESCOLA_2]` and `[ESCOLA_3]` with real schools.

5. Start the development server:

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
2. Under **Settings → Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
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
