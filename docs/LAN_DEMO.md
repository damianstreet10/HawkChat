# LAN demo (two notebooks)

## Quick start

```bash
cd ~/Projects/HawkChat

# 1. PDFs (see folders below)
#    seed/useful-resources/     → "Useful Resources" notebook
#    seed/hardware-support/     → "Hardware Support" notebook

# 2. Add OpenAI key to .env
#    OPENAI_API_KEY=sk-...

# 3. Fresh index if you ran the app before (optional)
rm -f data/hawkchat.db

# 4. Start for LAN
npm run dev:lan
```

Share with anyone on the network: **http://&lt;your-mac-ip&gt;:3000**

(Set `NEXT_PUBLIC_HAWKCHAT_LAN_URL` in `.env` or let the home page auto-detect.)

## Notebooks

| Folder | Notebook | Purpose |
|--------|----------|---------|
| `seed/useful-resources/` | **Useful Resources** | General briefing PDFs (travel, production, etc.) |
| `seed/hardware-support/` | **Hardware Support** | Hardware manuals and troubleshooting |

Edit titles or add notebooks in `seed/manifest.json`.

## Your own PDFs

```
seed/useful-resources/my-handbook.pdf
seed/hardware-support/camera-setup.pdf
```

After adding or replacing files for a notebook that was **already indexed**, either:

- delete `data/hawkchat.db` and restart, or  
- remove that notebook’s rows from the DB and restart (so auto-seed runs again).

First-time indexing for an empty notebook happens automatically on first page load.

## What guests do

1. Connect to the same Wi‑Fi / network.
2. Open the share URL.
3. Pick **Useful Resources** or **Hardware Support**.
4. Ask questions — answers only use that notebook’s documents.

No login in default LAN demo (`HAWKCHAT_REQUIRE_AUTH=false`).
