# Setting up a11ytest.ai with Railway + Spaceship DNS

This guide walks through connecting **a11ytest.ai** (domain at Spaceship) to your app on **Railway**.

---

## 1. Get the Railway CNAME target

1. Open [Railway](https://railway.app) → your project.
2. Open the **service** that runs the app (e.g. your Next.js app).
3. Go to **Settings** → **Networking** → **Public Networking**.
4. Click **+ Custom Domain**.
5. Add **both** (if you want apex + www):
   - `a11ytest.ai`
   - `www.a11ytest.ai`
6. For each domain, Railway shows a **CNAME value** like:
   - `xxxxxxxx.up.railway.app`
   Copy this value; you’ll use it in Spaceship.

---

## 2. Add DNS records in Spaceship

1. Log in at [Spaceship](https://www.spaceship.com).
2. Open **Domains** → select **a11ytest.ai**.
3. Open the **DNS** / **Advanced DNS** section (or “Resource records” / “Manage DNS”).

Add these records. Replace `xxxxxxxx.up.railway.app` with the CNAME value from Railway.

### Root domain (a11ytest.ai)

Spaceship supports **ALIAS** at the apex, which works with Railway.

| Type  | Name/Host | Value / Target              | TTL (if asked) |
|-------|-----------|-----------------------------|-----------------|
| ALIAS | `@`       | `xxxxxxxx.up.railway.app`   | 3600 (or default) |

- **Name**: `@` (means “root” / a11ytest.ai).
- **Value**: the Railway CNAME target, e.g. `abc123xyz.up.railway.app`.
- No trailing dot unless the UI adds it automatically.

If Spaceship does **not** offer ALIAS but has “CNAME (flattened)” or “ANAME” for the root, use that with the same target.

### www (www.a11ytest.ai)

| Type  | Name/Host | Value / Target              | TTL (if asked) |
|-------|-----------|-----------------------------|-----------------|
| CNAME | `www`     | `xxxxxxxx.up.railway.app`   | 3600 (or default) |

- **Name**: `www`.
- **Value**: same Railway CNAME target as above.
- Again, no trailing dot unless the UI requires it.

---

## 3. If Spaceship has no ALIAS at root

Some plans only allow A/AAAA at the root. Then you have two options.

### Option A: Use Cloudflare for DNS only

1. Add the site in [Cloudflare](https://dash.cloudflare.com) and switch the domain’s nameservers at Spaceship to the ones Cloudflare gives you (e.g. `xxx.ns.cloudflare.com`).
2. In Cloudflare **DNS**:
   - **Type** CNAME, **Name** `@`, **Target** `xxxxxxxx.up.railway.app`, **Proxy** = DNS only (grey cloud).
   - **Type** CNAME, **Name** `www`, **Target** `xxxxxxxx.up.railway.app`, **Proxy** = DNS only (grey cloud).
3. In Railway, use “DNS only” (no proxy) so SSL and verification work reliably.

### Option B: Use only www for now

1. In Railway, add only **www.a11ytest.ai** as the custom domain.
2. In Spaceship, add only the **CNAME** for `www` → `xxxxxxxx.up.railway.app`.
3. Users will use **https://www.a11ytest.ai**. You can add the root domain later (e.g. after moving DNS to Cloudflare or when Spaceship supports ALIAS/ANAME).

---

## 4. Set app URL in Railway

In the same Railway project, in **Variables** (or in your app’s env):

- **NEXT_PUBLIC_BASE_URL** = `https://a11ytest.ai`  
  (or `https://www.a11ytest.ai` if you’re only using www for now)

Use that exact URL everywhere (OAuth, Stripe success/redirect, emails, etc.).

---

## 5. Wait for DNS and SSL

- DNS can take from a few minutes up to 24–48 hours.
- After the records match what Railway expects, Railway will show a green checkmark next to the custom domain and issue HTTPS automatically.
- You can check propagation at [whatsmydns.net](https://www.whatsmydns.net) for `a11ytest.ai` and `www.a11ytest.ai`.

---

## Quick reference (Spaceship)

| Where      | What to do |
|------------|------------|
| **Spaceship** | Domains → a11ytest.ai → DNS / Advanced DNS |
| **Root**   | ALIAS (or ANAME) `@` → `xxxxxxxx.up.railway.app` |
| **www**    | CNAME `www` → `xxxxxxxx.up.railway.app` |
| **Railway**| Settings → Networking → + Custom Domain → add `a11ytest.ai` and `www.a11ytest.ai`, use the CNAME value shown there in Spaceship |

Replace `xxxxxxxx.up.railway.app` with the value Railway shows for your service.
