# SETU Frontend — SIH26043

React + Vite + Tailwind CSS + Lucide icons frontend for **Project SETU**
(Societal Engagement & Technological Utilization), built for Smart India
Hackathon 2026, Problem Statement SIH26043, Team 6ixTitans.

This is the **frontend half only**. It needs the API in the companion repo —
see [setu-backend](../setu-backend) (clone both and run them side by side;
see "Running with the backend" below).

## Run it

```bash
npm install
npm start
```

Opens on **http://localhost:5173**.

## Running with the backend

This frontend expects the SETU backend to be running on **localhost:4000**.
Clone the `setu-backend` repo alongside this one and run `npm install && npm
start` there first. The Vite dev server here (`vite.config.js`) proxies every
`/api/*` request to `http://localhost:4000`, so once both are running there's
nothing else to configure — open `localhost:5173` and the app is fully live.

If the backend isn't reachable, the header shows a small red banner telling
you to start it.

**Deploying separately later:** if you eventually host this on Vercel/Netlify
and the backend somewhere else (Render, Railway, …), the dev-only proxy in
`vite.config.js` won't apply to the production build — you'd add an
`import.meta.env.VITE_API_BASE` (or similar) and prefix the `fetch()` calls
in `src/App.jsx`'s `apiGet`/`apiPost`/`apiPut` helpers with it. Happy to wire
that up when you're ready to deploy; for local development (cloning both
repos and running them together) nothing needs to change.

## Files

- `src/App.jsx` — role-switching header plus all four dashboards (Citizen/
  Sahayak, University & Research, CSR & Industry, State Audit Officer)
- `src/main.jsx` — React entry point
- `src/index.css` — Tailwind directives + small custom animations
- `vite.config.js` — dev server + `/api` proxy to the backend
- `postcss.config.js` — required by Tailwind's build step (works alongside
  `tailwind.config.js`)
- `tailwind.config.js` — content paths + palette extension

## The four role views

- **Citizen / Sahayak** — multilingual (English/Hindi/Bengali/Santali) voice
  or text intake, live AI-analysis preview, photo attach, recent-submissions feed.
- **University & Research Portal** — per-institution match board, accept
  project, post team/milestone updates, advance lifecycle stage.
- **CSR & Industry Dashboard** — wallet balance, Schedule VII–filtered
  eligible challenges, one-click pledge with live balance updates.
- **State Innovation & Audit Officer** — live audit feed, domain/district
  equity charts, human override of AI priority or routing.
