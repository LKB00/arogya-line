import type { ReactNode } from "react";

// Android device chrome around a surface: status bar, punch-hole camera and
// gesture nav. Decoration only — the readings are fixed, nothing here ticks or
// responds to state.
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone">
      <div className="phone__camera" aria-hidden="true" />
      <div className="phone__status" aria-hidden="true">
        <span className="phone__time">9:41</span>
        <span className="phone__indicators">
          <span className="phone__icon phone__icon--signal" />
          <span className="phone__icon phone__icon--wifi" />
          <span className="phone__battery" />
        </span>
      </div>
      <div className="phone__screen">{children}</div>
      <div className="phone__nav" aria-hidden="true">
        <span className="phone__handle" />
      </div>
    </div>
  );
}
