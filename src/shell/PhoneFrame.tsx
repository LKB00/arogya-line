import type { ReactNode } from "react";
import { IconBattery3, IconCellSignal4, IconWifi } from "@tabler/icons-react";
import Icon from "./Icon";

// Android device chrome around a surface: status bar, punch-hole camera and
// gesture nav. Decoration only — the readings are fixed, nothing here ticks or
// responds to state. `variant` lets one surface give the device its own look
// without touching the frame the other surfaces share.
export default function PhoneFrame({ children, variant }: { children: ReactNode; variant?: "asha" | "voice" }) {
  return (
    <div className={variant ? `phone phone--${variant}` : "phone"}>
      <div className="phone__camera" aria-hidden="true" />
      <div className="phone__status" aria-hidden="true">
        <span className="phone__time">9:41</span>
        <span className="phone__indicators">
          <Icon icon={IconCellSignal4} size={16} />
          <Icon icon={IconWifi} size={16} />
          <Icon icon={IconBattery3} size={20} />
        </span>
      </div>
      <div className="phone__screen">{children}</div>
      <div className="phone__nav" aria-hidden="true">
        <span className="phone__handle" />
      </div>
    </div>
  );
}
