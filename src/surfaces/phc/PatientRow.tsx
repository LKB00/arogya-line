// One dashboard row (SPEC 6.3 table). The Yes/No toggle writes through setVisitNeeded.

import { slotLabel, URGENCY_LABEL } from "../../app/format";
import { useStore } from "../../app/store";
import type { Booking } from "../../app/types";
import { patientMeta, patientName, reportedBy, type BookingRow } from "./rows";

/** Yes / No control shared by the row and AfterConsult. */
export function VisitNeededToggle({ booking }: { booking: Booking }) {
  const setVisitNeeded = useStore((s) => s.setVisitNeeded);
  const current = booking.visitNeeded;
  return (
    <span className="seg" role="group" aria-label="Visit needed">
      <button
        type="button"
        className="seg__btn"
        aria-pressed={current === true}
        onClick={() => setVisitNeeded(booking.id, true)}
      >
        Yes
      </button>
      <button
        type="button"
        className="seg__btn"
        aria-pressed={current === false}
        onClick={() => setVisitNeeded(booking.id, false)}
      >
        No
      </button>
    </span>
  );
}

type Props = {
  row: BookingRow;
  selected: boolean;
  onOpen: (bookingId: string) => void;
};

export default function PatientRow({ row, selected, onOpen }: Props) {
  const { booking, concern } = row;
  return (
    <tr className={selected ? "trow is-selected" : "trow"} aria-selected={selected}>
      <td className="cell cell--time">{slotLabel(booking.slot)}</td>
      <td className="cell">
        <span className="patient__name">{patientName(row)}</span>
        <span className="patient__meta">{patientMeta(row)}</span>
      </td>
      <td className="cell cell--muted">{reportedBy(row)}</td>
      <td className="cell cell--symptoms">
        {concern ? (
          <>
            <span className={`urgency urgency--inline urgency--${concern.urgency}`}>
              {URGENCY_LABEL[concern.urgency]}
            </span>
            <ul className="symptoms">
              {concern.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        ) : (
          <span className="cell--muted">No symptoms captured</span>
        )}
      </td>
      <td className="cell">
        <VisitNeededToggle booking={booking} />
      </td>
      <td className="cell cell--action">
        <button
          type="button"
          className="btn btn--compact btn--secondary"
          aria-expanded={selected}
          onClick={() => onOpen(booking.id)}
        >
          {booking.advice ? "Edit advice" : "Record advice"}
        </button>
        {booking.advice ? <span className="pill pill--sent">Advice saved</span> : null}
      </td>
    </tr>
  );
}
