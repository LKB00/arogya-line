# Arogya Line – Interactive prototype build spec

Purpose: an interactive prototype for the portfolio case study. It shows the whole service, not one app.
Three connected surfaces share one in-memory record, so an action in one surface appears in the others.
No backend. No login. No real data. Everything runs in the browser.

This document describes WHAT to build and HOW it behaves. It does not describe how it looks.

---

## 1. Scope

Build three surfaces in one web app, switchable from a top-level control:

1. **ASHA app** – phone-sized surface. The health worker's tool, with a simulated offline-sync workflow (no real network or storage).
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
  homeCare?: { tell: string[]; callIf: string[]; spoken?: string[] }; // advice exactly as given
  initiatedBy?: "asha";       // who started it, when not the channel: the ASHA's emergency over the line
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
  avoidable?: boolean;        // doctor, after consult: could this have been handled without a visit?
  advice?: string;            // doctor's note text (stands in for the voice note)
  adviceAt?: string;          // ISO timestamp advice was saved: "latest" is by moment, not day
  followUpDue?: string;       // ISO date
  followUpStatus?: "pending" | "answered" | "missed";
  ashaAsked?: boolean;        // after a missed call, the doctor asked the ASHA to follow up
  followUpLog?: { due: string; outcome: "answered" | "missed"; at: string }[]; // every call outcome, never erased
  adviceLog?: { text: string; at: string }[]; // earlier wording of the advice, kept when edited
  arrived?: boolean;          // demo only: a future booking marked as arrived
  emergency?: boolean;        // an emergency arrival today; slot is "Now"
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
- When offline: every write sets `sync = "saved_offline"`; a persistent banner shows what is waiting in her units, not the store's: a booking is "1 visit" (not a concern plus a booking), a check without a booking is "1 check".
- When toggled to online: all `saved_offline` items flip to `sent` after a short delay (simulate sync). Banner clears. The PHC dashboard gains the new rows at that moment.

**TodayList**
- Lists the people (not families) with open work, in three sections: today's work (Up next, then Later today), Upcoming (visits on a later day, never counted as "today"), and Already seen. One row per person, showing their first piece of work; any other open items for that person are counted on the row ("+1 more for Arjun") and listed on the family screen.
- "Up next" is the work that is due, not the brightest colour: danger signs first, then calls already late, then calls and home follow-ups due today, then today's visits by time, then open concerns with no date; urgency orders within each step.
- Each row: person, task, village, one-line reason, sync tag if waiting, and "+N other people in this family" when others in the same household also need her.
- Tasks come from where a booking stands, not its date: a follow-up handed to her or a call due comes before the visit; a visit still ahead is "PHC visit"; a visit whose day passed with nothing recorded is "Check the visit happened" (never "seen"); a visit with advice and nothing owed is done.
- A concern whose person is no longer on the family card reads "Person not found" with "Record needs checking", never the family head's name.
- A missed follow-up call is her task only when the doctor asks ("Follow up at home · Doctor asked: the follow-up call was missed"); a missed call alone commits nobody.
- A home-care concern from the voice line (no booking) is a "Follow up" task for today: the line told the family their ASHA will follow up, and this row is that promise.
- "Up next" reads person → task and time → reason → village and card.
- Primary action: "Check someone" → Which family? → FamilyDetail.

**FamilyDetail**
- Shows members. Each member shows every open item of theirs (never only the family's most urgent, never only their first).
- Actions: "Check symptoms" (→ SymptomCheck for that member).
- "Advice given": each person's latest advice, labelled with their name: the doctor's note (voice note; tap to read), or home-care advice saved with a check.

**SymptomCheck**
- One question per screen, Yes / No, progress indicator. No "read aloud" control: sound is out of scope, and a control that does nothing is not shown.
- Uses `triage.ts`. Stops early on danger sign.

**Result**
- A screening result, not a diagnosis. Shows urgency, headline, and `reasons[]`.
- Green: headline "No urgent signs found for {name}", then the home-care advice from `triage.ts` (`HOME_CARE`): "Tell the family" and "Call again if". Action "Save this advice" → creates Concern with `homeCare` (the advice itself), back to TodayList.
- Amber: action "Book PHC visit" → Booking. Secondary: "Call the doctor line" (v1: switches to Voice surface with family preselected).
- Amber when the person already has an upcoming visit: the verdict says so; primary "View existing visit" (→ Booked), secondary "Book another visit".
- Red: action "Call PHC now" (v1: switches to Voice surface in emergency mode).

**Booking**
- Pick a day from the next 3 days and a slot from a fixed list. Slots already taken by other bookings appear as unavailable.
- Creates Booking (+ Concern), respecting `online` for sync status. One rule decides whether a slot can be booked (`app/slots.ts` `isBookable`: not a past day, not already started today, not taken), used by this screen, by the voice line when it offers a time and again when the caller confirms, and by the store at the moment of writing. At the tap it re-checks the live store; if the slot can no longer be booked, nothing is written and the screen says so.

**Booked**
- Shows date, slot, facility, doctor, and a fixed "what to tell the family" checklist (3 items, checkable, purely local state).
- Shows sync state.

### 6.2 Voice line (call simulator)

Presented as a phone call, not an app: a transcript area where spoken prompts appear one at a time, and a 0–9 keypad. Also a "hang up" and "replay" (9) control.

- Start: dial the number on the family card (v1: a "Call" button). First prompt asks for the 4-digit family ID via keypad; the family card panel shows it. A found card is confirmed without saying any name or village ("We have found your family card"); a real service would verify the caller before reading names or advice.
- Main menu: 1 = Is it serious?, 2 = Book a visit, 3 = Hear your advice, 0 = Talk to a person.
- 1 or 2 → "Who needs help? Press 1 for Lakshmi. Press 2 for Arjun." The caller picks the person by name (keys 1–8), never a kind of person, so two children cannot be confused. A list longer than eight is read in pages of seven, with 8 for more names. A card with nobody registered says so and offers a person (0). The question set follows that person's role. Answered with 1 = yes, 2 = no. 9 repeats the prompt. 0 at any time jumps to the operator state.
- What the caller reported is said back as speech: "You told us about fever more than 2 days and vomiting more than 3 times today. You did not report fast breathing."
- Result green → "From your answers, there are no urgent signs for {name}.", the same home-care advice as the ASHA app spoken as sentences (`HOME_CARE.spoken`, saved with the concern so a replay says exactly what was said), ends with "Your ASHA, Savitri, has been told and will follow up with you." Creates a Concern with `source: "ivr"`, `sync: "sent"` (voice line is always online) and `homeCare`, which puts a follow-up on the ASHA's list.
- Result amber → offers the next available slot; 1 = choose it, 2 = another day. Choosing reads the booking back ("You are booking a visit for {name}, {day}, {slot}, at {facility}.") and asks 1 = confirm, 2 = choose another day. Only confirming creates the Booking. The new row appears immediately in the PHC dashboard and in the ASHA TodayList.
- Result red (or the ASHA's "Call PHC now") → operator state: an emergency, not an appointment. "Please bring {name} to PHC Tumkur now … there is no need to wait for a time." Creates a red Concern and an emergency arrival for today (`emergency: true`, slot "Now"), shown first on the PHC list. No slot is booked. Only a person the caller actually chose is named.
- Results are said from the answers, never as a code: "Thank you. From your answers, Arjun should see the doctor."
- 3 → advice is a person's, never the family's. One person with advice: read at once as a message ("Dr. Ramesh has a message for Shobha, from yesterday." … "That's all from Dr. Ramesh."), then 1 = hear it again, 2 = main menu. Several: "Whose advice would you like to hear? Press 1 for …". Home-care advice from a check is read too. None: "No advice yet."
- A call that has ended says goodbye and nothing more; the keys go quiet and the call button offers "Call again".
- 0 → a person, never a booking. The health worker picks up with what the line already knows (a finished check and its result, or "I can see you started a health check for Arjun. I'll help you from here"), then asks "How can I help you today?". The conversation is theirs: no booking, concern or referral is created from pressing 0. Only an emergency (the ASHA's "Call PHC now", or an urgent result) acts: come now, and an emergency arrival is created. While a person is talking, the keys are off and the call shows "With a health worker".
- No free slot within 30 days: the line says so and offers a person. It never offers an invented slot.
- Confirming re-checks the exact slot with the same rule used to offer it: taken meanwhile ("just been taken") or its hour started ("has just started") → nothing booked, the next slot offered.
- An emergency the ASHA called in is saved with `initiatedBy: "asha"`, so the PHC reads "Emergency called in by the ASHA", not a family's call.
- A call is one session (family, person, mode, answers, demo run): a new handover link or Reset demo ends the old call and its timers.

### 6.3 PHC dashboard (desktop-sized)

- Header: selected day (default: today), with Today and Tomorrow one tap away and a date field for any other day.
- Two groups of figures, never mixed. For the day on screen (captioned with it): patients, urgent, consults remaining (today's and past-day patients without advice; "Not arrived yet" when all are future). Needs attention now (whatever day is on screen): follow-ups due, today and overdue, with missed ones needing a decision.
- Where a booking stands: tomorrow's is "View booking" (not arrived; nothing after the consult can be recorded), today's "Start consult", a past day's unresolved one "Complete consult", with advice "Open consult". A demo-only "Patient arrives now" marks a future booking `arrived` so the walkthrough can consult it honestly.
- Table: all bookings for that day in time order (most urgent first within a slot); urgent rows are marked with the chart's pink on their time and edge. Columns: time, patient (name, age, family ID), reported by (ASHA / Voice line), symptoms captured (`reasons[]` joined), consult ("Start consult" / "Open consult", "Advice saved"). Nothing decided after the consult is editable from the table.
- Rows created offline in the ASHA app only appear once synced (drives the demo story).
- **Consult sheet** (opens from a row), in the order the work is done:
  - What was found.
  - `advice` text field (stands in for the 20-second voice note). Saving it does not set a follow-up.
  - `avoidable` toggle (Yes / No): "Could this have been handled without a visit?", answered with the patient seen.
  - Follow-up call choice: None, Next day, In 3 days, In a week (days after the visit). Choosing sets `followUpDue` and `followUpStatus = "pending"`; choosing the day already set keeps its outcome; None clears it.
  - "Mark follow-up answered / missed" buttons for demo purposes. Every outcome is logged (`followUpLog`) and shown as earlier calls, so clearing or moving the follow-up never erases that a call was missed.
  - Editing advice keeps the earlier words with their time (`adviceLog`); the family hears the latest.
  - The store refuses contradictions: advice or "avoidable" for a patient not yet arrived, a call outcome with no call planned, an emergency on any day but today, a booking without a concern or in an unbookable slot.
  - A missed call needs a decision: "Call again today" or "Ask the ASHA to follow up" (`ashaAsked`), or leave it open. Nothing is asked of the ASHA automatically.
- A second view: "Follow-ups", grouped by who acts: Needs attention now (due today, overdue, missed and undecided), With the ASHA (missed, ASHA asked), Upcoming (due later). The rail badge and the "Follow-ups due" figure count only Needs attention now.
- "Across the service, to date", below the list and quieter than the workload (every booking so far, not the day on screen): bookings pre-booked (%), potential trips avoided (count of "could have been handled without a visit"; a learning signal, not a score), follow-ups answered (%). These update live as the demo is used. This is the "outcomes" moment of the prototype.

---

## 7. Demo scenario and reset

Seed data (`seed.ts`):
- 1 ASHA (Savitri), 1 PHC (Tumkur, Dr. Ramesh), 5 families, of which:
  - Family 4471 (Lakshmi): child Arjun with a note "fever since Tuesday", no concern yet. This is the family the visitor will walk through.
  - 2 families with existing bookings for today (one red, one green), one from IVR.
  - 1 family with a booking already consulted and `advice` set, so menu 3 on the voice line has something to read.
  - 1 family with a missed follow-up.
- Default `online: false` so the visitor sees the offline banner first.

**Guided walkthrough** (optional but valuable): a small step indicator in the shell that suggests the order:
1. ASHA app, offline: check Arjun → amber → book → see "waiting to send".
2. Toggle signal on → watch it sync.
3. PHC dashboard: Tomorrow → Arjun's booking → (demo) patient arrives → start the consult → enter advice → say whether it could have been handled without a visit → choose the follow-up.
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
