# INSEAD 26D Network

Private class directory for the INSEAD MBA Class of December 2026.

## Setup

### 1. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the **SQL Editor**, run the migration:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. In **Storage**, create a bucket called `profiles` (set to public for avatars).
4. Enable **Email Auth** (OTP + magic link) in Authentication settings.

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for local dev |

### 3. Install dependencies

```bash
npm install
```

### 4. Import CV data

This seeds all 413 profiles from the CV book into Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/migrate-data.ts
```

Or set the vars in `.env.local` first and use:

```bash
npx dotenv -e .env.local -- npx ts-node scripts/migrate-data.ts
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- **Next.js 15 App Router** — Server Components for data fetching, Server Actions for mutations
- **Supabase** — PostgreSQL database + Auth (email OTP)
- **Registration flow**: name fuzzy-search → confirm INSEAD email → OTP code → set password → onboarding wizard
- **CV data** — read server-side from `../insead-cvbook/cvdata.json` (never sent to client)
- **LinkedIn enrichment** — merged from `../insead-cvbook/linkedin_enrichment.json`

## File Structure

```
src/
  app/
    (auth)/          # login, register, forgot-password, reset-password, verify-email
    (app)/           # directory, stats, contacts, profile, onboarding
    api/profile/export/  # data export endpoint
  components/
    ui/              # Button, Input, Card, Modal, Toast, Avatar, Badge, SessionTimeoutWarning
    app/             # DirectoryClient, ProfileCard, ProfileModal
  lib/
    supabase/        # client.ts, server.ts, middleware.ts
    cv-data.ts       # server-side CV data utilities
    utils.ts         # cn(), fuzzyMatch(), formatDate()
  types/index.ts
supabase/
  migrations/001_initial_schema.sql
scripts/
  migrate-data.ts
```
