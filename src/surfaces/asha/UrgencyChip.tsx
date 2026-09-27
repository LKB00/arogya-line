// Urgency, said three ways at once: the IMNCI chart's colour, an icon and the
// word. Filled for a verdict; soft ("tonal") where it sits inside a card.

import { IconAlertTriangle, IconHomeHeart, IconStethoscope } from "@tabler/icons-react";
import { URGENCY_LABEL } from "../../app/format";
import type { Urgency } from "../../app/types";
import Icon from "../../shell/Icon";

const ICON = { red: IconAlertTriangle, amber: IconStethoscope, green: IconHomeHeart } as const;

export default function UrgencyChip({ urgency, tonal = false }: { urgency: Urgency; tonal?: boolean }) {
  return (
    <span className={`chip tri--${urgency}${tonal ? " chip--tonal" : ""}`}>
      <Icon icon={ICON[urgency]} size={16} />
      {URGENCY_LABEL[urgency]}
    </span>
  );
}
