# Troubleshooting

## "Session expired" when I'm not logged in

If you see "Session expired" on pages even when you consider yourself logged out, an old or invalid token is still in the browser.

- The app now **redirects to `/login`** (instead of `/home`) when the session is invalid, and shows the message there.
- The **login page clears expired tokens** from storage on load, so visiting `/login` once should stop the "Session expired" prompt on other pages.

If it persists, clear the site’s `localStorage` for this origin (e.g. in DevTools → Application → Local Storage) and reload.

---

## Deleted my account but can’t sign up again with that email

If "Delete account" ran but the user row was not removed (e.g. due to a failed transaction or DB constraint), you may see:

- **Login** fails for that user.
- **Sign up** says the email is already in use.

Use the **purge-by-email** support endpoint to remove that user so the email can be used again.

### 1. Configure the secret

In your deployment or local env, set:

```env
PURGE_USER_SECRET=your-secure-random-string
```

Use a long, random value (e.g. from `openssl rand -hex 32`) and keep it secret.

### 2. Call the purge endpoint

```http
POST /api/account/purge-email
Content-Type: application/json

{
  "email": "user@example.com",
  "purgeSecret": "your-secure-random-string"
}
```

`purgeSecret` must match `PURGE_USER_SECRET`. If the user exists and the secret is correct, the user and related data are removed and the email can be used for signup again.

This endpoint is for **support/admin use only**. There is no in-app UI for it.
