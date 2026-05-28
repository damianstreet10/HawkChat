# HawkChat

Your own **NotebookLM-style** research assistant: upload sources into notebooks, ask questions, and get answers grounded in your documents with citations.

## Features

- **Notebooks** — organize research by project or topic
- **Sources** — upload PDFs and text/markdown files, or paste text directly
- **Grounded chat** — RAG over your sources with inline `[1]` citations and excerpt cards
- **Local-first storage** — SQLite database in `./data` (no cloud DB required)

## Quick start

```bash
cd ~/Projects/HawkChat
cp .env.example .env
# Add your OPENAI_API_KEY to .env

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Create a notebook and upload sources (PDF, TXT, MD).
2. Text is chunked, embedded with OpenAI `text-embedding-3-small`, and stored in SQLite.
3. When you ask a question, HawkChat retrieves the most relevant chunks and sends them to the chat model with strict grounding instructions.
4. Responses include citation excerpts from the matched chunks.

## User roles (view-only vs upload)

| Role | Can chat | Can upload sources | Can manage notebooks | Can manage users |
|------|----------|-------------------|----------------------|------------------|
| **viewer** | Yes | No | No | No |
| **contributor** | Yes | Yes | Yes | No |
| **admin** | Yes | Yes | Yes | Yes |

1. Set `HAWKCHAT_REQUIRE_AUTH=true` in `.env`
2. Set `HAWKCHAT_ADMIN_EMAIL` and `HAWKCHAT_ADMIN_TOKEN`, restart the app
3. Sign in at `/login` with those credentials
4. Open **Users** (`/settings/users`) to add people:
   - **View only** — they can open notebooks and chat, but cannot upload or remove documents
   - **Contributor** — can upload PDFs/text and create notebooks
5. Copy each new user's **access token** (shown once) and send it to them with their email

View-only users still see the source list; upload controls are hidden and blocked on the API.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | — | Required for embeddings and chat |
| `OPENAI_CHAT_MODEL` | `gpt-4o-mini` | Chat model |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `HAWKCHAT_REQUIRE_AUTH` | `false` | Require login for all routes |
| `HAWKCHAT_ADMIN_EMAIL` | — | Seeds first admin user |
| `HAWKCHAT_ADMIN_TOKEN` | — | Admin login token (hashed in DB) |

## LAN demo (two notebooks, same Wi‑Fi)

1. Put PDFs in `seed/useful-resources/` and `seed/hardware-support/` (see `seed/manifest.json`)
2. Set `HAWKCHAT_AUTO_SEED=true` and `OPENAI_API_KEY` in `.env`
3. Run `npm run dev:lan`
4. Share `http://<your-ip>:3000` on the network

See **[docs/LAN_DEMO.md](docs/LAN_DEMO.md)**.

## Monitor guest questions (optional)

Guests chat without login; each device only sees its own history. Pre-approved **monitor** accounts can sign in and view all questions and IPs at `/admin/activity`.

See **[docs/MONITORING.md](docs/MONITORING.md)**.

## App Store with built-in documents

See **[docs/APP_STORE.md](docs/APP_STORE.md)** for the full flow. Short version:

1. Put PDFs in the `seed/*/` folders listed in `manifest.json`
2. Run `npm run build:seed` (indexes into `seed/output/hawkchat-seed.db`)
3. Bundle that database in an iOS/Android app (Capacitor) — users get pre-loaded sources without uploading

## Roadmap ideas

- URL / web page ingestion
- Audio brief generation (NotebookLM-style)
- Anthropic as an alternative provider
- Streaming responses

## Stack

- Next.js 14 (App Router)
- SQLite + better-sqlite3
- OpenAI embeddings + chat
- Tailwind CSS
