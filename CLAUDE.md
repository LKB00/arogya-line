# Arogya Line prototype

Read SPEC.md before any task. It is the source of truth for scope and behaviour.

Rules
- Three surfaces (ASHA app, Voice line, PHC dashboard) share one store. Never duplicate triage logic; import from src/app/triage.ts.
- Every write goes through a store action. No component mutates state directly.
- Respect `online`: offline writes are "saved_offline" until the sync action runs.
- No backend, no network calls, no localStorage. In-memory only. Reset restores seed data.
- Keep components small. One file per screen listed in SPEC.md section 3.
- After each feature, run `npm run build` and fix all type errors before reporting done.
- Do not add features not in SPEC.md. If something is unclear, ask before building.
- Do not start visual styling (typography, colour, layout, motion) until told to. Behaviour first.
