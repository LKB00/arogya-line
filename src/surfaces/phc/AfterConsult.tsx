// Doctor's after-consult panel (SPEC 6.3 AfterConsult). Opens from a row.

import { useState } from "react";
import { useStore } from "../../app/store";
import { VisitNeededToggle } from "./PatientRow";
import { patientLabel, type BookingRow } from "./rows";

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
    <section aria-labelledby="after-consult-heading">
      <h2 id="after-consult-heading">After consult</h2>
      <p>
        {patientLabel(row)} · {booking.date}, {booking.slot}
      </p>

      <p>
        Visit needed: <VisitNeededToggle booking={booking} />
      </p>

      <p>
        <label>
          Advice for the family (stands in for the 20-second voice note)
          <br />
          <textarea rows={3} cols={60} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </p>
      <p>
        <button type="button" disabled={!canSave} onClick={() => saveAdvice(booking.id, text.trim())}>
          Save advice
        </button>
      </p>

      <p>
        Follow-up: {booking.followUpDue ? `due ${booking.followUpDue}, ${booking.followUpStatus}` : "not scheduled yet"}
      </p>
      <p>
        <button
          type="button"
          disabled={!hasFollowUp}
          onClick={() => setFollowUpStatus(booking.id, "answered")}
        >
          Follow-up answered
        </button>{" "}
        <button type="button" disabled={!hasFollowUp} onClick={() => setFollowUpStatus(booking.id, "missed")}>
          Follow-up missed
        </button>
      </p>

      <p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </p>
    </section>
  );
}
