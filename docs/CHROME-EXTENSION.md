# Chrome Extension (Manual Scan)

The AccessScan Chrome extension lets you run accessibility scans from your browser on the **current tab**. It is intended for **manual scans only** and matches the behavior of the web scanner in the app.

## What it does

- Open the extension **side panel** (click the AccessScan icon in the toolbar). The panel loads the app in an iframe.
- **Log in** to the app inside the panel (same login as the main app). No token paste; you sign in once and use the extension scan page.
- You see the **extension-only scan page**: the URL of the current browser tab at the top, scan options (WCAG level A/AA/AAA, Best practices, Section 508), and a **Scan page** button.
- The scan runs **in your browser tab** using axe-core with the same rule set as the web scanner. If you are logged into a site in that tab, the extension sees the same content (including pages behind login). No cookie or session data is sent to the server; only the scan results (issues and summary) are sent after the scan.
- Results are stored in the app: **scan history** and **product backlog**, with the same **AI or rule-based suggestions** as the web scan. If Jira or Azure DevOps is configured in the app, new extension-scan issues are synced the same way.
- From the extension you can **view the product backlog** (link at the top or after a scan). From the backlog view you can push issues to Jira/ADO when integration is set up in the app.

## Manual scans only

- The extension does **not** replace or affect **API/CI scans**. Those remain server-side.
- Extension scans consume credits like manual scans from the app (one credit per page, unless you have unlimited credits).

## Flow

1. Install the extension and open the side panel.
2. Log in to the app in the panel (if not already logged in).
3. You are taken to the extension scan page. Open the webpage you want to scan in another tab and make it the **active tab**.
4. The extension shows that tab’s URL. Choose WCAG level and options, then click **Scan page**.
5. The current tab is scanned; results are sent to the app and added to your product backlog (with suggestions).
6. Use **View product backlog** to see and manage issues in the panel; from there you can push to Jira or Azure DevOps if configured in the app.

## App URL (self-hosted)

The side panel iframe points at an app URL (default: `https://app.a11ytest.ai`). Self-hosted users can set their own app origin via `chrome.storage.local` key `accessScanAppUrl` (e.g. from an options page or first-run prompt) so the panel loads their instance.
