// One row of the day's list (SPEC 6.3 table): time; who, and how they came;
// what was found, in the IMNCI chart's colours; the consult. Nothing decided
// after the consult (could it have been handled without a visit, advice,
// follow-up) is answered from the list: that needs the patient seen first, so
// it lives in the after-consult sheet. The row only says whether it is done.

import { IconCheck, IconNurse, IconPhone, IconWalk } from "@tabler/icons-react";
import { URGENCY_LABEL, slotLabel } from "../../app/format";
import { useStore } from "../../app/store";
import type { Booking } from "../../app/types";
import Icon from "../../shell/Icon";
import { patientMeta, patientName, reportedBy, type BookingRow } from "./rows";
import { consultState, type ConsultState } from "./selectors";

/** The row's one action, by where the booking stands: nobody consults tomorrow's patient today. */
const ACTION: Record<ConsultState, string> = {
  future: "View booking",
  today: "Start consult",
  overdue: "Complete consult",
  done: "Open consult",
};

/** How the booking reached the PHC, drawn: the ASHA, the phone line, the door. */
const SOURCE_ICON = { ASHA: IconNurse, "Voice line": IconPhone, "Walk-in": IconWalk } as const;

/**
 * "Could this have been handled without a visit?" Yes / No, shared by the row
 * and the panel. Neither is set until the doctor sets it.
 */
export function AvoidableToggle({ booking }: { booking: Booking }) {
  const setAvoidable = useStore((s) => s.setAvoidable);
  const current = booking.avoidable;
  return (
    <span className="seg" role="group" aria-label="Could this have been handled without a visit?">
      <button type="button" className="seg__btn" aria-pressed={current === true} onClick={() => setAvoidable(booking.id, true)}>
        Yes
      </button>
      <button type="button" className="seg__btn" aria-pressed={current === false} onClick={() => setAvoidable(booking.id, false)}>
        No
      </button>
    </span>
  );
}

type Props = { row: BookingRow; today: string; selected: boolean; onOpen: (bookingId: string) => void };

export default function PatientRow({ row, today, selected, onOpen }: Props) {
  const { booking, concern } = row;
  const source = reportedBy(row) as keyof typeof SOURCE_ICON;
  return (
    <tr
      className={["trow", concern?.urgency === "red" && "trow--urgent", selected && "is-selected"].filter(Boolean).join(" ")}
      aria-selected={selected}
    >
      <td className="cell cell--time">{slotLabel(booking.slot)}</td>
      <td className="cell cell--who">
        <span className="who__name">{patientName(row)}</span>
        <span className="who__meta">{patientMeta(row)}</span>
        <span className="who__source">
          <Icon icon={SOURCE_ICON[source] ?? IconWalk} size={16} />
          {booking.emergency
            ? "Emergency, coming now"
            : source === "ASHA"
              ? "Booked by the ASHA"
              : source === "Voice line"
                ? "Booked on the voice line"
                : "Walk-in"}
        </span>
      </td>
      <td className="cell cell--found">
        {concern ? (
          <>
            <span className={`urgency-tag urgency--${concern.urgency}`}>{URGENCY_LABEL[concern.urgency]}</span>
            <span className="found">{concern.reasons.join(" · ")}</span>
          </>
        ) : (
          <span className="found found--none">Nothing recorded before the visit</span>
        )}
      </td>
      <td className="cell cell--action">
        <button type="button" className="btn btn--compact btn--secondary" aria-expanded={selected} onClick={() => onOpen(booking.id)}>
          {ACTION[consultState(booking, today)]}
        </button>
        {/* The action already says whether it has happened; done says so. */}
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
