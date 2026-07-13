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

The landing page lives in `website/` (Vite + React + Framer Motion) and builds into `public/` on deploy.

```bash
npm run website:dev    # local preview at http://localhost:5173
npm run website:build  # output to public/
```

Deploy with `npm run deploy:api` — Vercel runs `build:website` once via `vercel.json`, which builds the site into `public/`. API routes remain at `/api/*`.


Deploy the API to Vercel with these env vars:

- `NEXT_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY` for writes)

## Supabase tables

- `inventory_uploads` — PDF upload metadata
- `inventory_items` — parsed vehicles (`lot_status`: active / sold / auctioned)
- `vehicle_scans` — VIN scans with GPS coordinates
