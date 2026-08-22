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
cp .env.example .env      # set AUTH_SECRET and APP_URL
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Seeded accounts:

| Role  | Username | Password  |
| ----- | -------- | --------- |
| Admin | `admin`  | Admin@123 |
| User  | `demo`   | Demo@123  |

## Chạy trên máy (không cần VPS)

Panel dùng SQLite — database là một file, không có Docker, Redis hay service ngoài
nào phải dựng. Cần đúng ba thứ: **Node ≥ 20.6**, Git, và một trình soạn thảo.

Chạy năm lệnh ở trên là xong, mở `http://localhost:3000`. Trước khi chạy, sửa hai
dòng trong `.env`:

| Biến          | Để gì khi chạy máy                                                    |
| ------------- | --------------------------------------------------------------------- |
| `AUTH_SECRET` | Một chuỗi ngẫu nhiên dài. Để nguyên mẫu thì phiên đăng nhập ký bằng chuỗi ai cũng biết. |
| `APP_URL`     | `http://localhost:3000`. Mẫu để sẵn `https://your-panel.com`, giữ nguyên thì link quay về sau thanh toán và URL webhook trỏ sai chỗ. |

`localhost` chạy được ngay mà không phải cấu hình DNS: seed luôn gắn `localhost` và
`127.0.0.1` làm hostname cho panel gốc.

**Chạy trên máy thì ba thứ này không hoạt động, và đó là do bản chất chứ không phải lỗi:**

- **Webhook thanh toán.** Cổng thanh toán phải gọi ngược vào máy bạn, mà máy bạn
  không có địa chỉ công khai. Muốn thử thì mở đường hầm bằng `ngrok` hoặc
  `cloudflared` rồi đặt `APP_URL` thành URL đó. Không cần thử thì dùng **Chuyển
  khoản thủ công** — operator tự duyệt, không đụng webhook.
- **Cron đồng bộ đơn.** Không có scheduler chạy nền; bấm tay trong `/admin/cron`.
- **Nhà cung cấp thật.** Cần API key thật của một panel nguồn.

Mọi thứ còn lại chạy đủ: đặt đơn, ví, affiliate, ticket, blog, panel con, đổi giao
diện, ngôn ngữ và tiền tệ.

**Làm lại từ đầu:** xoá `prisma/dev.db` rồi chạy lại `npx prisma migrate deploy` và
`npm run db:seed`.

**Lệnh hay dùng:** `npm run dev` (chạy phát triển), `npm test` (test đơn vị),
`npm run smoke` (mở mọi trang — cần app đang chạy sẵn).

## Production

SQLite is fine for a single machine. For a hosted deployment with more than one
process, switch the Prisma datasource to PostgreSQL:

1. Set `provider = "postgresql"` in `prisma/schema.prisma`
2. Point `DATABASE_URL` at your database (see `.env.example`)
3. Run `npx prisma migrate deploy`

**API rate limiting** is held in memory per server process. On one Node instance
that is enough; behind a load balancer each replica keeps its own counter, so
either run a single API worker or put a shared limiter (Redis, edge rate limit)
in front if you need a hard ceiling across machines. The per-minute limit is
configured in Admin → Settings → API.

Ảnh upload nằm ở `var/uploads/` — **ngoài** `public/`, vì bản production phục vụ
`public/` theo ảnh chụp lúc khởi động: file ghi vào đó sau khi server chạy sẽ 404
cho tới lần khởi động lại. Route `/uploads/...` đọc thẳng từ đĩa mỗi lượt gọi, nên
ảnh vừa upload hiện ra ngay. Sao lưu ảnh là sao lưu thư mục `var/uploads/`.

## Payment methods

| Method                | Region        | Flow                                          |
| --------------------- | ------------- | --------------------------------------------- |
| SePay                 | Vietnam       | Bank transfer + QR, credited by webhook       |
| MoMo                  | Vietnam       | Wallet redirect, credited on IPN              |
| ZaloPay               | Vietnam       | Wallet redirect, credited on callback         |
| ViettelPay            | Vietnam       | Wallet redirect, credited on IPN              |
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

### Admin

| Overview | Platforms | Services |
| -------- | --------- | -------- |
| ![](docs/screenshots/20-admin-overview.png) | ![](docs/screenshots/21-admin-platforms.png) | ![](docs/screenshots/25-admin-services.png) |

| Platform editor | Service editor |
| --------------- | -------------- |
| ![](docs/screenshots/22-admin-platform-drawer.png) | ![](docs/screenshots/24-admin-service-drawer.png) |

| Appearance | Theme editor |
| ---------- | ------------ |
| ![](docs/screenshots/45-admin-appearance.png) | ![](docs/screenshots/46-admin-theme-editor.png) |

| Payment methods | Currencies | Settings |
| --------------- | ---------- | -------- |
| ![](docs/screenshots/29-admin-payments.png) | ![](docs/screenshots/31-admin-currencies.png) | ![](docs/screenshots/34-admin-settings.png) |

| Languages | Translation editor |
| --------- | ------------------ |
| ![](docs/screenshots/32-admin-languages.png) | ![](docs/screenshots/33-admin-translations.png) |

| Support (customer) | Support (staff) |
| ------------------ | --------------- |
| ![](docs/screenshots/40-ticket-thread.png) | ![](docs/screenshots/42-admin-ticket-thread.png) |

| Orders | Users | Deposits |
| ------ | ----- | -------- |
| ![](docs/screenshots/35-admin-orders.png) | ![](docs/screenshots/36-admin-users.png) | ![](docs/screenshots/37-admin-transactions.png) |

### Wallet and payments

| Add funds | SePay transfer | Transactions |
| --------- | -------------- | ------------ |
| ![](docs/screenshots/17-wallet.png) | ![](docs/screenshots/18-deposit-qr.png) | ![](docs/screenshots/19-transactions.png) |

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

## Pricing and access, per customer

Tiers price a class of customer. These price and permit one.

| Control              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| Custom rate          | One service, one customer, one price — outranks the tier          |
| Personal discount    | A percentage off, compounded onto the tier's own                  |
| Copy rates           | One customer's whole rate card onto others, by username           |
| Reset rates          | Drops the overrides on any number of accounts at once             |
| Access rules         | Ordering, refills, cancels, deposits, tickets, API, affiliate, panels |
| Payment methods      | Which ways this one account may add funds                         |

Access rules are stored as refusals, so absence is permission: a rule added in
a later build bars nobody retroactively. They are enforced on the forms and on
`/api/v2` alike.

| Rate card and access rules | Bulk repricing |
| -------------------------- | -------------- |
| ![](docs/screenshots/60-admin-user-pricing.png) | ![](docs/screenshots/64-admin-services-mass.png) |

## Catalogue operations

- **Mass edit rates** by percentage or to a figure. Services following a
  provider's price are skipped and reported rather than overwritten by the
  next sync an hour later
- **Quantity step**, so a provider that only takes round hundreds refuses at
  the order form instead of after the charge
- **Overflow**, a percentage ordered upstream on top of what the customer
  bought to cover drops. They are never charged for it
- **Restore**, because a delete marks the row rather than destroying it —
  orders point at services, and the wrong service does get deleted
- **Likes spread**, delivering across the posts already on a profile, sharing
  the subscription plumbing and differing only in which count is sent

## Blog

Posts get their own address, their own meta tags and their own publish time —
set one in the future and the post appears on its own, with nothing having to
run. Published posts join the sitemap and are submitted to IndexNow; scheduled
ones are not, because a crawler sent to a 404 remembers the address as broken.

| Index | Post | Admin |
| ----- | ---- | ----- |
| ![](docs/screenshots/63-blog.png) | ![](docs/screenshots/65-blog-post.png) | ![](docs/screenshots/62-admin-blog.png) |

## Support desk

Saved replies are written once by an admin and inserted by anyone on the desk.
Inserting appends rather than replaces: the canned text is the bones of an
answer and the half-sentence already typed about this customer is what makes it
one. The list orders itself by use.

![](docs/screenshots/61-admin-saved-replies.png)

Both sides can attach images. Most tickets in this market are a screenshot —
"this order is not running, look" — and asking for it in words costs the desk a
round trip per ticket. The number allowed and the size of each are the
operator's, in Settings → Support, and switching them off removes the picker
rather than refusing at the end.

The files are not public. Everything an operator uploads is served to anyone
who knows the address; a customer's screenshot is served only to the customer
whose ticket it is and to the desk, through a route that checks the reader.
Anyone else gets 404 rather than 403 — a 403 confirms the attachment exists,
which is most of what an id is worth.

![](docs/screenshots/66-ticket-attachments.png)

## Reseller API

`/api/v2` and `/api/v3` expose the same handler, shaped to the de-facto SMM
panel standard so existing client libraries work unchanged. Accepts POST bodies
(form or JSON) or GET with query parameters; the API key may be sent as a body
field or as `Authorization: Bearer <key>`. Errors return HTTP 200 with an
`error` key.

| Action          | Parameters                                    |
| --------------- | --------------------------------------------- |
| `services`      | —                                             |
| `balance`       | —                                             |
| `add`           | `service`, `link`, `quantity`, `runs`, `interval` |
| `status`        | `order`, or `orders` for a batch              |
| `orders`        | `orders` (comma-separated, max 100)           |
| `multi-status`  | same as `orders`                              |

| Dashboard API (v2 + v3) | API docs (v3, multi-status) |
| ----------------------- | --------------------------- |
| ![](docs/screenshots/47-dashboard-api-v3.png) | ![](docs/screenshots/48-api-docs-v3.png) |

| Payment methods (ViettelPay) | Inbox channels |
| ------------------------------ | -------------- |
| ![](docs/screenshots/49-admin-payments-viettelpay.png) | ![](docs/screenshots/50-admin-channels-inbox.png) |

![](docs/screenshots/43-api-docs.png)

## Provider integration

Upstream panels speak the same standard this panel exposes at `/api/v2`, so a
provider can be any compatible panel — including another instance of this one.

- Import a provider's catalogue with a markup; imported services land disabled
  so nothing goes on sale before review
- Queued orders are pushed upstream and the returned id is stored against them
- Statuses are pulled back in one request per provider, not per order
- An upstream cancellation refunds the customer; a partial delivery refunds
  only the undelivered share
- `POST /api/cron/sync` runs both passes for a scheduler, gated by `CRON_SECRET`
- A provider can carry an alias, shown in place of its name everywhere but the
  providers page itself — the route list, an order's note, the sync alerts —
  so a screenshot does not carry the supplier list

![](docs/screenshots/50-admin-providers.png)

## Build order

Features land one at a time, each verified with a screenshot before the next begins.

- [x] 1 — Foundation: data model, theme engine, i18n, currency, icon set, landing page
- [x] 2 — Authentication
- [x] 3 — Service catalogue
- [x] 4 — User dashboard and ordering
- [x] 5 — Wallet and payment gateways
- [x] 6 — Support tickets and notifications
- [x] 7 — Admin area
- [x] 8 — Public API v2
- [x] 9 — Provider integration
- [x] 10 — Refill and cancellation requests
- [x] 11 — Per-customer pricing and access rules
- [x] 12 — Catalogue operations: bulk repricing, quantity steps, overflow, restore
- [x] 13 — Saved replies, provider aliases and the blog
