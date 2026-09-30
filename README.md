# Arogya Line

An interactive prototype for a rural primary-care service concept: one shared
record that a community health worker, a family on a basic phone, and a
doctor at the primary health centre (PHC) can all reach. It is the working
demo behind a portfolio case study, not a product. The scenario is set in
villages near Jaipur, Rajasthan; its people and records are illustrative.

Everything runs in the browser from one in-memory store. There is no backend,
no network call and no saved data. A page refresh, or **Reset demo**, returns
to the seed scenario.

## The three surfaces

- **ASHA app** (`/asha`): a phone-sized app for the health worker. Today's
  list of people who need her, a family's members, a short screening that
  suggests urgent / needs a visit / home care, and booking a PHC slot. A
  simulated offline-sync workflow: bookings wait on the phone and send when
  the (simulated) signal toggle is turned on.
- **Voice line** (`/voice`): a simulated call from a basic phone. The caller
  keys in the family ID printed on their card, picks the person by name, and
  can run the same screening, book a visit (read back before it is booked),
  or hear the advice that person was given. 0 reaches a person and never
  books anything by itself. No name is read aloud on a card number alone.
- **PHC dashboard** (`/phc`): the doctor's desktop view. Opens on today: the
  day's workload, bookings in time order with urgent ones marked, and a
  consult sheet for advice, "could this have been handled without a visit"
  and the follow-up call. Tomorrow's bookings can be viewed, not consulted.
  Follow-ups are grouped by who acts: needs attention now, with the ASHA,
  upcoming.

All three read and write the same store, so a booking made offline in the
ASHA app appears on the dashboard the moment it syncs.

## Run it

Requires Node 24.

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`. Other scripts: `npm run build`,
`npm run test`, `npm run lint`.

## Guided demo

Add `?guided=1` to the URL to show a step bar above the prototype that walks
through the story in order:

1. ASHA app, offline: check Arjun in family 4471, get "needs a visit", book a
   slot, see "1 visit to send".
2. Turn the signal on and watch the booking sync.
3. PHC dashboard: choose Tomorrow, open Arjun's booking. He has not arrived,
   so use the demo-only "Patient arrives now", then record advice, answer
   whether it could have been handled without a visit, and choose the
   follow-up.
4. Voice line: enter 4471, press 3, hear Dr. Meena's message for Arjun.

The bar in the dark strip at the top (surface tabs, signal toggle, reset) is
demo chrome, not part of the product; so is any control marked "Demo only".

Design rationale, edge cases and the test record: [docs/design-rationale.md](docs/design-rationale.md).
Behaviour, field by field: [SPEC.md](SPEC.md). The three are kept in step.

## Disclaimer

This is a concept prototype. The triage questions are illustrative and are
not clinical guidance. All names, families and data are invented.
