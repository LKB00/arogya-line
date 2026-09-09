// ASHA home screen (SPEC 6.1 TodayList). One row per family with something
// open today, sorted red → amber → green → done.

import { Link } from "react-router-dom";
import { useStore } from "../../app/store";
import { ASHA, isoDate } from "../../app/seed";
import { URGENCY_LABEL, dayLabel, longDate, slotLabel } from "../../app/format";
import type { Booking, Concern, Family, SyncStatus, Urgency } from "../../app/types";

type Band = Urgency | "done";
const BAND_ORDER: Record<Band, number> = { red: 0, amber: 1, green: 2, done: 3 };

type Row = { family: Family; band: Band; reason: string; sync: SyncStatus };

/** Demo family used until a family picker exists (SPEC 6.1). */
const DEFAULT_FAMILY_ID = "4471";

function rowFor(family: Family, concerns: Concern[], bookings: Booking[], today: string): Row | null {
  const own = concerns.filter((c) => c.familyId === family.id);
  const candidates: Row[] = [];

  for (const concern of own) {
    const booking = bookings.find((b) => b.concernId === concern.id);

    if (!booking) {
      const reason =
        concern.urgency === "green" ? `Home care advised. ${concern.reasons[0] ?? ""}`.trim() : concern.reasons[0] ?? "Concern noted";
      candidates.push({ family, band: concern.urgency, reason, sync: concern.sync });
      continue;
    }

    if (booking.date >= today) {
      candidates.push({
        family,
        band: concern.urgency,
        reason: `PHC visit ${dayLabel(booking.date).toLowerCase()}, ${slotLabel(booking.slot)}`,
        sync: booking.sync,
      });
    } else if (booking.followUpStatus === "pending" && booking.followUpDue === today) {
      candidates.push({ family, band: concern.urgency, reason: "Follow-up call due today", sync: booking.sync });
    } else if (booking.followUpStatus === "missed") {
      candidates.push({ family, band: concern.urgency, reason: "Follow-up missed. Home visit requested", sync: booking.sync });
    } else {
      candidates.push({ family, band: "done", reason: `Consulted ${dayLabel(booking.date).toLowerCase()}`, sync: booking.sync });
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

  const urgent = rows.filter((r) => r.band === "red").length;

  return (
    <section className="screen">
      <header className="screen__header">
        <p className="screen__eyebrow">{ASHA.name} · ASHA worker</p>
        <div className="screen__headline">
          <h1 className="screen__title">Today</h1>
          <Link className="btn btn--accent btn--compact" to={`/asha/family/${DEFAULT_FAMILY_ID}`}>
            New concern
          </Link>
        </div>
        <p className="screen__sub">
          {longDate(today)}
          {rows.length > 0 && ` · ${rows.length} ${rows.length === 1 ? "family" : "families"}`}
          {urgent > 0 && `, ${urgent} urgent`}
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="screen__empty">Nothing open today.</p>
      ) : (
        <ul className="today__rows">
          {rows.map((r) => (
            <li key={r.family.id}>
              <Link className={`row row--${r.band}`} to={`/asha/family/${r.family.id}`}>
                <span className="row__head">
                  {r.family.head}
                  <span className="row__id">{r.family.id}</span>
                  <span className={`urgency urgency--${r.band}`}>{URGENCY_LABEL[r.band]}</span>
                </span>
                <span className="row__status">
                  <span className="row__reason">{r.reason}</span>
                  {r.sync === "saved_offline" && <em className="pill pill--waiting">Waiting</em>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
