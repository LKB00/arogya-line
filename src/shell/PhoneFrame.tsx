import type { ReactNode } from "react";
import StatusBar from "./StatusBar";

// A real Pixel 8 around a surface (Google's device art) with Android's own
// status bar, and the gesture nav's space left empty. Decoration only: nothing
// here responds to state. `variant` lets one surface give the frame its own
// look without touching the one the other surfaces share.
export default function PhoneFrame({ children, variant }: { children: ReactNode; variant?: "asha" | "voice" }) {
  return (
    <div className="device">
      <div className={variant ? `phone phone--${variant}` : "phone"}>
        <StatusBar className="phone__status" />
        <div className="phone__screen">{children}</div>
        <div className="phone__nav" aria-hidden="true" />
        <span className="phone__glass" aria-hidden="true" />
      </div>
    </div>
  );
}
