# Arogya Line

An interactive prototype for a rural primary-care service concept: one shared
record that a community health worker, a family on a basic phone, and a
doctor at the primary health centre (PHC) can all reach. It is the working
demo behind a portfolio case study, not a product.

Everything runs in the browser from one in-memory store. There is no backend,
no network call and no saved data. A page refresh, or **Reset demo**, returns
to the seed scenario.

## The three surfaces

- **ASHA app** (`/asha`): a phone-sized app for the health worker. Today's
  list, a family's members, a short symptom check that triages to urgent /
  needs a visit / home care, and booking a PHC slot. Works offline: bookings
  wait on the phone and send when the signal toggle is turned on.
- **Voice line** (`/voice`): a simulated call from a basic phone. The caller
  keys in the family ID printed on their card, then uses the keypad to book
  a visit, run the same symptom check, or hear the doctor's last advice.
- **PHC dashboard** (`/phc`): the doctor's desktop view. A metrics strip, the
  day's bookings sorted by urgency, a visit-needed toggle, and an after-consult
  panel to record advice. The advice is what the voice line reads back.

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
   slot, see it waiting to send.
2. Turn the signal on and watch the booking sync.
3. PHC dashboard: Arjun appears; mark the visit needed and record advice.
4. Voice line: enter 4471, press 3, hear the advice read back.

The bar in the dark strip at the top (surface tabs, signal toggle, reset) is
demo chrome, not part of the product.

## Disclaimer

This is a concept prototype. The triage questions are illustrative and are
not clinical guidance. All names, families and data are invented.
