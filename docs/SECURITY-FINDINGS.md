# Security Audit – Findings and Fixes

Summary of a project-wide vulnerability review and mitigations applied.

---

## Fixed in this audit

### 1. Open redirect (login)

- **Risk:** The login page used the `redirect` query parameter without validation. An attacker could send a link like `https://yoursite.com/login?redirect=https://evil.com` and, after login, the user would be sent to the attacker’s site.
- **Fix:** Redirect is now allowed only when it is a same-origin path: must start with `/` and must not start with `//`. Any other value is ignored and the user is sent to `/dashboard`.
- **Where:** `src/app/login/page.tsx`

### 2. Debug/test env routes in production

- **Risk:** `/api/debug-env` and `/api/test-env` exposed environment variable names and masked values (e.g. last 4 chars of API keys), `NODE_ENV`, and `cwd`. In production this can leak configuration hints.
- **Fix:** Both routes now return 404 when `NODE_ENV === 'production'`.
- **Where:** `src/app/api/debug-env/route.ts`, `src/app/api/test-env/route.ts`

---

## Already in good shape

### SQL injection

- Queries use parameterized placeholders (`$1`, `$2`, etc.) with values passed in arrays. No user input is concatenated into SQL strings. The notifications route builds placeholder lists from array length (`$${index + 2}`) and passes IDs as parameters—safe.

### CI scan / SSRF

- `normalizeAndValidateUrl` in the CI scan rejects localhost, `.local`, and private IP ranges. Only `http`/`https` allowed. SSRF risk is mitigated for the scan endpoint.

### API authentication

- CI scan requires a valid API key or RapidAPI proxy secret; subscription/credits are checked. Cron endpoint requires `CRON_SECRET` and returns 503 for unauthenticated requests (no information leakage).

### Secrets and .env

- `.env` and common env variants are in `.gitignore`. Debug routes only show masked values and are now disabled in production.

### Auth and sessions

- JWT used for session tokens; API keys hashed (SHA-256) with timing-safe compare. Rate limiting applied to API key usage.

---

## Lower priority / optional hardening

### 1. Playground `dangerouslySetInnerHTML`

- **Where:** `src/app/playground/page.tsx` – user-editable HTML is rendered with `dangerouslySetInnerHTML` for the preview.
- **Risk:** A user can paste HTML/JS and run it in their own browser (e.g. `<script>`, `onerror=`). This is in a controlled “try your own code” context but is still XSS if the content were ever shared or reflected elsewhere.
- **Recommendation:** For defense in depth, either sanitize the preview input (e.g. DOMPurify with a strict config) or render it in a sandboxed iframe with `srcdoc` and `sandbox="allow-same-origin"` (and no `allow-scripts` if you don’t need scripts in the preview).

### 2. Logout notification `innerHTML`

- **Where:** `src/lib/auth-utils.ts` – `showLogoutNotification(message)` sets `notification.innerHTML` with a template that includes `${message}`.
- **Risk:** If `message` were ever supplied by an attacker (e.g. reflected from URL or API), it could inject HTML/JS. Currently the message is set from your own code (e.g. “Session expired”).
- **Recommendation:** Keep `message` only from server or trusted strings; or use `textContent` for the message part and keep the rest as static HTML.

### 3. Dependency vulnerabilities

- Run `npm audit` (or `yarn audit`) regularly and address reported issues. Consider CI that fails on high/critical.

---

## Checklist for future changes

- [ ] Never concatenate user or request data into SQL; use parameterized queries only.
- [ ] Validate and restrict any `redirect` or `returnUrl` to same-origin paths.
- [ ] Do not expose debug or test endpoints in production (or protect them with auth and allowlists).
- [ ] For user-controlled HTML, sanitize or sandbox (e.g. iframe + sandbox) before rendering.
- [ ] Keep `.env` and secrets out of repo and logs; use masked values in any debug output.
