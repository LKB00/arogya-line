// Doctor's after-consult panel (SPEC 6.3 AfterConsult). Opens from a row and
// renders directly beneath it.

import { useState } from "react";
import { dayLabel, slotLabel } from "../../app/format";
import { useStore } from "../../app/store";
import { VisitNeededToggle } from "./PatientRow";
import { patientMeta, patientName, type BookingRow } from "./rows";

type Props = {
  row: BookingRow;
  onClose: () => void;
};

export default function AfterConsult({ row, onClose }: Props) {
  const { booking } = row;
  const saveAdvice = useStore((s) => s.saveAdvice);
  const setFollowUpStatus = useStore((s) => s.setFollowUpStatus);
  const [text, setText] = useState(booking.advice ?? "");
  const canSave = text.trim().length > 0 && text !== booking.advice;
  const hasFollowUp = booking.followUpStatus !== undefined;

  return (
    <section className="consult" aria-labelledby="after-consult-heading">
      <header className="consult__header">
        <div>
          <p className="consult__eyebrow">After consult</p>
          <h2 id="after-consult-heading" className="consult__name">
            {patientName(row)}
          </h2>
          <p className="consult__meta">
            {patientMeta(row)} · {dayLabel(booking.date)}, {slotLabel(booking.slot)}
          </p>
        </div>
        <button type="button" className="closebtn" onClick={onClose} aria-label="Close panel" />
      </header>

      <div className="consult__grid">
        <div className="consult__block">
          <p className="consult__label">Visit needed</p>
          <VisitNeededToggle booking={booking} />
        </div>

        <div className="consult__block consult__block--advice">
          <label className="consult__label" htmlFor="advice-text">
            Advice for the family
            <span className="consult__hint"> · stands in for the 20-second voice note</span>
          </label>
          <textarea
            id="advice-text"
            className="textarea"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canSave}
            onClick={() => saveAdvice(booking.id, text.trim())}
          >
            Save advice
          </button>
        </div>

        <div className="consult__block">
          <p className="consult__label">Follow-up</p>
          <p className="consult__value">
            {booking.followUpDue
              ? `Due ${dayLabel(booking.followUpDue)} · ${booking.followUpStatus}`
              : "Set when advice is saved"}
          </p>
          <div className="consult__actions">
            <button
              type="button"
              className="btn btn--compact btn--secondary"
              disabled={!hasFollowUp}
              onClick={() => setFollowUpStatus(booking.id, "answered")}
            >
              Mark answered
            </button>
            <button
              type="button"
              className="btn btn--compact btn--secondary"
              disabled={!hasFollowUp}
              onClick={() => setFollowUpStatus(booking.id, "missed")}
            >
              Mark missed
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
