# Puppeteer / Chrome on Railway

Page discovery and web scans need Chromium. Railway’s default image doesn’t include it, which causes:

`Could not find Chrome (ver. …). This can occur if either 1. you did not perform an installation…`

## 1. Use the included Nixpacks config

The repo has a `nixpacks.toml` that installs Chromium and required libs. If your app is deployed with Nixpacks, that step is already in place.

## 2. Set the Chromium path in Railway

In the Railway project → your service → **Variables**, add:

| Name | Value |
|------|--------|
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` |

If the packaged binary has another name (e.g. `chromium-browser`), use that path instead (e.g. `/usr/bin/chromium-browser`).

Optional (stops Puppeteer from downloading its own Chrome):

| Name | Value |
|------|--------|
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `1` |

Redeploy after changing variables.

## 3. If Chromium still isn’t found

- Confirm the app is built with the `nixpacks.toml` from this repo (no custom Dockerfile that omits it).
- In a Railway shell (or a one-off run), run `which chromium` or `ls /usr/bin/chromium*` and use the path you get as `PUPPETEER_EXECUTABLE_PATH`.

## 4. Local development

Locally you typically don’t need `PUPPETEER_EXECUTABLE_PATH`; Puppeteer will use its own Chromium. Only set it if you want to use a specific system Chrome/Chromium.
