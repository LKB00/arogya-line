// PHC dashboard (SPEC 6.3). Day/view/selected booking live in the URL query so
// browser back closes the panel. Only synced ("sent") bookings are visible here.

import { Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { dayLabel, longDate, URGENCY_LABEL } from "../../app/format";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import type { Booking, Urgency } from "../../app/types";
import PatientRow from "./PatientRow";
import { patientMeta, patientName, type BookingRow } from "./rows";
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
  const closeConsult = () => update({ consult: null });

  // The panel sits in the table, directly under the row it belongs to.
  const consultPanelBody = consultRow ? (
    <AfterConsult key={consultRow.booking.id} row={consultRow} onClose={closeConsult} />
  ) : null;
  const consultPanel = (columns: number) =>
    consultRow ? (
      <tr className="trow trow--consult">
        <td className="cell cell--consult" colSpan={columns}>
          {consultPanelBody}
        </td>
      </tr>
    ) : null;
  const inView = (view === "day" ? dayRows : followUpRows).some((r) => r.booking.id === consultId);

  return (
    <section className="phc">
      <header className="phc__header">
        <h1 className="phc__title">PHC Tumkur</h1>
        <p className="phc__sub">Dr. Ramesh</p>
      </header>

      <dl className="metrics" aria-label="Metrics">
        <div className="metric">
          <dt className="metric__label">Bookings pre-booked</dt>
          <dd className="metric__value">{percent(preBooked, sent.length)}</dd>
          <dd className="metric__detail">
            {preBooked} of {sent.length} visits
          </dd>
        </div>
        <div className="metric">
          <dt className="metric__label">Visits marked not needed</dt>
          <dd className="metric__value">{notNeeded}</dd>
          <dd className="metric__detail">of {sent.length} visits</dd>
        </div>
        <div className="metric">
          <dt className="metric__label">Follow-ups completed</dt>
          <dd className="metric__value">{percent(answered, withFollowUp.length)}</dd>
          <dd className="metric__detail">
            {answered} of {withFollowUp.length} follow-ups
          </dd>
        </div>
      </dl>

      <nav className="tabs" aria-label="View">
        <button
          type="button"
          className="tab"
          aria-pressed={view === "day"}
          onClick={() => update({ view: null })}
        >
          Day
        </button>
        <button
          type="button"
          className="tab"
          aria-pressed={view === "followups"}
          onClick={() => update({ view: "followups" })}
        >
          Follow-ups
          <span className="tab__count">{followUpRows.length}</span>
        </button>
      </nav>

      {view === "day" ? (
        <>
          <div className="toolbar">
            <div className="toolbar__day">
              <h2 className="toolbar__title">{dayLabel(day)}</h2>
              <p className="toolbar__sub">{longDate(day)}</p>
            </div>
            <ul className="counts" aria-label="Bookings by urgency">
              {counts.map((c) => (
                <li key={c.urgency} className={`urgency urgency--${c.urgency}`}>
                  {c.count} {URGENCY_LABEL[c.urgency].toLowerCase()}
                </li>
              ))}
            </ul>
            <label className="datefield">
              <span className="datefield__label">Change day</span>
              <input
                className="datefield__input"
                type="date"
                value={day}
                onChange={(e) => update({ day: e.target.value || null })}
              />
            </label>
          </div>

          {dayRows.length === 0 ? (
            <p className="empty">No bookings for this day.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="th th--time">Time</th>
                    <th className="th">Patient</th>
                    <th className="th">Reported by</th>
                    <th className="th th--symptoms">Symptoms captured</th>
                    <th className="th">Visit needed</th>
                    <th className="th th--action">After consult</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((row) => (
                    <Fragment key={row.booking.id}>
                      <PatientRow row={row} selected={row.booking.id === consultId} onOpen={openConsult} />
                      {row.booking.id === consultId ? consultPanel(6) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : followUpRows.length === 0 ? (
        <p className="empty">No follow-ups pending or missed.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="th">Patient</th>
                <th className="th">Consulted</th>
                <th className="th">Follow-up due</th>
                <th className="th">Status</th>
                <th className="th th--action">After consult</th>
              </tr>
            </thead>
            <tbody>
              {followUpRows.map((row) => {
                const selected = row.booking.id === consultId;
                const missed = row.booking.followUpStatus === "missed";
                return (
                  <Fragment key={row.booking.id}>
                    <tr className={selected ? "trow is-selected" : "trow"} aria-selected={selected}>
                      <td className="cell">
                        <span className="patient__name">{patientName(row)}</span>
                        <span className="patient__meta">{patientMeta(row)}</span>
                      </td>
                      <td className="cell cell--muted">{dayLabel(row.booking.date)}</td>
                      <td className="cell">{row.booking.followUpDue ? dayLabel(row.booking.followUpDue) : "—"}</td>
                      <td className="cell">
                        <span className={missed ? "pill pill--missed" : "pill pill--waiting"}>
                          {missed ? "Missed · ASHA visit requested" : "Pending"}
                        </span>
                      </td>
                      <td className="cell cell--action">
                        <button
                          type="button"
                          className="btn btn--compact btn--secondary"
                          aria-expanded={selected}
                          onClick={() => openConsult(row.booking.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                    {selected ? consultPanel(5) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected booking outside the visible table (other day or view): the panel still opens. */}
      {consultRow && !inView ? <div className="consult-standalone">{consultPanelBody}</div> : null}
      {consultId && !consultRow ? <p className="empty">That booking has not reached the PHC yet.</p> : null}
    </section>
  );
}
