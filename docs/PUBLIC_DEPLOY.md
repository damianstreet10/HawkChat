# Public internet deployment

## Site password (everyone)

Set in `.env`:

```bash
HAWKCHAT_SITE_PASSWORD=your-shared-password
```

- Visitors hit **`/login`** first and enter the site password.
- Optional **name** on login — shown in **Activity** as “Who”.
- **`Lock site`** in the header clears the site session.

## Admin / Activity (you only)

Still use staff credentials (separate from the site password):

```bash
HAWKCHAT_ADMIN_EMAIL=you@company.com
HAWKCHAT_ADMIN_TOKEN=long-random-token
```

1. Sign in at **`/login/staff`** with admin/monitor email + token (no site password needed).
2. Open **Activity** for all questions, names, and IPs.

Guests still use the site password at `/login` first.

## Kit Quirks (reports)

Third home-card notebook: **Kit Quirks** — form for kit/PC issues (not chat). Admins review at **`/admin/quirks`** (header link when signed in as staff).

## Public IP / HTTPS

- Run `npm run build` && `npm run start` (or behind nginx on 443).
- Set `NEXT_PUBLIC_HAWKCHAT_LAN_URL=https://your-public-hostname` **before** build if shown on the home page.
- Firewall: allow inbound 443 (or 3000); server needs outbound access to OpenAI.

## Security note

A **shared site password** is fine for a trusted group; anyone with the password can use the app. Use a **long admin token** for Activity. Rotate passwords if they leak.
