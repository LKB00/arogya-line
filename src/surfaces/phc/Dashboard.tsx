// PHC dashboard (SPEC 6.3). Day, view and the selected booking live in the URL
// so browser back closes the panel. Only synced ("sent") bookings are shown.
//
// A Material 3 list–detail layout: a navigation rail for the two views, the
// day's workload across the top, the day's list, and the after-consult panel as
// a side sheet beside the list, so the list never moves while the doctor
// writes. How the loop is doing (outcomes) is reporting, so it sits below.

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { IconBuildingHospital, IconCalendarEvent, IconPhoneCall, IconStethoscope, IconX } from "@tabler/icons-react";
import { dayLabel, longDate } from "../../app/format";
import { useStore } from "../../app/store";
import { PHC, isoDate } from "../../app/seed";
import Icon from "../../shell/Icon";
import AfterConsult from "./AfterConsult";
import FollowUpRow from "./FollowUpRow";
import PatientRow from "./PatientRow";
import { dayFromParam, dayRows, followUpRows, outcomes, percent, sent, toRow, workload } from "./selectors";

/** "today", "tomorrow", "yesterday", or "on Wed 30 Sep". */
function dayWords(day: string): string {
  const label = dayLabel(day);
  return ["Today", "Tomorrow", "Yesterday"].includes(label) ? label.toLowerCase() : `for ${label}`;
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams();
  const day = dayFromParam(params.get("day"));
  const view = params.get("view") === "followups" ? "followups" : "day";
  const consultId = params.get("consult");

  const bookings = useStore((s) => s.bookings);
  const concerns = useStore((s) => s.concerns);
  const families = useStore((s) => s.families);
  const today = isoDate(0);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  const rows = dayRows(bookings, concerns, families, day);
  const followUps = followUpRows(bookings, concerns, families);
  const w = workload(rows, bookings, today);
  const o = outcomes(bookings);

  const consultBooking = consultId ? sent(bookings).find((b) => b.id === consultId) : undefined;
  const consultRow = consultBooking ? toRow(consultBooking, concerns, families) : undefined;
  const closeConsult = () => update({ consult: null });

  // Escape closes the panel, as it closes any side sheet.
  useEffect(() => {
    if (!consultId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const next = new URLSearchParams(window.location.search);
        next.delete("consult");
        setParams(next);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [consultId, setParams]);

  return (
    <section className={consultId ? "phc has-sheet" : "phc"}>
      <nav className="rail" aria-label="Views">
        <span className="rail__brand" title={PHC.facility}>
          <Icon icon={IconBuildingHospital} size={24} />
        </span>
        {/* Icon-only: the page title already names the view. The name stays
            for screen readers and as a tooltip. */}
        <button type="button" className="rail__item" aria-pressed={view === "day"} aria-label="Day" title="Day" onClick={() => update({ view: null })}>
          <span className="rail__pill">
            <Icon icon={IconCalendarEvent} size={24} />
          </span>
        </button>
        <button
          type="button"
          className="rail__item"
          aria-pressed={view === "followups"}
          aria-label={`Follow-ups, ${followUps.length} open`}
          title="Follow-ups"
          onClick={() => update({ view: "followups" })}
        >
          <span className="rail__pill">
            <Icon icon={IconPhoneCall} size={24} />
            {followUps.length > 0 && (
              <span className="rail__badge" aria-hidden="true">
                {followUps.length}
              </span>
            )}
          </span>
        </button>
        <span className="rail__me" title={`Signed in as ${PHC.doctor}`}>
          <Icon icon={IconStethoscope} />
          <span className="visually-hidden">Signed in as {PHC.doctor}</span>
        </span>
      </nav>

      <main className="phc__main">
        <header className="phc__head">
          <div>
            <p className="phc__eyebrow">
              {PHC.doctor} · {PHC.facility}
            </p>
            <h1 className="phc__title">{view === "day" ? longDate(day) : "Follow-ups"}</h1>
          </div>
          {view === "day" && (
            <div className="dayswitch">
              {/* Today first: what the doctor opens the dashboard for. */}
              <span className="seg" role="group" aria-label="Day">
                <button type="button" className="seg__btn" aria-pressed={day === today} onClick={() => update({ day: null })}>
                  Today
                </button>
                <button type="button" className="seg__btn" aria-pressed={day === isoDate(1)} onClick={() => update({ day: isoDate(1) })}>
                  Tomorrow
                </button>
              </span>
            <label className="datefield">
              <Icon icon={IconCalendarEvent} className="datefield__icon" />
              <span className="visually-hidden">Change day</span>
              <input className="datefield__input" type="date" value={day} onChange={(e) => update({ day: e.target.value || null })} />
            </label>
            </div>
          )}
        </header>

        {/* What needs the doctor: the day's patients, and the follow-ups due now. */}
        {view === "day" && (
          <dl className="metrics" aria-label="Workload">
            <div className="metric">
              <dt className="metric__label">Patients</dt>
              <dd className="metric__value">{w.patients}</dd>
              <dd className="metric__detail">Booked {dayWords(day)}</dd>
            </div>
            <div className="metric">
              <dt className="metric__label">Urgent</dt>
              <dd className={w.urgent ? "metric__value urgency--red" : "metric__value"}>{w.urgent}</dd>
              <dd className="metric__detail">Danger sign found</dd>
            </div>
            <div className="metric">
              <dt className="metric__label">Advice to record</dt>
              <dd className="metric__value">{w.toRecord}</dd>
              <dd className="metric__detail">
                {w.patients === 0 ? "No patients yet" : `Of ${w.patients} ${w.patients === 1 ? "patient" : "patients"}`}
              </dd>
            </div>
            <div className="metric">
              <dt className="metric__label">Follow-ups due</dt>
              <dd className="metric__value">{w.followUpsDue}</dd>
              <dd className="metric__detail">{w.missed > 0 ? `Today · ${w.missed} missed` : "Today"}</dd>
            </div>
          </dl>
        )}

        {view === "day" ? (
          <section className="phc__list">
            <div className="phc__listhead">
              {/* The count and the urgent figure are in the workload above;
                  urgent rows are marked in the list itself. */}
              <h2 className="phc__h2">Bookings by time</h2>
            </div>
            {rows.length === 0 ? (
              <p className="phc__empty">
                <Icon icon={IconCalendarEvent} size={24} />
                <span>
                  No bookings have reached the PHC {dayWords(day)}.
                  <span className="phc__empty-sub">Bookings made offline appear once the ASHA's phone has signal.</span>
                </span>
              </p>
            ) : (
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th th--time">Time</th>
                      <th className="th">Patient</th>
                      <th className="th">What was found</th>
                      <th className="th th--action">
                        <span className="visually-hidden">Consult</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <PatientRow key={row.booking.id} row={row} selected={row.booking.id === consultId} onOpen={(id) => update({ consult: id })} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section className="phc__list">
            <div className="phc__listhead">
              <h2 className="phc__h2">
                {followUps.length} open {followUps.length === 1 ? "follow-up" : "follow-ups"}
              </h2>
            </div>
            {followUps.length === 0 ? (
              <p className="phc__empty">
                <Icon icon={IconPhoneCall} size={24} />
                <span>
                  No follow-ups are waiting.
                  <span className="phc__empty-sub">A follow-up call is set from a patient's after-consult panel.</span>
                </span>
              </p>
            ) : (
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Patient</th>
                      <th className="th">Seen</th>
                      <th className="th">Follow-up</th>
                      <th className="th">Status</th>
                      <th className="th th--action">
                        <span className="visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUps.map((row) => (
                      <FollowUpRow key={row.booking.id} row={row} today={today} selected={row.booking.id === consultId} onOpen={(id) => update({ consult: id })} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Reporting, not workload: how the whole loop is doing. Every
            booking to date, not the day on screen, and the heading says so. */}
        <section className="outcomes" aria-labelledby="outcomes-heading">
          <h2 id="outcomes-heading" className="outcomes__title">
            Across the service, to date
          </h2>
          <dl className="outcomes__list">
            <div className="outcome">
              <dt className="outcome__label">Visits booked ahead</dt>
              <dd className="outcome__value">{percent(o.preBooked, o.total)}</dd>
              <dd className="outcome__detail">
                {o.preBooked} of {o.total} came through the ASHA or the line
              </dd>
            </div>
            <div className="outcome">
              <dt className="outcome__label">Could have been handled without a visit</dt>
              <dd className="outcome__value">{o.avoidable}</dd>
              <dd className="outcome__detail">Advice could have replaced the trip</dd>
            </div>
            <div className="outcome">
              <dt className="outcome__label">Follow-ups answered</dt>
              <dd className="outcome__value">{percent(o.answered, o.followUps)}</dd>
              <dd className="outcome__detail">
                {o.answered} of {o.followUps} so far
              </dd>
            </div>
          </dl>
        </section>
      </main>

      {consultRow ? (
        <AfterConsult key={consultRow.booking.id} row={consultRow} today={today} onClose={closeConsult} />
      ) : consultId ? (
        <aside className="sheet sheet--missing" aria-label="After consult">
          <button type="button" className="iconbtn sheet__close" onClick={closeConsult} aria-label="Close the panel">
            <Icon icon={IconX} size={24} />
          </button>
          <p className="phc__empty-sub">That booking has not reached the PHC yet. It appears once the ASHA's phone has signal.</p>
        </aside>
      ) : null}
    </section>
  );
}
