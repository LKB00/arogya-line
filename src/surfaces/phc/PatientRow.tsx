// One row of the day's list (SPEC 6.3 table): time; who, and how they came;
// what was found, in the IMNCI chart's colours; visit needed; advice. The
// Yes/No toggle writes through setVisitNeeded.

import { IconCheck, IconNurse, IconPhone, IconWalk } from "@tabler/icons-react";
import { URGENCY_LABEL, slotLabel } from "../../app/format";
import { useStore } from "../../app/store";
import type { Booking } from "../../app/types";
import Icon from "../../shell/Icon";
import { patientMeta, patientName, reportedBy, type BookingRow } from "./rows";

/** How the booking reached the PHC, drawn: the ASHA, the phone line, the door. */
const SOURCE_ICON = { ASHA: IconNurse, "Voice line": IconPhone, "Walk-in": IconWalk } as const;

/** Yes / No, shared by the row and the panel. Neither is set until the doctor sets it. */
export function VisitNeededToggle({ booking }: { booking: Booking }) {
  const setVisitNeeded = useStore((s) => s.setVisitNeeded);
  const current = booking.visitNeeded;
  return (
    <span className="seg" role="group" aria-label="Visit needed">
      <button type="button" className="seg__btn" aria-pressed={current === true} onClick={() => setVisitNeeded(booking.id, true)}>
        Yes
      </button>
      <button type="button" className="seg__btn" aria-pressed={current === false} onClick={() => setVisitNeeded(booking.id, false)}>
        No
      </button>
    </span>
  );
}

type Props = { row: BookingRow; selected: boolean; onOpen: (bookingId: string) => void };

export default function PatientRow({ row, selected, onOpen }: Props) {
  const { booking, concern } = row;
  const source = reportedBy(row) as keyof typeof SOURCE_ICON;
  return (
    <tr className={selected ? "trow is-selected" : "trow"} aria-selected={selected}>
      <td className="cell cell--time">{slotLabel(booking.slot)}</td>
      <td className="cell">
        <span className="who__name">{patientName(row)}</span>
        <span className="who__meta">{patientMeta(row)}</span>
        <span className="who__source">
          <Icon icon={SOURCE_ICON[source] ?? IconWalk} size={16} />
          {source === "ASHA" ? "Booked by the ASHA" : source === "Voice line" ? "Booked on the voice line" : "Walk-in"}
        </span>
      </td>
      <td className="cell">
        {concern ? (
          <>
            <span className={`urgency-tag urgency--${concern.urgency}`}>{URGENCY_LABEL[concern.urgency]}</span>
            <span className="found">{concern.reasons.join(" · ")}</span>
          </>
        ) : (
          <span className="found found--none">Nothing recorded before the visit</span>
        )}
      </td>
      <td className="cell">
        <VisitNeededToggle booking={booking} />
      </td>
      <td className="cell cell--action">
        <button type="button" className="btn btn--compact btn--secondary" aria-expanded={selected} onClick={() => onOpen(booking.id)}>
          {booking.advice ? "Edit advice" : "Record advice"}
        </button>
        {booking.advice && (
          <span className="saved">
            <Icon icon={IconCheck} size={16} />
            Advice saved
          </span>
        )}
      </td>
    </tr>
  );
}
