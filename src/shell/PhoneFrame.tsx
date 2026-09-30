import type { ReactNode } from "react";

// An Android screen as a design frame: the status bar's and gesture nav's
// spaces (left empty) around a surface, no drawn handset. Decoration only;
// nothing here responds to state. `variant` lets one surface give the frame
// its own look without touching the one the other surfaces share.
export default function PhoneFrame({ children, variant }: { children: ReactNode; variant?: "asha" | "voice" }) {
  return (
    <div className={variant ? `phone phone--${variant}` : "phone"}>
      {/* The system bars' spaces, kept empty: the system draws them, not us. */}
      <div className="phone__status" aria-hidden="true" />
      <div className="phone__screen">{children}</div>
      <div className="phone__nav" aria-hidden="true" />
    </div>
  );
}
