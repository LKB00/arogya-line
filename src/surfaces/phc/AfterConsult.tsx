// Doctor's after-consult panel (SPEC 6.3 AfterConsult), as a side sheet beside
// the list. Everything the doctor needs for this one patient, in the order it
// is done: what was found, whether it could have been handled without a visit,
// the advice (read back to the family on the voice line), then whether and
// when to call the family again.

import { useState } from "react";
import { IconCheck, IconNurse, IconPhoneCall, IconVolume, IconX } from "@tabler/icons-react";
import { URGENCY_LABEL, dayLabel, slotLabel } from "../../app/format";
import { useStore } from "../../app/store";
import Icon from "../../shell/Icon";
import { addDays } from "../../app/seed";
import { AvoidableToggle } from "./PatientRow";
import { followUpState } from "./selectors";
import { patientMeta, patientName, reportedBy, type BookingRow } from "./rows";

type Props = { row: BookingRow; today: string; onClose: () => void };

/** When to call the family again: a decision, not a default. Days after the visit. */
const FOLLOW_UP_CHOICES = [
  { days: null, label: "None" },
  { days: 1, label: "Next day" },
  { days: 3, label: "In 3 days" },
  { days: 7, label: "In a week" },
] as const;

const FOLLOW_UP_WORDS = {
  pending: "Pending",
  overdue: "Overdue",
  missed: "Missed · the ASHA has been asked to visit",
  answered: "Answered",
  none: "",
} as const;

export default function AfterConsult({ row, today, onClose }: Props) {
  const { booking, concern } = row;
  const saveAdvice = useStore((s) => s.saveAdvice);
  const setFollowUpStatus = useStore((s) => s.setFollowUpStatus);
  const setFollowUp = useStore((s) => s.setFollowUp);
  const [text, setText] = useState(booking.advice ?? "");
  const trimmed = text.trim();
  const unchanged = trimmed === (booking.advice ?? "");
  const canSave = trimmed.length > 0 && !unchanged;
  const state = followUpState(booking, today);
  const hasFollowUp = state !== "none";

  return (
    <aside className="sheet" aria-labelledby="after-consult-heading">
      <header className="sheet__head">
        <div className="sheet__who">
          <p className="sheet__eyebrow">After consult</p>
          <h2 id="after-consult-heading" className="sheet__name">
            {patientName(row)}
          </h2>
          <p className="sheet__meta">
            {patientMeta(row)} · {dayLabel(booking.date)}, {slotLabel(booking.slot)}
          </p>
        </div>
        <button type="button" className="iconbtn" onClick={onClose} aria-label="Close the panel (Escape)" title="Close (Escape)">
          <Icon icon={IconX} size={24} />
        </button>
      </header>

      <section className="sheet__block">
        <h3 className="sheet__label">What was found</h3>
        {concern ? (
          <>
            <span className={`urgency-tag urgency--${concern.urgency}`}>{URGENCY_LABEL[concern.urgency]}</span>
            <ul className="sheet__found">
              {concern.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="sheet__source">
              <Icon icon={reportedBy(row) === "Voice line" ? IconPhoneCall : IconNurse} size={16} />
              {reportedBy(row) === "Voice line" ? "Answered by the family on the voice line" : "Checked by the ASHA at home"}
            </p>
          </>
        ) : (
          <p className="sheet__none">Nothing was recorded before this visit.</p>
        )}
      </section>

      <section className="sheet__block">
        <h3 className="sheet__label">Could this have been handled without a visit?</h3>
        <AvoidableToggle booking={booking} />
        {booking.avoidable === undefined && (
          <p className="sheet__hint">Not set yet. A “Yes” counts towards visits that advice could have replaced.</p>
        )}
      </section>

      <section className="sheet__block">
        <label className="sheet__label" htmlFor="advice-text">
          Advice for the family
        </label>
        <textarea
          id="advice-text"
          className="textarea"
          rows={5}
          value={text}
          placeholder="What the family should do, in the words you would say to them"
          onChange={(e) => setText(e.target.value)}
        />
        <p className="sheet__hint">
          <Icon icon={IconVolume} size={16} />
          Read to the family on the voice line when they press 3. Stands in for a 20-second voice note.
        </p>
        <div className="sheet__actions">
          <button type="button" className="btn btn--primary" disabled={!canSave} onClick={() => saveAdvice(booking.id, trimmed)}>
            <Icon icon={IconCheck} />
            {booking.advice ? "Save changes" : "Save advice"}
          </button>
          {booking.advice && unchanged && (
            <span className="saved">
              <Icon icon={IconCheck} size={16} />
              Saved
            </span>
          )}
        </div>
      </section>

      <section className="sheet__block">
        <h3 className="sheet__label">Follow-up call</h3>
        <span className="seg" role="group" aria-label="Follow-up call">
          {FOLLOW_UP_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              className="seg__btn"
              aria-pressed={c.days === null ? !hasFollowUp : booking.followUpDue === addDays(booking.date, c.days)}
              onClick={() => setFollowUp(booking.id, c.days)}
            >
              {c.label}
            </button>
          ))}
        </span>
        {hasFollowUp ? (
          <>
            <p className="sheet__value">
              {booking.followUpDue && dayLabel(booking.followUpDue)} · <span className={`status status--${state}`}>{FOLLOW_UP_WORDS[state]}</span>
            </p>
            <div className="sheet__actions">
              <button type="button" className="btn btn--compact btn--secondary" aria-pressed={booking.followUpStatus === "answered"} onClick={() => setFollowUpStatus(booking.id, "answered")}>
                Mark answered
              </button>
              <button type="button" className="btn btn--compact btn--secondary" aria-pressed={booking.followUpStatus === "missed"} onClick={() => setFollowUpStatus(booking.id, "missed")}>
                Mark missed
              </button>
            </div>
          </>
        ) : (
          <p className="sheet__hint">No call planned. Choose a day if the family should be checked on.</p>
        )}
      </section>
    </aside>
  );
}
