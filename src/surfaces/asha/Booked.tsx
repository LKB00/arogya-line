// Confirmation with sync state and a local checklist (SPEC 6.1 Booked).
//
// End on the family: a calm confirmation, then a slip written to be shown to
// them (day and time largest, then place, doctor and the card to bring), the
// phone's sync state on the slip itself, and the things to tell them as a
// checklist she goes through with the screen turned towards them.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconBuildingHospital,
  IconCheck,
  IconCloudCheck,
  IconCloudOff,
  IconIdBadge2,
  IconStethoscope,
  IconX,
} from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { dayLabel, shortDate, slotLabel } from "../../app/format";
import Icon from "../../shell/Icon";
import SyncBanner from "./SyncBanner";

const CHECKLIST = [
  "The day and time, and to bring the family card",
  "Bring any medicines already being taken",
  "If it gets worse before the visit, call the doctor line",
];

export default function Booked() {
  const { bookingId = "" } = useParams();
  const booking = useStore((s) => s.bookings.find((b) => b.id === bookingId));
  const concern = useStore((s) => s.concerns.find((c) => c.id === booking?.concernId));
  const family = useStore((s) => s.families.find((f) => f.id === concern?.familyId));
  const member = family?.members.find((m) => m.id === concern?.memberId);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKLIST.map(() => false));

  if (!booking) {
    return (
      <section className="screen">
        <p className="screen__empty">Booking not found.</p>
        <Link className="btn btn--secondary" to="/asha">
          Back to today
        </Link>
      </section>
    );
  }

  const sent = booking.sync === "sent";
  const done = checked.filter(Boolean).length;

  return (
    <>
      <header className="appbar">
        <Link className="iconbtn" to="/asha" aria-label="Close and go back to today" title="Back to today">
          <Icon icon={IconX} size={24} />
        </Link>
        <span className="appbar__spacer" />
        <SyncBanner />
      </header>
      <section className="screen">
        <header className="done">
          <span className="done__mark">
            <Icon icon={IconCheck} size={32} />
          </span>
          <h1 className="done__title">Visit booked</h1>
          <p className="done__sub">
            {member?.name ?? "The patient"} sees {booking.doctor} {dayLabel(booking.date).toLowerCase()}
          </p>
        </header>

        <article className="slip">
          <p className="slip__when">
            <span>{shortDate(booking.date)}</span>
            <span>{slotLabel(booking.slot)}</span>
          </p>
          <ul className="slip__facts">
            <li>
              <Icon icon={IconBuildingHospital} />
              {booking.facility}
            </li>
            <li>
              <Icon icon={IconStethoscope} />
              {booking.doctor}
            </li>
            <li>
              <Icon icon={IconIdBadge2} />
              Bring family card {family?.id ?? ""}
            </li>
          </ul>
          <p className={sent ? "slip__sync is-sent" : "slip__sync"} role="status">
            <Icon icon={sent ? IconCloudCheck : IconCloudOff} />
            {sent ? "Sent to the PHC" : "Saved on this phone · sends when there's signal"}
          </p>
        </article>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">
              Tell the family
              <span className="block__aside">
                {done} of {CHECKLIST.length}
              </span>
            </h2>
            <p className="block__sub">Show them this screen as you go through it</p>
          </div>
          <ul className="listcard">
            {CHECKLIST.map((item, i) => (
              <li key={item}>
                <label className="tick">
                  <span className="tick__text">{item}</span>
                  <input
                    className="sr-input"
                    type="checkbox"
                    checked={checked[i]}
                    onChange={(e) => setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span className="tick__box">
                    <Icon icon={IconCheck} size={16} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <Link className="btn btn--primary btn--block btn--tall" to="/asha">
          Done
        </Link>
      </section>
    </>
  );
}
