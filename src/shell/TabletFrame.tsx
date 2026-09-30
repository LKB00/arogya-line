import { useEffect, useState, type ReactNode } from "react";
import StatusBar from "./StatusBar";

// The Pixel Tablet's art is 2798 x 1837 px with a 2560 x 1600 px screen: drawn
// at half size, the screen is its real 1280 x 800 dp. Room around it: the
// stage's padding and the demo bar.
const ART_W = 2798 / 2;
const ART_H = 1837 / 2;
const ROOM_W = 48;
const ROOM_H = 124;

/** Shrinks the tablet to fit the window, never enlarges it. */
function useFit(): number {
  const measure = () => Math.min(1, (window.innerWidth - ROOM_W) / ART_W, (window.innerHeight - ROOM_H) / ART_H);
  const [fit, setFit] = useState(measure);
  useEffect(() => {
    const onResize = () => setFit(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return fit;
}

// A real Pixel Tablet around the PHC dashboard (Google's device art) with
// Android's own status bar; a Wi-Fi-only device, so no signal glyph. On a
// window too narrow for a tablet (under 1024 px) the frame steps aside and the
// dashboard fills the page, as it does on a phone.
export default function TabletFrame({ children }: { children: ReactNode }) {
  const fit = useFit();
  return (
    <div className="tablet" style={{ ["--tablet-fit" as string]: fit }}>
      <div className="tablet__screen">
        <StatusBar className="tablet__status" cellular={false} />
        <div className="tablet__app">{children}</div>
        <div className="tablet__nav" aria-hidden="true" />
        <span className="tablet__glass" aria-hidden="true" />
      </div>
    </div>
  );
}
