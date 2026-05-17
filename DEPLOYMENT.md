# TheYep deployment notes

The current backend is ready for a small single-server alpha.

## Run locally

```bash
npm.cmd install
npm.cmd run dev:full
```

Frontend dev server:

```text
http://localhost:5173
```

Backend API:

```text
http://127.0.0.1:4100
```

## Run as one server

```bash
npm.cmd run build
npm.cmd start
```

Then open the backend host/port. The backend serves the built frontend from `dist/` and the API from `/api`.

## Environment

Copy `.env.example` into the hosting provider settings and set:

- `PORT`: server port.
- `HOST`: use `0.0.0.0` on a server.
- `THEYEP_ALLOWED_ORIGINS`: production domain.
- `THEYEP_DATABASE_PATH`: SQLite database path.
- `THEYEP_RATE_LIMIT_PER_MINUTE`: basic anti-spam limit.
- `THEYEP_SERVE_FRONTEND`: keep `true` to serve frontend and backend from one domain.
- `THEYEP_EMAIL_FROM`: sender address, currently `theyep.team@gmail.com`.
- `THEYEP_SMTP_HOST`, `THEYEP_SMTP_PORT`, `THEYEP_SMTP_USER`, `THEYEP_SMTP_PASS`: SMTP credentials for account confirmation codes. For Gmail, use an app password, not the normal account password.
- `THEYEP_VIDEO_UPLOAD_LIMIT_BYTES`: default is `524288000` for 500 MB videos.
- `THEYEP_ADMIN_HANDLES`: comma-separated founder/admin handles.

## Account creation

The local backend now supports real account creation for the alpha:

- institutional e-mail must look like `0000000000@ulife.com.br`;
- the backend sends a six-digit confirmation code by SMTP;
- if SMTP is not configured, the local dev response includes a temporary dev code so the flow can still be tested;
- users choose first name, last name, handle, language, and one of the two campuses: `Campus Paralela` or `Campus Tancredo Neves`.

This does not yet verify against an official Unifacs/Anima student database. It only verifies the e-mail format and the confirmation code.

## Domain and provider plan

Target domain: `theyep.com.br`.

Desired free-plan split:

- Vercel: frontend hosting.
- Supabase: production auth/database/image storage.
- Cloudflare R2: large video storage.

The app is prepared locally with environment placeholders in `.env.example`, but the provider projects, secrets, buckets, DNS records, and Gmail app password still need to be created in the actual accounts. Those steps require account access/credentials and cannot be completed from the codebase alone.

## Files added for provider deployment

- `vercel.json`: Vercel build/output config and SPA rewrite.
- `supabase/schema.sql`: production-target database tables, constraints, and RLS policies.
- `supabase/README.md`: short Supabase setup notes.
- `api/r2/presign.ts`: Vercel Function that creates a signed upload URL for Cloudflare R2 videos.
- `api/_lib/r2.ts`: R2 client used by the Vercel Function.
- `src/supabaseClient.ts`: browser Supabase client for image storage.

## Dashboard steps

### Vercel

1. Import the GitHub repository.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add the environment variables from `.env.example`.
6. Set `VITE_THEYEP_VIDEO_STORAGE=r2` only when the R2 bucket, public URL, and Vercel Function secrets are ready.

### Supabase

1. Create the project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Create a public image bucket named `theyep-images`.
4. Copy Project URL and anon key into Vercel as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Copy service role key into Vercel only as a secret variable, never into frontend code.

### Cloudflare R2

1. Create bucket `theyep-videos`.
2. Create an R2 API token/access key.
3. Add R2 variables to Vercel.
4. Configure CORS on the bucket to allow `PUT` from `https://theyep.com.br`.
5. Configure a public/custom domain for video reads and set it as `CLOUDFLARE_R2_PUBLIC_URL`.

## DNS outline for registro.br

After Vercel gives the production DNS values:

- add Vercel's required `A` record for the apex domain if Vercel requests one;
- add Vercel's required `CNAME` for `www`;
- keep the records exactly as Vercel shows them, then wait for propagation;
- in Vercel, set `theyep.com.br` as the production domain and redirect `www.theyep.com.br` to it or the reverse, whichever you prefer.

For Supabase and R2, use subdomains only if you want public asset URLs later, for example `img.theyep.com.br` or `video.theyep.com.br`.
