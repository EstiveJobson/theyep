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

## Current production caveat

Login/verificacao is intentionally fake for now. Until real auth exists, user identity is provisional and based on the active handle sent by the app.
