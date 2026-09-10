// ASHA home screen (SPEC 6.1 TodayList). One row per family with something
// open today, sorted red → amber → green → done.

import { Link } from "react-router-dom";
import { useStore } from "../../app/store";
import { ASHA, isoDate } from "../../app/seed";
import { URGENCY_LABEL, dayLabel, slotLabel } from "../../app/format";
import type { Booking, Concern, Family, SyncStatus, Urgency } from "../../app/types";

type Band = Urgency | "done";
const BAND_ORDER: Record<Band, number> = { red: 0, amber: 1, green: 2, done: 3 };

/** What kind of thing is due, so the row can show a fitting icon. */
type Kind = "visit" | "call" | "home" | "concern" | "done";

type When = { day: string; time?: string };
/** task = what the ASHA does; note = why, when the task alone does not say. */
type Row = { family: Family; band: Band; kind: Kind; task: string; note?: string; when?: When; sync: SyncStatus };

const BANDS: Band[] = ["red", "amber", "green", "done"];

function rowFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row | null {
  const own = concerns.filter((c) => c.familyId === family.id);
  const candidates: Row[] = [];

  for (const concern of own) {
    const booking = bookings.find((b) => b.concernId === concern.id);

    if (!booking) {
      const green = concern.urgency === "green";
      candidates.push({
        family,
        band: concern.urgency,
        kind: green ? "home" : "concern",
        task: green ? "Home care advised" : "Concern noted",
        note: concern.reasons[0],
        sync: concern.sync,
      });
      continue;
    }

    if (booking.date >= today) {
      candidates.push({
        family,
        band: concern.urgency,
        kind: "visit",
        task: "PHC visit",
        when: { day: dayLabel(booking.date), time: slotLabel(booking.slot) },
        sync: booking.sync,
      });
    } else if (booking.followUpStatus === "pending" && booking.followUpDue === today) {
      candidates.push({ family, band: concern.urgency, kind: "call", task: "Follow-up call due", when: { day: "Today" }, sync: booking.sync });
    } else if (booking.followUpStatus === "missed") {
      candidates.push({ family, band: concern.urgency, kind: "home", task: "Home visit requested", note: "Follow-up missed", sync: booking.sync });
    } else {
      candidates.push({ family, band: "done", kind: "done", task: "Consulted", when: { day: dayLabel(booking.date) }, sync: booking.sync });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band]);
  return candidates[0];
}

export default function TodayList() {
  const families = useStore((s) => s.families);
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const today = isoDate(0);

  const rows = families
    .filter((f) => f.ashaId === ASHA.id)
    .map((f) => rowFor(f, concerns, bookings, today))
    .filter((r): r is Row => r !== null)
    .sort((a, b) => BAND_ORDER[a.band] - BAND_ORDER[b.band]);

  return (
    <>
      <section className="screen">
        <header className="screen__header">
          <h1 className="screen__title">Today</h1>
        </header>
      {rows.length === 0 ? (
        <p className="screen__empty">Nothing open today.</p>
      ) : (
        BANDS.map((band) => {
          const group = rows.filter((r) => r.band === band);
          if (group.length === 0) return null;
          return (
            <section className="group" key={band}>
              <h2 className={`group__title urgency urgency--inline urgency--${band}`}>
                {URGENCY_LABEL[band]}
                <span className="group__count">{group.length}</span>
              </h2>
              <ul className="today__rows">
                {group.map((r) => (
                  <li key={r.family.id}>
                    <Link className={`row row--${r.band}`} to={`/asha/family/${r.family.id}`}>
                      <span className={`row__icon row__icon--${r.kind}`} aria-hidden="true" />
                      <span className="row__main">
                        <span className="row__task">{r.task}</span>
                        <span className="row__who">
                          {r.family.head}
                          <span className="row__id">{r.family.id}</span>
                        </span>
                        {r.note && <span className="row__note">{r.note}</span>}
                        {r.sync === "saved_offline" && <em className="pill pill--waiting">Waiting to send</em>}
                      </span>
                      {r.when && (
                        <span className="row__when">
                          <span>{r.when.day}</span>
                          {r.when.time && <span>{r.when.time}</span>}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
      </section>
      <p className="fab-bar">
        <Link className="btn btn--primary fab" to="/asha/families">
          New concern
        </Link>
      </p>
    </>
  );
}
