# Nova Panel — SMM panel

A ground-up rebuild of the SMM panel concept behind `codedByCan/SpeedSmm_v3`, written as a
modern, fully-configurable application: Next.js App Router, TypeScript, Prisma and SQLite.

Everything that an operator would normally have to edit in source — branding, languages,
translations, currencies, exchange rates, payment gateway credentials, themes, order rules —
is stored in the database and edited from the admin area.

## Principles

- **Admin-owned configuration.** No panel behaviour is hard-coded in source files.
- **Multi-interface.** Five bundled skins, each with a light and a dark palette, switchable
  per user; every colour token is editable.
- **Multi-language.** Bundled Vietnamese and English dictionaries, plus a translation table
  so any language can be added and edited without a deploy.
- **Multi-currency.** All money is stored in a single base currency and rendered in the
  viewer's currency at the configured rate.
- **SVG only.** Every glyph comes from `src/components/icons.tsx`. No emoji, no icon fonts.

## Stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Next.js 15 (App Router, server actions) |
| Language  | TypeScript                              |
| Styling   | Tailwind CSS v4 + CSS custom properties |
| Database  | Prisma ORM, SQLite (swappable)          |
| Auth      | Database sessions in httpOnly cookies   |

## Getting started

```bash
npm install
cp .env.example .env      # set DATABASE_URL and AUTH_SECRET
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Seeded accounts:

| Role  | Username | Password  |
| ----- | -------- | --------- |
| Admin | `admin`  | Admin@123 |
| User  | `demo`   | Demo@123  |

## Payment methods

| Method                | Region        | Flow                                          |
| --------------------- | ------------- | --------------------------------------------- |
| SePay                 | Vietnam       | Bank transfer + QR, credited by webhook       |
| PayPal                | Global        | Hosted checkout, credited on capture          |
| Link by Stripe        | Global        | Payment intent, credited on webhook           |
| Manual bank transfer  | Any           | Operator reviews and approves                 |

Credentials for each are entered in Admin → Payment methods; nothing lives in `.env`.

## Screenshots

Captured with `node scripts/shoot.mjs <name> <path>` and stored in `docs/screenshots/`.

### Dashboard and ordering

| Dashboard | New order |
| --------- | --------- |
| ![](docs/screenshots/08-dashboard.png) | ![](docs/screenshots/11-new-order.png) |

| Orders | Service catalogue |
| ------ | ----------------- |
| ![](docs/screenshots/13-orders.png) | ![](docs/screenshots/09-services.png) |

### Mobile

| Dashboard | Service picker | Order form |
| --------- | -------------- | ---------- |
| ![](docs/screenshots/m4-dashboard.png) | ![](docs/screenshots/m5-service-picker.png) | ![](docs/screenshots/m6-new-order.png) |

| Landing | Services | Sign in |
| ------- | -------- | ------- |
| ![](docs/screenshots/m1-landing.png) | ![](docs/screenshots/m2-services.png) | ![](docs/screenshots/m3-login.png) |

### Landing page

| Aurora / dark | Aurora / light |
| ------------- | -------------- |
| ![](docs/screenshots/01-landing-aurora-dark.png) | ![](docs/screenshots/02-landing-aurora-light.png) |

| Midnight / dark | Citrus / light |
| --------------- | -------------- |
| ![](docs/screenshots/03-landing-midnight-dark.png) | ![](docs/screenshots/04-landing-citrus-light.png) |

## Build order

Features land one at a time, each verified with a screenshot before the next begins.

- [x] 1 — Foundation: data model, theme engine, i18n, currency, icon set, landing page
- [x] 2 — Authentication
- [x] 3 — Service catalogue
- [x] 4 — User dashboard and ordering
- [ ] 5 — Wallet and payment gateways
- [ ] 6 — Support tickets and notifications
- [ ] 7 — Admin area
- [ ] 8 — Public API v2
