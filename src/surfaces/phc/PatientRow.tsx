// One dashboard row (SPEC 6.3 table). The Yes/No toggle writes through setVisitNeeded.

import { useStore } from "../../app/store";
import type { Booking } from "../../app/types";
import { patientLabel, reportedBy, type BookingRow } from "./rows";

/** Yes / No control shared by the row and AfterConsult. */
export function VisitNeededToggle({ booking }: { booking: Booking }) {
  const setVisitNeeded = useStore((s) => s.setVisitNeeded);
  const current = booking.visitNeeded;
  return (
    <span role="group" aria-label="Visit needed">
      <button type="button" aria-pressed={current === true} onClick={() => setVisitNeeded(booking.id, true)}>
        Yes
      </button>{" "}
      <button type="button" aria-pressed={current === false} onClick={() => setVisitNeeded(booking.id, false)}>
        No
      </button>{" "}
      <small>{current === undefined ? "not set" : current ? "yes" : "no"}</small>
    </span>
  );
}

type Props = {
  row: BookingRow;
  onOpen: (bookingId: string) => void;
};

export default function PatientRow({ row, onOpen }: Props) {
  const { booking, concern } = row;
  return (
    <tr>
      <td>{booking.slot}</td>
      <td>{patientLabel(row)}</td>
      <td>{reportedBy(row)}</td>
      <td>
        {concern ? `[${concern.urgency}] ${concern.reasons.join("; ")}` : "—"}
      </td>
      <td>
        <VisitNeededToggle booking={booking} />
      </td>
      <td>
        <button type="button" onClick={() => onOpen(booking.id)}>
          Open
        </button>{" "}
        {booking.advice ? <small>advice saved</small> : null}
      </td>
    </tr>
  );
}
