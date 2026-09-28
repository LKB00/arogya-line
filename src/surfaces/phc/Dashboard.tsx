// PHC dashboard (SPEC 6.3). Day, view and the selected booking live in the URL
// so browser back closes the panel. Only synced ("sent") bookings are shown.
//
// A Material 3 list–detail layout: a navigation rail for the two views, the
// outcomes across the top, the day's list, and the after-consult panel as a
// side sheet beside the list, so the list never moves while the doctor writes.

import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { IconBuildingHospital, IconCalendarEvent, IconPhoneCall, IconStethoscope, IconX } from "@tabler/icons-react";
import { URGENCY_LABEL, dayLabel, longDate } from "../../app/format";
import { useStore } from "../../app/store";
import { PHC, isoDate } from "../../app/seed";
import type { Urgency } from "../../app/types";
import Icon from "../../shell/Icon";
import AfterConsult from "./AfterConsult";
import FollowUpRow from "./FollowUpRow";
import PatientRow from "./PatientRow";
import { dayFromParam, dayRows, followUpRows, metrics, percent, sent, toRow } from "./selectors";

const URGENCIES: Urgency[] = ["red", "amber", "green"];

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
  const m = metrics(bookings);
  const counts = URGENCIES.map((u) => ({ urgency: u, count: rows.filter((r) => r.concern?.urgency === u).length }));

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
            <label className="datefield">
              <Icon icon={IconCalendarEvent} className="datefield__icon" />
              <span className="visually-hidden">Change day</span>
              <input className="datefield__input" type="date" value={day} onChange={(e) => update({ day: e.target.value || null })} />
            </label>
          )}
        </header>

        {/* The outcome of the whole loop, in three figures. */}
        <dl className="metrics" aria-label="Outcomes">
          <div className="metric">
            <dt className="metric__label">Visits booked ahead</dt>
            <dd className="metric__value">{percent(m.preBooked, m.total)}</dd>
            <dd className="metric__detail">
              {m.preBooked} of {m.total} came through the ASHA or the line
            </dd>
          </div>
          <div className="metric">
            <dt className="metric__label">Visits not needed</dt>
            <dd className="metric__value">{m.notNeeded}</dd>
            <dd className="metric__detail">Advice given instead of a trip</dd>
          </div>
          <div className="metric">
            <dt className="metric__label">Follow-ups answered</dt>
            <dd className="metric__value">{percent(m.answered, m.followUps)}</dd>
            <dd className="metric__detail">
              {m.answered} of {m.followUps} so far
            </dd>
          </div>
        </dl>

        {view === "day" ? (
          <section className="phc__list">
            <div className="phc__listhead">
              <h2 className="phc__h2">
                {rows.length} {rows.length === 1 ? "booking" : "bookings"} {dayWords(day)}
              </h2>
              {rows.length > 0 && (
                <ul className="counts" aria-label="By urgency">
                  {counts.map((c) => (
                    <li key={c.urgency} className={c.count ? `count urgency--${c.urgency}` : "count count--zero"}>
                      <b>{c.count}</b> {URGENCY_LABEL[c.urgency].toLowerCase()}
                    </li>
                  ))}
                </ul>
              )}
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
                      <th className="th th--need">Visit needed</th>
                      <th className="th th--action">
                        <span className="visually-hidden">Advice</span>
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
                  <span className="phc__empty-sub">A follow-up is set the day after a visit, when you save advice.</span>
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
