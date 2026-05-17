# TheYep Supabase setup

Run `schema.sql` in the Supabase SQL editor after creating the project.

Recommended project values:

- Project name: `theyep`
- Image bucket: `theyep-images`
- Auth providers: email/password for now
- Site URL: `https://theyep.com.br`
- Redirect URLs: `https://theyep.com.br`, `https://www.theyep.com.br`, and local dev URLs while testing

The app still needs the next code migration step before production uses Supabase as the live backend. This schema is the production target shape.
