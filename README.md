# A11ytest.ai – Accessibility Testing SaaS Platform

A11ytest.ai is an accessibility testing platform that helps developers and businesses test websites and documents for **WCAG 2.2**, **Section 508**, and **PDF/UA** compliance. It provides detailed reports with actionable fixes, AI-powered recommendations, and a **CI Scan API** for pipelines.

## Features

### Core
- **Website scanning** – Single-page and multi-page scans with axe-core; WCAG 2.2 (A, AA, AAA) and Section 508.
- **Document scanning** – PDF accessibility (ISO 14289-1 / PDF/UA); optional server-side auto-fix with PyMuPDF.
- **Free scan** – Homepage scan without signup; sign up for full results and remediation.
- **Reports** – Per-scan reports with issue breakdown, screenshots, and code-fix suggestions.

### API & integrations
- **CI Scan API** – `POST /api/ci/scan` for any pipeline (GitHub Actions, GitLab CI, Azure Pipelines, etc.). API key or RapidAPI auth; single or multiple URLs (max 50); pass/fail for builds. See [docs/CI-SCAN-API.md](docs/CI-SCAN-API.md).
- **API keys** – Create and manage keys under Settings → API Keys (subscription required); rate limit 30 req/min per key.
- **Integrations** – Jira and Azure DevOps backlog integration (organization settings).

### Product
- **Organizations** – Teams, members, and subscription per organization.
- **Subscriptions** – Stripe-based plans (monthly/yearly); per-seat billing.
- **Dashboard** – Recent scans, credits, and navigation to scan history, document scan, and new scan.
- **Playground** – Try accessibility checks in-browser.
- **Logo contrast checker** – Check logo contrast against backgrounds.

### Technical
- **Auth** – JWT-based login/signup; email verification; password reset.
- **Security** – API key hashing (SHA-256), timing-safe compare, rate limiting, SSRF protection (no localhost/private URLs), pen-test script (`npm run pen-test`).

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide React |
| Forms | React Hook Form, Zod |
| Accessibility engine | axe-core, Pa11y, Lighthouse |
| Browser automation | Puppeteer / Chromium |
| Database | PostgreSQL (e.g. Neon) via `pg` |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Payments | Stripe |
| Email | Resend |
| PDF | PDFKit, pdf-lib, Adobe PDF Services (optional), PyMuPDF (optional) |

## Getting started

### Prerequisites
- **Node.js 18+**
- **npm** (or yarn)

### Installation

1. **Clone and enter the project**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**  
   Copy `.env.example` to `.env.local` (or create `.env`) and set at least:

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | PostgreSQL connection string (required for auth, API keys, scans) |
   | `JWT_SECRET` | Secret for signing JWTs (required in production) |
   | `NEXT_PUBLIC_BASE_URL` | App origin, e.g. `http://localhost:3000` or `https://yourapp.com` |
   | `STRIPE_SECRET_KEY` | Stripe secret key (subscriptions) |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
   | `STRIPE_PER_USER_PRICE_ID` | Stripe price ID for monthly plan |
   | `STRIPE_PER_USER_PRICE_ID_YEARLY` | Stripe price ID for yearly plan |
   | `RESEND_API_KEY` | Resend API key (verification, password reset, receipts) |

   Optional: `RAPIDAPI_PROXY_SECRET` (for RapidAPI proxy to CI Scan API), `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (see Deployment).

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Deployment (Railway, Render, Vercel, etc.)

- **Server Actions key** – To avoid “Failed to find Server Action” after redeploys, set a **persistent** encryption key and use it at **build time**:
  ```bash
  openssl rand -base64 32
  ```
  Set in your host’s environment:
  ```env
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<generated-key>
  ```
  Do a full redeploy after setting it; users may need to refresh to clear cached client code.

- **JWT_SECRET** – Must be set in production (app will throw on startup if missing).

- **PDF auto-fix (optional)** – For server-side PDF fixes (alt text, table summaries, etc.), install PyMuPDF in the same environment as the Node app (e.g. in a custom Dockerfile): `pip install pymupdf`. Scans and AI suggestions work without it.

## Project structure

```
src/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── ci/scan/          # CI Scan API (POST)
│   │   ├── api-keys/         # List/create/delete API keys
│   │   ├── reports/[id]/     # Get scan report by ID
│   │   └── ...
│   ├── home/                 # Marketing + free scan
│   ├── dashboard/            # Logged-in dashboard
│   ├── login/, signup/       # Auth
│   ├── pricing/, thank-you/  # Plans and post-checkout
│   ├── organization/         # Org + billing
│   ├── settings/             # Profile, API keys, notifications
│   ├── document-scan/         # PDF scan
│   ├── new-scan/             # New website scan
│   ├── scan-history/         # Scan list + detail
│   ├── reports/[id]/        # Report page
│   ├── playground/           # In-browser a11y tryout
│   ├── logo-contrast-checker/
│   └── ...                   # Legal, accessibility-issues, backlog, etc.
├── components/               # Shared UI (Sidebar, forms, etc.)
├── lib/                      # Services (auth, DB, scan, API keys, Stripe, Resend, …)
├── hooks/
└── ...
```

## Usage

- **Free scan** – From the home page, enter a URL and run a scan; sign up to see full results and fixes.
- **Full scans** – Sign up, then use Dashboard → New Scan or Document Scan.
- **CI / pipelines** – Use the [CI Scan API](docs/CI-SCAN-API.md): same endpoint and body for any CI; store base URL and API key in your pipeline’s secrets and `POST` with `url` or `urls`.
- **API keys** – Settings → API Keys (requires active subscription). Use `Authorization: Bearer <key>` or `X-API-Key: <key>` for the CI Scan API.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (uses `build.sh`) |
| `npm run start` | Start production server |
| `npm run lint` | Next.js ESLint |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |
| `npm run pen-test` | Run API security pen tests (server must be running) |
| `npm run test:puppeteer` | Verify Puppeteer setup |

## Documentation

- **[CI Scan API](docs/CI-SCAN-API.md)** – Endpoint, auth, request/response, pass/fail, and a universal pipeline example for any CI.

## Support

- **Email:** [hello@a11ytest.ai](mailto:hello@a11ytest.ai)
- **Issues:** GitHub Issues (if applicable)

## License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Axe-core](https://github.com/dequelabs/axe-core) – Accessibility testing engine
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) – Accessibility guidelines
- [Next.js](https://nextjs.org/) – React framework
- [Tailwind CSS](https://tailwindcss.com/) – Styling
