// One open follow-up (SPEC 6.3 Follow-ups). A pending call whose day has
// passed reads "Overdue"; a missed one needs the doctor's decision until the
// ASHA has been asked to follow up.

import { dayLabel } from "../../app/format";
import { followUpState } from "./selectors";
import { patientMeta, patientName, type BookingRow } from "./rows";

const STATUS = {
  pending: { label: "Pending", tone: "pending" },
  overdue: { label: "Overdue", tone: "overdue" },
  missed: { label: "Missed · needs a decision", tone: "missed" },
  handed: { label: "Missed · ASHA asked to follow up", tone: "pending" },
  answered: { label: "Answered", tone: "answered" },
  none: { label: "—", tone: "pending" },
} as const;

type Props = { row: BookingRow; today: string; selected: boolean; onOpen: (bookingId: string) => void };

export default function FollowUpRow({ row, today, selected, onOpen }: Props) {
  const { booking } = row;
  const status = STATUS[followUpState(booking, today)];
  return (
    <tr className={selected ? "trow is-selected" : "trow"} aria-selected={selected}>
      <td className="cell">
        <span className="who__name">{patientName(row)}</span>
        <span className="who__meta">{patientMeta(row)}</span>
      </td>
      <td className="cell cell--muted">{dayLabel(booking.date)}</td>
      <td className="cell">{booking.followUpDue ? dayLabel(booking.followUpDue) : "—"}</td>
      <td className="cell">
        <span className={`status status--${status.tone}`}>{status.label}</span>
      </td>
      <td className="cell cell--action">
        <button type="button" className="btn btn--compact btn--secondary" aria-expanded={selected} onClick={() => onOpen(booking.id)}>
          Open
        </button>
      </td>
    </tr>
  );
}
