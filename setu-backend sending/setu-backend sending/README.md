# SETU Backend — SIH26043

Express + SQLite API and AI triage pipeline for **Project SETU** (Societal
Engagement & Technological Utilization), built for Smart India Hackathon 2026,
Problem Statement SIH26043, Team 6ixTitans.

This is the **backend half only**. The matching frontend lives in a separate
repo — see [setu-frontend](../setu-frontend) (clone both and run them side by
side; see "Running with the frontend" below).

## Run it

```bash
npm install
npm start
```

The server starts on **http://localhost:4000**. On first run it creates
`setu.db` and seeds it with sample institutions, CSR partners and three demo
challenges already run through the real pipeline — nothing to configure.

To wipe and reseed: delete `setu.db` (and any `-wal`/`-shm` files next to it)
and restart.

## Running with the frontend

Clone the `setu-frontend` repo alongside this one and run `npm install && npm
start` there too (port 5173). Its Vite dev server proxies `/api/*` to
`http://localhost:4000`, so as long as this backend is running on port 4000
first, the two just work together with no extra configuration.

If you later deploy this backend somewhere (Render, Railway, Fly.io, etc.)
rather than running it locally, CORS is already enabled for all origins, so
the frontend can point at the deployed URL — you'd just need to change its
`vite.config.js` proxy target (dev) or add a fetch base URL (prod build)
to your deployed backend's address.

## Files

- `server.js` — Express app, all API routes
- `aiEngine.js` — the AI triage pipeline: PII redaction, simulated
  Bhashini translation, Jaccard dedup, domain classification, priority
  scoring, CSR Schedule VII tagging, capability-based university routing
- `seed.js` — schema (`CREATE TABLE IF NOT EXISTS …`) and one-time seed data

## What's simulated vs. real

There's no production Bhashini/ML credential available in a hackathon
prototype, so two pieces are deliberately simulated and labelled as such in
`aiEngine.js`'s own comments and in the audit trail every request produces:

- **Translation** — a small hand-built glossary per language (Hindi, Bengali,
  Santali) does word-level substitution toward English, not a trained model.
- **Classification / priority / equity weighting** — keyword and heuristic
  based, following the exact formulas from the problem statement.

Everything else — routing, PII redaction, deduplication, persistence, the
immutable audit log — is fully functional against a real SQLite database.

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | liveness check |
| GET | `/api/challenges` | list challenges (filter: `?domain=&state=&status=`) |
| POST | `/api/challenges/preview` | dry-run the AI pipeline, nothing persisted |
| POST | `/api/challenges` | submit a new challenge — runs the full pipeline |
| GET | `/api/challenges/:id` | one challenge with matches, audit trail, updates, funding |
| PUT | `/api/challenges/:id/stage` | advance lifecycle stage (1–4) |
| PUT | `/api/challenges/:id/override` | human override of priority / reassignment |
| POST | `/api/challenges/:id/updates` | post a team/milestone update |
| GET | `/api/institutions` | list universities |
| GET | `/api/institutions/:id/matches` | a university's routed challenges |
| POST | `/api/institutions` | register a new institution |
| PUT | `/api/matches/:id/join` | university accepts a matched project |
| GET | `/api/partners` | list CSR partners |
| GET | `/api/partners/:id/fundings` | one partner's pledge history |
| POST | `/api/partners/:id/pledge` | pledge CSR funds to a challenge |
| GET | `/api/audit` | full audit feed (`?limit=`) |
| GET | `/api/metrics` | aggregate stats for the equity/bias dashboard |
