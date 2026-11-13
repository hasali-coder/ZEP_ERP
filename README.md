# ZEP ERP

A focused financial workspace for independent professionals and small businesses.

## Phase 1: Supabase foundation

Connected Supabase project: **ZEP ERP** (gyiarfvxozumqrmexxfj) in the **Muange** organization.

This release includes:

- Email/password sign-in, registration, verification, password reset, and sign-out.
- Secure business creation after signing in.
- Owner memberships automatically created by a protected database trigger.
- 16 tenant-scoped financial and identity tables with RLS enabled.
- Database migrations in supabase/migrations and generated TypeScript types.
- The approved financial dashboard and other screens, retained as a clearly labeled **local data preview**.

**Not connected yet:** invoices, contacts, quotations, expenses, payments, and reports still use sample data in browser storage when previewed. Their database workflows will be implemented in the following phases. Do not use the preview to store real financial records.

## Run locally on Windows

1. Install Node.js LTS, then extract this project.
2. Open Command Prompt in the folder containing package.json.
3. Run the command: npm ci
4. Copy .env.example to .env.local.
5. Open the [ZEP ERP Supabase API keys page](https://supabase.com/dashboard/project/gyiarfvxozumqrmexxfj/settings/api-keys), find the **publishable** key (starts with sb_publishable_), and paste it into VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.
6. In Supabase **Authentication → URL Configuration**, set the Site URL to http://localhost:3000 and add these redirect URLs: http://localhost:3000 and http://localhost:3000/?reset=1.
7. Run: npm run dev
8. Open http://localhost:3000.

If .env.local has no key, the app intentionally shows the local UI preview and a prominent notice; no Supabase login appears.

## Security model

- Each business has a distinct UUID and an owner in Supabase Auth.
- Business memberships control access; the database, not the UI, enforces that access.
- Public schema tables have RLS enabled. Users can only read records for their own businesses.
- In Phase 1, authenticated users can create/update their own profile and business. Financial tables are **read-only** until validated writes are introduced.
- No elevated Supabase key is used in the browser.

## Development commands

- npm run dev — local Vite server on port 3000
- npm run lint — TypeScript validation
- npm run build — production bundle

The migration filenames match the versions already applied to the ZEP ERP cloud database. Subsequent changes should use a new migration rather than editing applied files.
