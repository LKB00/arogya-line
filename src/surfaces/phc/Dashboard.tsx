// PHC dashboard (SPEC 6.3). Day/view/selected booking live in the URL query so
// browser back closes the panel. Only synced ("sent") bookings are visible here.

import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import type { Booking, Urgency } from "../../app/types";
import PatientRow from "./PatientRow";
import { patientLabel, type BookingRow } from "./rows";
import AfterConsult from "./AfterConsult";

const URGENCY_ORDER: Record<Urgency, number> = { red: 0, amber: 1, green: 2 };
const URGENCIES: Urgency[] = ["red", "amber", "green"];

function percent(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 100)}%`;
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const day = params.get("day") ?? isoDate(1);
  const view = params.get("view") === "followups" ? "followups" : "day";
  const consultId = params.get("consult");

  const bookings = useStore((s) => s.bookings);
  const concerns = useStore((s) => s.concerns);
  const families = useStore((s) => s.families);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  const toRow = (booking: Booking): BookingRow => {
    const concern = concerns.find((c) => c.id === booking.concernId);
    const family = families.find((f) => f.id === concern?.familyId);
    const member = family?.members.find((m) => m.id === concern?.memberId);
    return { booking, concern, family, member };
  };

  // The PHC only knows about bookings that have reached it.
  const sent = bookings.filter((b) => b.sync === "sent");

  const dayRows = sent
    .filter((b) => b.date === day)
    .map(toRow)
    .sort((a, b) => {
      const ua = a.concern ? URGENCY_ORDER[a.concern.urgency] : 3;
      const ub = b.concern ? URGENCY_ORDER[b.concern.urgency] : 3;
      return ua - ub || a.booking.slot.localeCompare(b.booking.slot);
    });

  const counts = URGENCIES.map((u) => ({
    urgency: u,
    count: dayRows.filter((r) => r.concern?.urgency === u).length,
  }));

  const followUpRows = sent
    .filter((b) => b.followUpStatus === "pending" || b.followUpStatus === "missed")
    .map(toRow)
    .sort((a, b) => (a.booking.followUpDue ?? "").localeCompare(b.booking.followUpDue ?? ""));

  // Metrics strip: live from the store.
  const preBooked = sent.filter((b) => !b.walkIn).length;
  const notNeeded = sent.filter((b) => b.visitNeeded === false).length;
  const withFollowUp = sent.filter((b) => b.followUpStatus !== undefined);
  const answered = withFollowUp.filter((b) => b.followUpStatus === "answered").length;

  const consultRow = consultId ? sent.filter((b) => b.id === consultId).map(toRow)[0] : undefined;
  const openConsult = (id: string) => update({ consult: id });

  return (
    <section>
      <h1>PHC Tumkur · Dr. Ramesh</h1>

      <dl aria-label="Metrics">
        <dt>Bookings pre-booked</dt>
        <dd>
          {percent(preBooked, sent.length)} ({preBooked} of {sent.length})
        </dd>
        <dt>Visits marked not needed</dt>
        <dd>{notNeeded}</dd>
        <dt>Follow-ups completed</dt>
        <dd>
          {percent(answered, withFollowUp.length)} ({answered} of {withFollowUp.length})
        </dd>
      </dl>

      <nav aria-label="View">
        <button type="button" aria-pressed={view === "day"} onClick={() => update({ view: null })}>
          Day
        </button>{" "}
        <button type="button" aria-pressed={view === "followups"} onClick={() => update({ view: "followups" })}>
          Follow-ups ({followUpRows.length})
        </button>
      </nav>

      {view === "day" ? (
        <>
          <p>
            <label>
              Day{" "}
              <input type="date" value={day} onChange={(e) => update({ day: e.target.value || null })} />
            </label>{" "}
            {counts.map((c) => (
              <span key={c.urgency}>
                {c.urgency}: {c.count}{" "}
              </span>
            ))}
          </p>

          {dayRows.length === 0 ? (
            <p>No bookings for this day.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Reported by</th>
                  <th>Symptoms captured</th>
                  <th>Visit needed</th>
                  <th>After consult</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <PatientRow key={row.booking.id} row={row} onOpen={openConsult} />
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : followUpRows.length === 0 ? (
        <p>No follow-ups pending or missed.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Patient</th>
              <th>Consulted</th>
              <th>Follow-up due</th>
              <th>Status</th>
              <th>After consult</th>
            </tr>
          </thead>
          <tbody>
            {followUpRows.map((row) => (
              <tr key={row.booking.id}>
                <td>{patientLabel(row)}</td>
                <td>{row.booking.date}</td>
                <td>{row.booking.followUpDue}</td>
                <td>
                  {row.booking.followUpStatus}
                  {row.booking.followUpStatus === "missed" ? " · ASHA visit requested" : ""}
                </td>
                <td>
                  <button type="button" onClick={() => openConsult(row.booking.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {consultRow ? (
        <AfterConsult key={consultRow.booking.id} row={consultRow} onClose={() => update({ consult: null })} />
      ) : consultId ? (
        <p>That booking has not reached the PHC yet.</p>
      ) : null}
    </section>
  );
}
