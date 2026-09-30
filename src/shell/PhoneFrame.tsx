import type { ReactNode } from "react";

// A real Pixel 8 around a surface (Google's device art) with Android's own
// status bar, and the gesture nav's space left empty. Decoration only: the readings are fixed and nothing here responds to state. `variant` lets one surface give the frame
// its own look without touching the one the other surfaces share.
export default function PhoneFrame({ children, variant }: { children: ReactNode; variant?: "asha" | "voice" }) {
  return (
    <div className="device">
      <div className={variant ? `phone phone--${variant}` : "phone"}>
        {/* Android's own status bar, not drawn for this demo: the glyphs are
            AOSP's (frameworks/base, core/res: ic_wifi_signal_4,
            ic_signal_cellular_4_4_bar and the battery meter paths from
            config.xml, Apache 2.0), at SystemUI's sizes (dimens.xml). */}
        <div className="phone__status" aria-hidden="true">
          <span className="phone__time">9:30</span>
          <span className="phone__icons">
            <svg className="sb-wifi" viewBox="0 0 24 24">
              <path d="M24,7.39L12,22L0,7.39C2.97,4.08,7.25,2,12,2S21.03,4.08,24,7.39z" />
            </svg>
            <svg className="sb-signal" viewBox="0 0 24 24">
              <path d="M22,2L2,22h20V2L22,2z" />
            </svg>
            <svg className="sb-battery" viewBox="0 0 12 20">
              <path fillRule="evenodd" d="M3.5,2 v0 H1.33 C0.6,2 0,2.6 0,3.33 V13v5.67 C0,19.4 0.6,20 1.33,20 h9.33 C11.4,20 12,19.4 12,18.67 V13V3.33 C12,2.6 11.4,2 10.67,2 H8.5 V0 H3.5 z M2,18v-7V4h8v9v5H2L2,18z" />
              <path className="sb-battery__empty" d="M2,18 v-14 h8 v14 z" />
              <path d="M2,18 v-11.2 h8 v11.2 z" />
            </svg>
          </span>
        </div>
        <div className="phone__screen">{children}</div>
        <div className="phone__nav" aria-hidden="true" />
        <span className="phone__glass" aria-hidden="true" />
      </div>
    </div>
  );
}
