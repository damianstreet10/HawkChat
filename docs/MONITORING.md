# Guest chat + monitor accounts

## How it works

| Who | Login | Chat history | See others' questions |
|-----|-------|--------------|------------------------|
| **Guest** (phone/laptop on LAN) | No | Only on **this browser** | No |
| **Monitor** (pre-approved) | Yes (`/login`) | Same as guests in chat | Yes (`/admin/activity`) |

Each guest browser gets a private `hawkchat_guest` cookie. Messages are stored with that id and the client **IP address** (from `X-Forwarded-For`, `X-Real-IP`, or `unknown` on plain LAN).

Monitors sign in with **email + access token** (accounts you create in `.env` or via an admin user). They do **not** need `HAWKCHAT_REQUIRE_AUTH=true` — the rest of the site stays open for guests.

## Setup monitor accounts

Add to `.env` (comma-separated `email:token` pairs):

```bash
HAWKCHAT_MONITORS=ops@yourcompany.com:use-a-long-random-token,lead@yourcompany.com:another-long-token
```

Restart the server. On first start, those users are inserted with role **monitor**.

1. Open **http://localhost:3000/login** (or your LAN URL + `/login`).
2. Sign in with email and token.
3. Open **Activity** in the header, or go to `/admin/activity`.

Only accounts that exist in the database can sign in — there is no public registration.

## Optional: full-site login

If you also set `HAWKCHAT_REQUIRE_AUTH=true`, everyone must sign in; monitors still use the Activity page the same way.

## IP addresses on LAN

On a simple `npm run dev:lan` setup, IPs are often the Wi‑Fi address of each device (e.g. `192.168.68.42`). Behind a reverse proxy, set `X-Forwarded-For` so the real client IP is recorded.

## Privacy note

Monitors see **user questions** and **IP**, not full assistant replies on the activity page. Guests never see the activity feed.
