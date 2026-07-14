# Auditur

Mobile inventory auditing app for dealership lots. Upload a price-list PDF, scan VIN barcodes with your phone camera, and pin vehicles on a map with GPS.

Built with **Expo** (React Native) — run on your phone via Expo Go and a QR code.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Copy env vars:

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from your [Supabase](https://supabase.com) project.

3. Start the dev server:

```bash
npx expo start
```

4. Scan the QR code with **Expo Go** on your iPhone or Android device.

> Camera and GPS require a physical device — they won't work in the simulator alone.

## App tabs

| Tab | What it does |
|-----|--------------|
| **Upload** | Pick a dealership PDF; vehicles are parsed and saved to Supabase |
| **Scan** | Scan VIN barcodes; captures GPS and matches against inventory |
| **Map** | View pinned vehicles; mark sold or auctioned |

## PDF upload API

PDF parsing runs server-side (Node) via `docutext` — it never runs on the phone. The app posts to `EXPO_PUBLIC_UPLOAD_API_URL`, which defaults to the Vercel serverless function at `/api/upload`.

## Marketing website

The landing page lives in `website/` (Next.js + Framer Motion) and builds into `public/` on deploy.

```bash
npm run website:dev    # local preview at http://localhost:5173
npm run website:build  # output to public/
```

### Manager dashboard

- **Sign up / Sign in:** `/signup` and `/login` — use a work email and password. Signup also asks whether the user is an owner/GM or employee.
- **Admin unlock:** `/auth/admin/?key=auditur-lot-admin` — opens the dashboard as `admin@auditur.app` with no email login
- **Dashboard:** `/dashboard` — live audit progress, scan feed, lot sections, upload log

**Owner / admin access (local only)**

| | |
|---|---|
| Local admin email | `admin@auditur.app` |
| How | On `localhost`, enter that email and any 8-character password on `/login` |
| Alt | `http://localhost:5173/auth/admin/` |

This does **not** work on production (`auditur-ruby.vercel.app`).

Set these on Vercel (and in `website/.env.local` for local dev):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Immediate signup:** in Supabase → Authentication → Providers → Email, turn off
**Confirm email**. Otherwise Supabase will still send a confirmation link before
creating a session.

**Production URLs** — in Supabase → Authentication → URL Configuration:

- Site URL: `https://auditur-ruby.vercel.app`
- Redirect URLs: `https://auditur-ruby.vercel.app/**` and `http://localhost:5173/**`

**Production host:** `https://auditur-ruby.vercel.app` (not `auditur.vercel.app`).

If login works locally but production says Supabase is not configured, production is almost always serving an **old static build**. Check Deployments on the **auditur-ruby** Vercel project and confirm the latest successful deploy is from current `main`. Setting env vars does nothing until that project rebuilds.


Deploy the API to Vercel with these env vars:

- `NEXT_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` for writes)

## Supabase tables

- `inventory_uploads` — PDF upload metadata
- `inventory_items` — parsed vehicles (`lot_status`: active / sold / auctioned)
- `vehicle_scans` — VIN scans with GPS coordinates
