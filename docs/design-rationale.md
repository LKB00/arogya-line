# Arogya Line: design rationale, edge cases and test record

Every element on every screen of all three surfaces (the ASHA app, the voice
line and the PHC dashboard), why it is there, how it can break, and what the
design does about it. Each screen was tested in the running prototype, and the
logic behind the states is covered by unit tests (`npm run test`).

Visual design: [the design canvas](https://claude.ai/artifact/1XubsJGZU2zyRwLnDokiPG).
Behaviour: [SPEC.md](../SPEC.md). Principles referred to below:

| # | Principle | In one line |
|---|---|---|
| P1 | One next step | One primary action per screen, at the thumb (Hick's and Fitts's laws). |
| P2 | Her chart, her colours | IMNCI pink / yellow / green, always with an icon or a word, never colour alone. |
| P3 | Show what it is | People as who they are, symptoms as the body part, advice as a voice note. |
| P4 | Nothing is lost | Offline is a calm reassurance at the moment of saving, not an error. (Simulated in this prototype: see section 6.) |
| P5 | A shared decision | Results show what was found and what was ruled out. They are screening results, never a diagnosis. |
| P6 | End on the family | A booking ends with what to tell them (peak–end rule). |
| P7 | Every element earns its place | If it repeats what is already on screen, it goes. |
| P8 | Every action creates a clear next action | Each step hands something to a named person, and nothing is handed over without someone deciding it (section 7). |

---

## 1. Workflow

Every path through the app, including the guard paths added in this pass.

```mermaid
flowchart TD
    T[Today] -->|Up next card| F[Family]
    T -->|any row| F
    T -->|Check someone| P[Which family?]
    P -->|a household| F
    F -->|Check name's symptoms, or tap a person| C{Symptom check<br/>one question at a time}
    C -->|Yes / No| C
    C -->|danger sign answered Yes| R
    C -->|all answered| R{Result}
    C -->|X| F
    R -->|Home care: Save this advice| T
    R -->|Needs a visit: Book PHC visit| B[Book a visit]
    R -->|Already booked: View existing visit| D
    R -->|Needs a visit: Call the doctor line| V[Voice line]
    R -->|Urgent: Call PHC now| VE[Voice line, emergency]
    B -->|Book visit| D[Visit booked]
    D -->|Done / X| T

    R -. unfinished check, e.g. bookmark .-> C
    B -. unfinished check .-> C

    D -. syncs when the phone has signal .-> PHC
    V --> VM{Voice line menu}
    VM -->|1 or 2| VW[Who needs help? by name] --> VR{Result}
    VR -->|home care| VH[Advice spoken; ASHA told] -.->|Follow up task| T
    VR -->|needs a visit: press 1| VC[Read back: press 1 to confirm] --> VB[Booked on the line] --> PHC
    VC -->|2| VR
    VR -->|urgent| OP[Health worker] --> PHC
    VM -->|0, from anywhere| OP
    VM -->|3| VA[Advice read back, per person]
    PHC[PHC dashboard: today's list, by time] -->|Start consult| AC[Consult sheet]
    AC -->|advice saved| VA
    AC -->|follow-up call chosen| FU[Follow-ups] --> T

    subgraph Sync [Phone state, shown on every screen]
      S1[Offline, nothing waiting: no chip] --> S2[Offline: 'Offline · 1 visit to send']
      S2 -->|signal on| S3['Sending 1 visit…']
      S3 -->|store sends| S1b[Online, all sent: no chip]
    end
```

---

## 2. Screens

### 2.1 Today

Answers her first question of the day: *who needs me first?*

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Date | Anchors "today" and "tomorrow" on every row. | None found. | Long form ("Sunday, 27 Sep") so no ambiguity. |
| Offline chip | P4: she must know her work is safe without signal. | Offline with nothing waiting; signal back but not yet sent; items sent. | Hidden when nothing waits (nothing to worry about). Counts in her units: a booking is "1 visit", a check without a booking "1 check", never a concern plus a booking (**fixed after the second review**, unit-tested). "Sending 1 visit…" in the gap after the signal returns, so the chip never disappears while rows still say "Waiting to send". Clears when sent. Tested. |
| Greeting | Speaks to her before listing work; the app is hers. | None. | — |
| "n people need you today · n urgent" | The size of the day in people, the unit of care, and the one number that cannot wait. | Nothing open; no urgent. | Hidden on an empty day (the empty state says it). Urgent count only shown when above zero, in pink text, no dot (P7). |
| Day strip (removed) | Was meant as progress. | Nothing marks a visit done, so it never filled and repeated the list. | Removed (P7). Returns only if visits can be marked done. |
| Up next card | P1: the person who needs her first, with the one action. **Fourth review:** ranked by what is due (danger, late calls, calls due today, today's visits by time, undated concerns), not by colour alone; never tomorrow's work. | No open work; most urgent is yellow or green; record not yet sent; no member recorded on the concern; no note and no findings. | **Simplified after the second review:** person, then what to do and when (the heaviest line), then why, then village and card; the family head's name and the card number at the top are gone. Hidden when nothing is open. Takes the colour of whatever leads. Shows "Waiting to send" when unsent (P4). Falls back to the family head and "Open the family". Reason line hidden when there is no reason. Tested. |
| Person first ("Kavya, 5") | The concern is about Kavya, not about Manjunath. | Concern without member. | Falls back to the family head. Unit-tested. |
| Card number | Ties the screen to the printed family card. | — | Quiet, tabular. |
| "+1 other person in this family" | The family is where she finds people, not the work item. When one household holds two people who need her, one row per family would hide the second. | Two open people in one household; one person with two concerns. | **Added after review.** One row per person; each row (and Up next) says how many others in the same family also need her. One person with several concerns still shows once, under the most urgent. Unit-tested. |
| Upcoming | Visits on a later day. | **A visit tomorrow sat under "Later today" and counted in "people need you today".** | **Fixed after the fourth review:** its own section after today's work, sorted by date; not counted as today. Unit-tested. |
| "+1 more for Arjun" | A person with several open items shows once, but nothing is hidden. | Two concerns for one person. | **Added after the fourth review:** the count on the row; the family screen lists every item for that person. Unit-tested. |
| "Later today" list | Everyone else due today, with the village for planning her walk. | Only one family open (nothing later); families already seen; several concerns in one family. | Hidden when empty. Already-seen families get their own "Already seen" section instead of sitting under "Later today". One row per person, the most urgent concern leading (unit-tested). |
| Subheads ("Needs a visit") | Say the urgency in words (P2). | — | Coloured text, no dot (P7). |
| Row icon circle | What she will do (visit, call, home visit), tinted with the urgency. | — | Colour + icon; the word is in the subhead. |
| "Waiting to send" on a row | P4, at the record it concerns. | Sync in progress. | Stays until the store marks it sent; tested through the full offline → sending → sent cycle. |
| Check someone (extended FAB) | The one way to start something new, always in reach. Named as care work, not data entry. | Covering the last row. | **Renamed from "New concern" after the second review.** The list reserves 104 px below it. |
| Follow up at home (missed call) | The doctor asked her to follow up a missed call. | **A missed call alone became "Home visit": a commitment nobody made.** | **Fixed after the third review:** only when the doctor chooses "Ask the ASHA to follow up"; the row says so ("Doctor asked"). Unit-tested. |
| Follow up (from the voice line) | A family that called and was told "your ASHA will follow up" must appear on her list. | Home-care result on the line with no booking. | **Added after the second review:** a "Follow up · Called the voice line" task for today. The line promises only what this row delivers. Unit-tested. |
| Empty day | Good news, said plainly. | — | "No one is waiting on you today", with the next thing she might do. |

### 2.2 Which family?

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Grouped by village | How she already holds her households in her head. | A village with one family. | Singular/plural count. |
| Household drawn as people | P3: recognise a household before reading a name. | Older person; pregnant woman; mother. | Icons for child, woman, older person (60+), adult; the age is always written too. |
| What the family told her | The reason the right family stands out. | A note on someone who already has a concern. | Only shown when there is no concern yet; otherwise the status shows. |
| Status line | What is open for that family. | Colour alone would fail colour-blind eyes and sunlight. | The word leads: "Urgent · Kavya, PHC visit tomorrow" (P2). Tested. |
| Card number | Confirms the family against their printed card. | — | — |

### 2.3 Family

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Village and card number | Confirms she is at the right house. | — | — |
| "Who is unwell?" | The question the screen answers. | Nobody flagged. | Adds "Tap the person you are worried about to check them." |
| Person cards | One tap to check anyone. | The reported person; one-person household. | Reported or open person comes first, with a stronger edge. |
| Urgency chip and task | What is already open for this person. | Visit in the past; **two people open in one family showed only the most urgent one's status.** | Only open work shows (unit-tested). **Fixed after the second review:** every person shows their own. |
| Quote | The family's own words (P3). | No note. | Hidden. |
| Check name's symptoms | P1: the likely next step, at the thumb. | Nobody flagged; one member. | Hidden when nobody is flagged; the hint "or tap anyone above" hidden for one-person households. |
| Advice given | Each person's latest advice, named: the doctor's as a voice note (P3, Jakob's law), home-care advice from a check as words. | **Advice was the family's latest, so Arjun's screen could show Lakshmi's note.** No advice; long advice. | **Fixed after the second review:** advice belongs to a person (`adviceByPerson`, unit-tested), and the same lookup feeds the voice line. Hidden without advice. Playing shows the words (v1 has no audio). |

### 2.4 Symptom check

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| X | Leave the check. | Accidental tap loses progress. | Answers live in the URL, so browser back restores them. |
| "Checking Arjun, 3" and "3 of 4" | Who and how far. | Danger sign ends the check early. | Jumps straight to the result. |
| Segments | Progress at a glance. | — | Done, current and still to come in three tones. |
| Answered chips | See the path so far. | First question. | Hidden until there is an answer. |
| Question picture | P3: the thing asked about, not a metaphor. | Unknown question id. | Falls back to a heartbeat. |
| Question | The screen's single decision. | Long questions. | 32/40 with `text-wrap: pretty`. |
| Read aloud (removed) | Was present because SPEC allowed a silent control. | It looked like it worked and did nothing. | **Removed after review** (P7): a control that does nothing costs more trust than it earns. Speech is a product gap (section 6). |
| Yes / No | Equal weight, so no answer is nudged. | Double tap. | Each tap navigates once; answers are appended to the URL. |

### 2.5 Result

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Verdict band | P2: colour, icon and word, seen before read. | **Opened without a finished check** (bookmark, link, lost answers). | **Fixed in this pass.** It used to say "can be cared for at home" from no answers: false reassurance about a sick person. Now redirects to the next unanswered question. Tested. |
| Status bar tint | The verdict runs edge to edge. | — | Tints only while a verdict is on screen. |
| Headline | Names the person and the action in plain words. A screening result, not a diagnosis, and labelled "Screening result" above the headline (third review). | Long names; over-certain wording. | Wraps. **Reworded after review:** green says "No urgent signs found for Arjun", not "can be cared for at home". |
| Tell the family / Call again if | A home-care result must carry the advice she gives. | **"Save home-care advice" saved advice that was never on screen.** | **Added after review.** The advice comes from `triage.ts` (`HOME_CARE`), shared with the voice line, so both give the same words. Plain lines, no icon each (P7). Button: "Save this advice". **After the second review the advice is actually saved** (`Concern.homeCare`), so the family screen and the voice line can give it again. |
| What you found | P5: found, danger sign, ruled out. | Danger sign present; nothing ruled out. | "Danger sign" tag in solid pink; "Ruled out" in green. |
| Existing visit | Checked again while already booked: the likely intention is the visit she has. | Person already has a visit booked (needs a visit); home-care result with a visit booked. | **Changed after review:** the verdict says "A PHC visit is already booked: Tue 29 Sep, 9–10 am."; the primary action is "View existing visit", and "Book another visit" is the deliberate second choice. A home-care result keeps a one-line notice. Tested. |
| Primary action | P1, per verdict. | Urgent. | Urgent is the only button in a triage colour. |

### 2.6 Book a visit

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| "For Arjun, 3" and the PHC | What and where she is booking. | Opened without a finished check. | **Fixed:** redirects to the next question. Tested. |
| Day cards | Three days, calendar-like. | — | Tomorrow preselected (the usual case). |
| Time slots, morning / afternoon | Grouped the way she would say it. | **Today's slots already past; a slot filling while she chooses; a day with nothing left.** | **Fixed:** past slots say "Already past", full ones "Full"; both stay in place so nothing jumps. A day with nothing left says "No times left today. Choose another day." A slot that fills after she picked it is unselected and cannot be booked over. Unit-tested and tested live at 10 pm. |
| Offline note | P4, before she commits. | Online. | Only shown offline. |
| Reservation bar | The choice read back beside the button (Airbnb, Uber). | Nothing chosen. | "Choose a time", button disabled. |

### 2.7 Visit booked

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Tick and headline | A calm, certain close (P6). | Booking id not found (e.g. after Reset demo). | "Booking not found" with a way back. |
| Slip | Written to be shown to the family. | Member missing. | "The patient". |
| Sync line | P4 on the record itself. | Sent while on screen. | Updates live to "Sent to the PHC". |
| Tell the family | P6: what she says before leaving. | Leaving the screen. | Ticks are local, as SPEC says. |
| Done / X | Back to her day. | — | — |


### 2.8 Voice line

The family's side of the service: a call to the number on their card, from
any phone. Dark, like a phone's own in-call screen, so it never reads as the
ASHA's app.

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Back to ASHA app | The call was handed over from the ASHA app. | Plain `/voice` has nowhere to go back to. | Shown only for a handed-over call. |
| Caller ID (hospital) | Who is on the line: the health centre, not an app. | — | — |
| Number · status | Ready to dial, On call (green), Call ended. | — | Green only while connected. |
| Live captions | There is no audio, so what the line says is written. | **A long prompt (the doctor's advice) cut off at the top.** Empty before a call. | **Fixed:** the list scrolls to the first line of the prompt still waiting, so it is read from its start; a fade at the foot says there is more. Empty state says how to start. Tested. |
| Speaker names | Who said it: the line, or the health worker. | Every line named. | Named once per run of lines. |
| Caller pills | What the caller pressed, on the right. | The ID typed as one line. | "Pressed 1", "Entered 4471". |
| Family ID boxes | Keyed in the way it is printed on the card. | Partial entry; a wrong ID. | Next box outlined; a wrong ID is said and asked again (unit-tested). |
| Keypad | Everything is done by keys, on any phone. | Keys before a call. | Asleep until the call starts; keyboard keys ignored when idle. Tested. |
| 9 repeat, 0 person | Always available, written on the keys. | During ID entry 0 and 9 are digits. | The ID accepts them as digits (unit-tested). |
| Call / Hang up | One round button, green to call, red to hang up. | Hang up while the health worker is talking; **after "Goodbye" the line still said "Hang up to finish".** | Hanging up stops the scripted operator; no booking is made. **Fixed after the second review:** the call ends on "Goodbye"; the keys go quiet and the button turns green, "Call again". Tested. |
| Result spoken | The verdict in words. | **It said "Result: amber".** | **Fixed:** "Result: needs a visit." A home-care result says "No urgent signs found", then the same advice as the ASHA app. Unit-tested. |
| Advice read back | The advice a person was given, from the PHC or a check. | **Dated in ISO; dated "tomorrow" when written ahead of a visit; read the family's latest, whoever it was for.** | **Fixed:** "yesterday", "Fri 25 Sep", or no date when the visit is still to come. **After the second review:** always named ("Advice for Shobha from Dr. Ramesh…"); with several people, "Whose advice would you like to hear? Press 1 for…". Unit-tested. |
| Who needs help | Picks the person, and so the questions. | **"Pregnant woman" in a family with none ran pregnancy questions on a man; "child" could not tell two children apart.** | **Fixed after the second review:** "Press 1 for Lakshmi. Press 2 for Arjun." By name, never by kind; the question set follows the person. A key with nobody behind it asks again. Unit-tested. |
| Spoken wording | A phone service, not a transcript of one. | **"Result: needs a visit"; "Advice for Arjun from Dr. Ramesh: …"; "Press 1 for the main menu".** | **Changed after the third review:** "Thank you. From your answers, Arjun should see the doctor."; "Dr. Ramesh has a message for Arjun." … "That's all from Dr. Ramesh. Press 1 to hear it again, or 2 for the main menu." Unit-tested. |
| What you told us | The caller hears their answers back. | **"Noted: fever more than 2 days; no chest pain." was a written list read out.** | **Fixed after the fourth review:** "You told us about fever more than 2 days and vomiting more than 3 times today. You did not report fast breathing." Unit-tested. |
| Advice replayed | What the family was told, as a record. | **The line rebuilt home-care advice from today's protocol, not what was said at the time.** | **Fixed after the fourth review:** the spoken words are saved with the concern and replayed exactly. Unit-tested. |
| Emergency | Come now, and everyone is told. | **An emergency also booked an ordinary slot; a call with no person chosen named the family head.** | **Fixed after the fourth review:** an emergency arrival for today ("Now"), first on the PHC list, no slot; "the patient" unless a person was chosen. Unit-tested. |
| "Next available time" | Promise only what the diary can keep. | **"Let me get you seen today" before a slot was found; late at night the slot was tomorrow.** | **Fixed after the fourth review:** "Let me find the next available time." then the time with its day. Unit-tested. |
| Health worker hand-off | A person never makes the caller start from zero. | Caller pressed 0 halfway through the questions. | **Added after the third review:** the health worker says what the line already heard ("I have Arjun's answers from the call: …"). Unit-tested. |
| Home-care result spoken | The advice, as a person would say it on the phone. | **Read as a list ("At home: …; …"); promised "Your ASHA will visit tomorrow" with nothing behind it.** | **Fixed after the second review:** spoken sentences (`HOME_CARE.spoken`); "Your ASHA, Savitri, has been told and will follow up with you", which the saved concern makes true on her list. Unit-tested. |
| Read-back before booking | Choosing a slot and committing to it are two steps; a voice interface has no screen to check. | **Pressing 1 once booked immediately.** | **Added after review:** "You are booking a visit for Arjun, tomorrow, Tue 29 Sep, 10–11 am, at PHC Tumkur. Press 1 to confirm, or 2 to choose another day." Nothing is written until the caller confirms. Unit-tested. |
| Slot offered | The next free slot, to press 1 to choose. | **The slot fills while the caller listens; pressing 1 booked a different slot.** | **Fixed:** books exactly what was spoken, or says it was just taken and offers the next. Unit-tested. |
| Health worker | A person, from anywhere with 0, or for an urgent result. | **Late in the day it booked a slot already past; a full day double-booked.** | **Fixed:** the next real slot, today or later, spoken with its day; an urgent call says "come now" first. Unit-tested. |

#### The printed family card

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Number, largest | The one thing to find at a glance. | — | 32 px, tabular. |
| Family ID in four boxes | The same boxes the call shows when keying it in. | — | — |
| Menu as keys with pictures | For anyone who reads slowly. | Menu 2 was missing from the old card. | All four choices, 1 2 3 0. |

### 2.9 PHC dashboard

The doctor's side. A Material 3 list–detail layout: the day's list and the
after-consult sheet side by side, so the list never moves while the doctor
writes.

| Element | Why it is there | Edge cases | How the design handles it |
|---|---|---|---|
| Navigation rail | Two views: the day and the follow-ups. | Follow-ups waiting. | A count badge on Follow-ups. |
| Day | Which day's list. | **A nonsense day in the URL; the field cleared; opened on tomorrow, not today.** | **Fixed:** opens on today, what a doctor opens it for, with Today and Tomorrow one tap away and a date field for any day; a bad day falls back to today (unit-tested). The seed's bookings moved to today so the demo opens on work. |
| Workload | What needs the doctor: for the day on screen (patients, urgent, consults remaining) and, separately, what needs attention now (follow-ups due). **Fourth review:** the two groups are captioned apart, so "Tomorrow" never sits beside "due today"; "Advice to record" renamed "Consults remaining". | Empty day; no urgent; missed calls. | **Replaced the outcomes strip at the top after review:** reporting was sitting above operations. Urgent is the only figure in colour, and only when above zero; its detail reads "Danger sign found", not "seen first", now that the list is by time. Follow-ups due counts today's, overdue and missed (unit-tested). |
| Across the service, to date | Whether the loop is working: booked ahead, potential trips avoided, follow-ups answered. "Potential trips avoided" (renamed after the third review) is a learning signal about referrals, never a score for a doctor or a family. | No data; **a day on screen above figures for every day.** | **Heading names the period after the second review.** **Moved below the list and made quieter** (no cards). "—", never a division by zero (unit-tested). Live as the doctor works (tested). |
| Counts by urgency (removed) | Was the day's weight. | Repeated the workload's patients and urgent figures. | Removed (P7); the list heading says the order instead: "Bookings, most urgent first". |
| Row action | What the doctor can do with this booking now. | **Tomorrow's booking offered "Start consult": a consult could be recorded for a patient not yet in the room.** | **Fixed after the third review:** "View booking" (future; the sheet says "Not arrived yet"), "Start consult" (today), "Complete consult" (a past day), "Open consult" (done). The walkthrough uses a fenced-off "Demo only · Patient arrives now". Unit-tested. |
| The list | By time, the order patients walk in; most urgent first within a slot. Urgency is a signal (pink time and edge), not the sort, so the doctor always knows who is next (**changed after the second review**, unit-tested). | Bookings still on an ASHA's phone; an empty day; a walk-in with nothing recorded. | Only synced bookings (unit-tested); an empty day explains why offline bookings may be missing; a walk-in reads "Nothing recorded before the visit". |
| Patient cell | Who, and how they came (ASHA, voice line, walk-in). | — | Icon and words. |
| What was found | The ASHA's or the family's answers. | — | Urgency word in the chart's colour, then the findings. |
| Could this have been handled without a visit? | A question about the referral, which the doctor can answer only after seeing the patient. | **"Was the visit needed?" could mean five things; then the answer sat in the table, answerable before the consult.** Not yet set. | **Reworded after the first review** (data: `avoidable`); **after the second, only in the consult sheet**, after the advice. The table's action says "Start consult" / "Open consult". |
| Record / Edit advice | Opens the sheet. | Saved. | "Advice saved" under the button. |
| Consult sheet | Everything for one patient, in the order it is done: what was found, advice, could it have been handled without a visit, follow-up. | **Narrow windows squeezed the list; a link to a booking not yet synced; closing.** | **Fixed:** floats over the list below 1280 px wide; a booking not yet synced says so; Escape closes. Tested. |
| Advice box | The words read to the family on the voice line. | Blank or spaces; unchanged; editing later. | Save disabled for blank or unchanged; "Saved" once saved; **editing no longer resets an answered follow-up** (store fixed and unit-tested). |
| Follow-up call | Whether and when to call the family: a clinical decision, not a default. | **Every consult got a next-day call.** Changing the day; an answered call; none. | **Changed after review:** None, Next day, In 3 days, In a week. Picking the day already set keeps its outcome; a new day reopens it; None clears it. A pending call past its day reads "Overdue", and on the ASHA's list it stays a call to make (unit-tested). |
| Mark answered / missed | Demo control for the outcome. | Which one is set. | The current one shows as pressed. |
| After a missed call | Someone decides what happens next. | **Missed was read as "ASHA visit requested".** | **Fixed after the third review:** "Call again today" or "Ask the ASHA to follow up"; or leave it open, where it stays under Needs attention now. Unit-tested. |
| Follow-ups view | Who acts on each call, and when. | **"Follow-ups: 5" beside "Follow-ups due: 1": open and due are different things.** | **Fixed after the third review:** grouped as Needs attention now, With the ASHA, Upcoming. The rail badge and "Follow-ups due" count only Needs attention now (unit-tested). |

---

## 3. Across the app

| Case | How it is handled |
|---|---|
| Colour blindness, sunlight | Triage colours differ in lightness as well as hue, and always come with a word or icon. |
| Keyboard | Every control is a real button, link or input; focus is always visible. An automated sweep found no unnamed controls. |
| Screen readers | Icons are hidden; icon-only buttons are labelled; the offline chip says what it means in full. |
| Reduced motion | Animations drop to zero. |
| Pixel grid | An automated sweep of every screen found no block off the 4 px grid (edges are drawn as outlines and hairlines, so they add no height). |
| Reset demo mid-flow | Screens that lose their record show "not found" with a way back. |
| Text overflow | An automated sweep found no horizontal overflow on any screen. |

---

## 4. Test record

| Area | How | Result |
|---|---|---|
| What each family needs today (8 cases) | Unit tests, `rows.test.ts` | Pass |
| Slot availability (5 cases) | Unit tests, `slots.test.ts` | Pass |
| Triage, store, voice line | Existing unit tests | Pass |
| Full visit: Today → family → check → result → book → booked → Today | In the running app | Pass |
| Offline → "Sending" → sent | In the running app | Pass |
| Result and booking without a finished check | In the running app | Redirect to the next question |
| Past slots, full slots, no times left | In the running app at 10 pm | Pass |
| Rebooking someone already booked | In the running app | Notice shown |
| Grid, overflow, accessible names | Automated sweep of 9 ASHA screens, the voice line (idle, keying an ID) and the dashboard (day, sheet, follow-ups) | Pass |
| Voice line logic (23 cases, 8 new) | Unit tests, `callMachine.test.ts` | Pass |
| Dashboard selectors (9 cases) | Unit tests, `selectors.test.ts` | Pass |
| Advice edits keep the follow-up outcome; follow-up choice | Unit tests, `store.test.ts` | Pass |
| Review fixes: per-person rows, voice read-back, workload, follow-up choice, green advice | Unit tests (73 in total) and in the running app | Pass |
| Fourth review: today vs upcoming; up next by work; items per person; spoken "you told us"; exact advice replay; emergency as come-now; no early promise; day vs now figures | Unit tests (102 in total) and in the running app | Pass |
| Third review: consult only when the patient can be there; missed calls need a decision; follow-ups grouped by who acts; spoken wording; health-worker context | Unit tests (96 in total) and in the running app | Pass |
| Second review: voice picks the person by name; advice per person; home-care advice saved; line's promise backed by an ASHA task; sync chip in visits; consult-only "handled without a visit"; list by time; opens on today; call ends on goodbye | Unit tests (83 in total) and the whole loop in the running app | Pass |
| Voice line: dial, ID, menu, questions, advice, operator, hang up, Backspace, keys while idle, emergency handover | In the running app | Pass |
| Dashboard: save, edit, answered, missed, avoidable, follow-up choice, Escape, bad day, empty day, missing booking, follow-ups | In the running app | Pass |
| The whole loop: ASHA books offline → PHC cannot see it → signal → PHC sees it → advice saved → family hears it on the line | In the running app | Pass |

---

## 5. Known gaps, by choice

- **Call timer** on the voice line is left out: it would be a new feature beyond SPEC.
- **The dashboard shows only synced bookings**, as a real PHC would; it cannot know what is still on an ASHA's phone.
- **Saving home-care advice** returns to Today without a confirmation; the new row on Today is the confirmation.
- **Rebooking** is not blocked, only made the second choice: a second visit can be clinically right.
- **Kannada** is out of scope for v1 (SPEC 1); Figtree was chosen so a matching Kannada face can follow.

---

## 6. Prototype limits and product gaps

Two different lists. The first is what this prototype leaves out to stay a
prototype; the second is what a real service would still have to design.

**Prototype limits** (fine for a demonstration)

- No backend and no persistence: one in-memory record, reset on reload.
- **Offline is simulated.** The signal switch in the demo bar is labelled
  "Simulated ASHA signal"; the prototype shows an offline-sync workflow for
  low-connectivity settings, not offline-first code.
- No real telephony and no audio: the voice line is written as captions.
- No authentication: the family is identified by the 4-digit ID printed on
  the card. A production service would need patient authentication, consent
  and access controls suited to health data.
- Illustrative triage questions, not clinical guidance. In production the
  thresholds are not the designer's: an approved clinical protocol feeds a
  decision engine, the interface presents its result, and a human (the
  health worker, the doctor) is always one key away.

  ```
  Approved clinical protocol → Decision engine (triage.ts) → Interface → Human escalation (0, Call PHC now)
  ```

**Production models to design** (not built; named so they are not missed)

- *Identity and privacy.* The family ID alone opens a family's record on the
  line. A real service needs verification before anything is read out,
  consent for what is shared, and answers for shared phones, lost cards,
  someone else learning the number, and medical details spoken aloud in a
  crowded room.
- *Clinical governance.* Questions, thresholds and home-care advice come from
  an approved protocol with an owner and a review date, never from product
  copy. The pipeline: approved protocol → approved advice → local wording →
  voice rendering.
- *Clinical result vs operational priority.* The prototype uses one scale
  (urgent / needs a visit / home care) for both. A real service separates
  the clinical result (no urgent signs / needs clinician review / emergency)
  from priority (now / today / routine).
- *Language.* One real flow in Kannada first, end to end on the voice line,
  before any other language.
- *Offline.* Local storage on the phone, a sync queue with retries and
  conflict rules, and a clear record of what the PHC has and has not
  received. The prototype only simulates this.

**Product gaps** (the design work still to do)

- Language: Kannada (and other languages) for the voice line and the ASHA app.
- Patient identity and privacy on a shared phone number.
- A care-journey view shared by all three surfaces: concern, screened,
  booked, seen, advice, follow-up.
- Escalation beyond "come now", and a real operator hand-off.
- Real clinic availability, capacity and cancellations.
- Speech: questions and advice read aloud in the ASHA app.
- A clinical note separate from the message for the family: the doctor's
  record ("BP 160/100, review in a week") is not what the family should hear
  verbatim. Today one text box does both.
- Follow-up timing anchored to the actual consultation, not the booked day
  (a visit booked for the 29th but seen on the 30th).
- Explicit owner on every follow-up (PHC, ASHA, family), beyond the three
  groups in the Follow-ups view.

---

## 7. Who gets the next action

The product is one care record moving between three people. Every action
should create a clear next action for someone else. Where the prototype does
that, and where it does not yet:

| When | The next action | For whom | Where it shows |
|---|---|---|---|
| The ASHA books a visit | See the patient | Doctor | PHC day list, once synced |
| The ASHA loses signal | Nothing is lost; it sends later | The ASHA's phone | "Offline · 1 visit to send" |
| A family's check on the line finds no urgent sign | Follow up with the family | ASHA | Today: "Follow up · Called the voice line" |
| A family books on the line | See the patient | Doctor, and the ASHA can see it | PHC list; ASHA Today |
| The doctor saves advice | Hear it | Family | Voice line, menu 3, named for the person |
| The doctor chooses a follow-up call | Make the call | ASHA (today's list) and the PHC Follow-ups view | Today: "Follow-up call"; PHC Follow-ups, Upcoming until due |
| A follow-up call is missed | Decide what happens next | Doctor | PHC Follow-ups: Needs attention now |
| The doctor asks the ASHA to follow up | Follow up at home | ASHA | Today: "Follow up at home · Doctor asked" |
| The family presses 0 | Talk to a person who already has the answers | Health worker | "I have Arjun's answers from the call" |
| A patient booked for tomorrow | Wait; nothing to record yet | Doctor | "View booking" · "Not arrived yet" |
| Urgent result | Come now | Family, health worker, doctor | Operator call; PHC list marked urgent |

Not yet designed: a care timeline for one person (concern → screened →
booked → seen → advice → follow-up) shown on all three surfaces, and
visible hand-off moments ("advice now available to the family by phone").

