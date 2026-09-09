# Arogya Line – Interactive prototype build spec

Purpose: an interactive prototype for the portfolio case study. It shows the whole service, not one app.
Three connected surfaces share one in-memory record, so an action in one surface appears in the others.
No backend. No login. No real data. Everything runs in the browser.

This document describes WHAT to build and HOW it behaves. It does not describe how it looks.

---

## 1. Scope

Build three surfaces in one web app, switchable from a top-level control:

1. **ASHA app** – phone-sized surface. The health worker's offline-first tool.
2. **Voice line** – a call simulator. Shows the IVR as a "call" with spoken text and a keypad.
3. **PHC dashboard** – desktop-sized surface. The doctor's view.

Plus one small non-interactive element:

4. **Family card** – the paper card, shown as a static panel inside the Voice line surface (the caller "reads" the number and family ID from it).

Out of scope for v1: sound playback, real telephony, real maps, multi-language text, persistence across reloads.

---

## 2. Stack

- React + Vite (single-page app). TypeScript preferred.
- Router: react-router (one route per surface, so each can be deep-linked from the case study).
- State: one global store (Zustand or React Context + reducer). All three surfaces read from the same store.
- No CSS framework decision made here. Use whatever the portfolio already uses.
- Deploy: Vercel, as a separate project, embedded in the portfolio via link or iframe.

---

## 3. Project structure

```
arogya-line/
  CLAUDE.md                 # rules for Claude Code (see section 9)
  src/
    app/
      router.tsx
      store.ts              # shared state + actions
      types.ts              # data model
      seed.ts               # demo families, bookings, questions
      triage.ts             # question tree + result logic (shared by ASHA app and IVR)
    surfaces/
      asha/                 # phone-sized surface
        TodayList.tsx
        FamilyDetail.tsx
        SymptomCheck.tsx
        Result.tsx
        Booking.tsx
        Booked.tsx
        SyncBanner.tsx
      voice/
        CallSimulator.tsx   # the IVR player
        Keypad.tsx
        FamilyCard.tsx
      phc/
        Dashboard.tsx
        PatientRow.tsx
        AfterConsult.tsx
    shell/
      SurfaceSwitcher.tsx   # switch between the three surfaces
      ScenarioReset.tsx     # "Reset demo" control
      ConnectivityToggle.tsx# "Signal on / off" control for the ASHA app
```

---

## 4. Data model (types.ts)

```ts
type Urgency = "green" | "amber" | "red";
type SyncStatus = "saved_offline" | "sent";
type Source = "asha" | "ivr";

type Member = {
  id: string;
  name: string;
  age: number;
  role: "mother" | "child" | "adult" | "pregnant";
  note?: string;              // e.g. "fever since Tuesday"
};

type Family = {
  id: string;                 // 4-digit, printed on the card, e.g. "4471"
  head: string;
  village: string;
  phone: string;              // masked
  ashaId: string;
  members: Member[];
};

type TriageAnswer = { questionId: string; answer: "yes" | "no" };

type Concern = {
  id: string;
  familyId: string;
  memberId: string;
  source: Source;
  answers: TriageAnswer[];
  urgency: Urgency;
  reasons: string[];          // plain-text reasons shown to the user
  createdAt: string;
  sync: SyncStatus;
};

type Booking = {
  id: string;
  concernId: string;
  date: string;               // ISO date
  slot: string;               // e.g. "10:00–11:00"
  facility: string;           // "PHC Tumkur"
  doctor: string;
  sync: SyncStatus;
  visitNeeded?: boolean;      // set by doctor after consult
  advice?: string;            // doctor's note text (stands in for the voice note)
  followUpDue?: string;       // ISO date
  followUpStatus?: "pending" | "answered" | "missed";
};

type Store = {
  families: Family[];
  concerns: Concern[];
  bookings: Booking[];
  online: boolean;            // ASHA app connectivity
  activeSurface: "asha" | "voice" | "phc";
};
```

---

## 5. Triage logic (triage.ts)

Shared by the ASHA app and the Voice line, so both produce the same result for the same answers.
This makes the "one system" idea real in code.

- Input: member role (child / adult / pregnant) → picks a question set.
- Each set: max 4 yes/no questions, fixed order.
- Any question flagged `dangerSign: true` answered "yes" → stop immediately, result = red.
- Otherwise count `amberWeight` of yes answers → amber if ≥ threshold, else green.
- Output: `{ urgency, reasons[] }` where reasons are the plain-text labels of the "yes" answers plus one line explaining what was NOT found (e.g. "No fast breathing").

Example child set (illustrative, not clinical):
1. Fever more than 2 days? (amber)
2. Vomiting more than 3 times today? (amber)
3. Drinking or feeding less than usual? (amber)
4. Breathing fast or difficulty breathing? (**danger**)

Threshold: 2 amber = amber. Add a footer note in the prototype: "Illustrative questions, not clinical guidance."

---

## 6. Behaviour per surface

### 6.1 ASHA app (phone-sized)

Linear path. Each step is its own route so back works.

**Connectivity toggle** (in the shell, outside the phone): `online: true/false`.
- When offline: every write sets `sync = "saved_offline"`; a persistent banner shows count of items waiting.
- When toggled to online: all `saved_offline` items flip to `sent` after a short delay (simulate sync). Banner clears. The PHC dashboard gains the new rows at that moment.

**TodayList**
- Lists the ASHA's families that have an open concern, booking, or scheduled follow-up today, sorted red → amber → green → done.
- Each row: family head, family ID, one-line reason, sync tag if waiting.
- Primary action: "New family concern" → FamilyDetail (family picker step can be skipped in v1 by defaulting to the demo family).

**FamilyDetail**
- Shows members. A member with an open concern is marked.
- Actions: "Check symptoms" (→ SymptomCheck for that member), "Hear last doctor note" (shows the latest `advice` text for this family, if any).

**SymptomCheck**
- One question per screen, Yes / No, progress indicator, a "read aloud" control (v1: no sound; it can simply reveal the text or do nothing but be present).
- Uses `triage.ts`. Stops early on danger sign.

**Result**
- Shows urgency, headline, and `reasons[]`.
- Green: action "Save home-care advice" → creates Concern, back to TodayList.
- Amber: action "Book PHC visit" → Booking. Secondary: "Call the doctor line" (v1: switches to Voice surface with family preselected).
- Red: action "Call PHC now" (v1: switches to Voice surface in emergency mode).

**Booking**
- Pick a day from the next 3 days and a slot from a fixed list. Slots already taken by other bookings appear as unavailable.
- Creates Booking (+ Concern), respecting `online` for sync status.

**Booked**
- Shows date, slot, facility, doctor, and a fixed "what to tell the family" checklist (3 items, checkable, purely local state).
- Shows sync state.

### 6.2 Voice line (call simulator)

Presented as a phone call, not an app: a transcript area where spoken prompts appear one at a time, and a 0–9 keypad. Also a "hang up" and "replay" (9) control.

- Start: dial the number on the family card (v1: a "Call" button). First prompt asks for the 4-digit family ID via keypad; the family card panel shows it.
- Main menu: 1 = Is it serious?, 2 = Book a visit, 3 = Hear my doctor's advice, 0 = Talk to a person.
- 1 → "Who is unwell?" 1 child, 2 adult, 3 pregnant → runs the same `triage.ts` questions, answered with 1 = yes, 2 = no. 9 repeats the prompt. 0 at any time jumps to the operator state.
- Result green → spoken home-care text, ends with "Your ASHA will visit tomorrow." Creates a Concern with `source: "ivr"`, `sync: "sent"` (voice line is always online).
- Result amber → offers the next available slot; 1 = book. Creates Booking. The new row appears immediately in the PHC dashboard and in the ASHA TodayList.
- Result red → operator state: transcript shows the operator connecting and alerting the ASHA. Creates a red Concern.
- 3 → reads back the latest `advice` for this family, if a doctor has entered one. If none: "No advice yet."
- 0 → operator state: a short scripted exchange, then a booking is created for the same day.

### 6.3 PHC dashboard (desktop-sized)

- Header: selected day (default: tomorrow), counts by urgency.
- Table: all bookings for that day, sorted red → amber → green. Columns: time, patient (name, age, family ID), reported by (ASHA / Voice line), symptoms captured (`reasons[]` joined), visit needed (toggle), after-consult action.
- Rows created offline in the ASHA app only appear once synced (drives the demo story).
- **AfterConsult** (opens from a row):
  - `visitNeeded` toggle (Yes / No).
  - `advice` text field (stands in for the 20-second voice note). Saving it sets `followUpDue = booking.date + 1 day`, `followUpStatus = "pending"`.
  - "Mark follow-up answered / missed" buttons for demo purposes.
- A second tab or filter: "Follow-ups" – bookings with `followUpStatus` pending or missed. Missed ones show "ASHA visit requested".
- A small metrics strip driven by store data: bookings pre-booked (%), visits marked not needed (count), follow-ups completed (%). These update live as the demo is used. This is the "outcomes" moment of the prototype.

---

## 7. Demo scenario and reset

Seed data (`seed.ts`):
- 1 ASHA (Savitri), 1 PHC (Tumkur, Dr. Ramesh), 5 families, of which:
  - Family 4471 (Lakshmi): child Arjun with a note "fever since Tuesday", no concern yet. This is the family the visitor will walk through.
  - 2 families with existing bookings for tomorrow (one red, one green), one from IVR.
  - 1 family with a booking already consulted and `advice` set, so menu 3 on the voice line has something to read.
  - 1 family with a missed follow-up.
- Default `online: false` so the visitor sees the offline banner first.

**Guided walkthrough** (optional but valuable): a small step indicator in the shell that suggests the order:
1. ASHA app, offline: check Arjun → amber → book → see "waiting to send".
2. Toggle signal on → watch it sync.
3. PHC dashboard: Arjun appears → mark visit needed → enter advice.
4. Voice line: enter 4471 → press 3 → hear the advice back.

"Reset demo" restores seed data.

---

## 8. Embedding in the portfolio

- Deploy as its own Vercel project.
- In the case study page, embed via iframe at two sizes or link out with "Open prototype".
- Deep links: `/asha`, `/voice`, `/phc` so the case study can point to each surface from the relevant section.
- Add `?guided=1` to start with the walkthrough on.

---

## 9. Building it in Claude Code

### CLAUDE.md (put at repo root before the first prompt)

```
# Arogya Line prototype

Read SPEC.md before any task. It is the source of truth for scope and behaviour.

Rules
- Three surfaces share one store. Never duplicate triage logic; import from src/app/triage.ts.
- Every write goes through a store action. No component mutates state directly.
- Respect `online`: offline writes are "saved_offline" until the sync action runs.
- No backend, no network calls, no localStorage. In-memory only. Reset restores seed.
- Keep components small. One file per screen listed in SPEC.md section 3.
- After each feature, run `npm run build` and fix all type errors before reporting done.
- Do not add features not in SPEC.md. If something is unclear, ask.
```

Save this document as `SPEC.md` in the repo root.

### Prompt sequence (one prompt per Claude Code session step)

Work in this order. Each step should end with a running app. Use `/compact` between steps when context gets long.

1. **Scaffold** – "Create a Vite + React + TypeScript app named arogya-line with react-router and zustand. Set up the folder structure in SPEC.md section 3 with empty components. Add a SurfaceSwitcher shell with three routes. Build must pass."
2. **Data + store** – "Implement types.ts, seed.ts and store.ts from SPEC.md sections 4 and 7. Include actions: createConcern, createBooking, setOnline, syncPending, setVisitNeeded, saveAdvice, setFollowUpStatus, resetDemo. Write a small test for syncPending."
3. **Triage** – "Implement triage.ts from SPEC.md section 5 with the child, adult and pregnant question sets. Unit-test: danger sign stops early and returns red; two amber answers return amber; none returns green."
4. **ASHA app** – "Build the ASHA surface screens from SPEC.md 6.1 in order: TodayList, FamilyDetail, SymptomCheck, Result, Booking, Booked, SyncBanner. Wire to the store. ConnectivityToggle in the shell." (Split into two sessions if needed: list + detail + check first, then result + booking + sync.)
5. **PHC dashboard** – "Build the PHC surface from SPEC.md 6.3: Dashboard table, PatientRow, AfterConsult, Follow-ups filter, metrics strip driven by store data."
6. **Voice line** – "Build the CallSimulator from SPEC.md 6.2 as a state machine: dial → family ID → menu → branches. Keypad drives all input. Reuse triage.ts. 9 repeats, 0 goes to operator from any state."
7. **Demo layer** – "Add ScenarioReset and the optional guided walkthrough from SPEC.md section 7, enabled by ?guided=1."
8. **Polish + deploy** – "Add deep links, check keyboard use on all controls, run build, then prepare for Vercel deploy."

Design pass (typography, colour, layout, motion) happens after step 6, as its own session, so the behaviour is stable first. That pass is not described in this document.

### Tips for the sessions
- Give Claude Code one surface at a time. Ask it to summarise what it built and what is left before you `/compact`.
- Ask for a short manual test list after each step and click through it yourself. This is also how you will learn the prototype well enough to demo it in an interview.
- If a step goes wrong, revert with git rather than patching on top.

For current Claude Code commands and setup: https://docs.claude.com/en/docs/claude-code/overview

---

## 10. Definition of done for v1

- All three surfaces work from one store; a booking made in one appears in the others.
- Offline → online sync is visible in the ASHA app and reflected in the dashboard.
- Voice line runs a full triage with the keypad and reads back saved advice.
- Metrics strip updates from real store data.
- Reset returns to seed. Deep links work. Build passes with no type errors.
- Deployed on Vercel and embedded or linked from the case study.
