// The guided walkthrough (SPEC 7). Off by default; ?guided=1 turns it on.
// It only suggests the order of the story: nothing here blocks or forces a
// click, and the visitor is free to wander off and come back.

import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type Step = { path: string; text: string };

/** Each step names the surface its Next control should land on. */
const STEPS: Step[] = [
  { path: "/asha", text: "ASHA app, offline: tap Check someone, choose family 4471, check Arjun's symptoms, book a PHC visit. Notice it says waiting to send." },
  { path: "/asha", text: "Turn the signal on with the toggle. Watch the booking sync." },
  { path: "/phc", text: "PHC dashboard: choose Tomorrow and open Arjun's booking. He is not here yet: use the demo button to say he has arrived, then save advice, answer whether it could have been handled without a visit, and choose the follow-up." },
  { path: "/voice", text: "Voice line: call, enter 4471, press 3. Hear the doctor's advice read back." },
  { path: "/phc", text: "Done. The figures at the foot of the dashboard moved. Reset to try again." },
];

export default function GuidedWalkthrough() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  // Read once, at mount: the surfaces navigate with their own query strings, so
  // ?guided=1 would be dropped the first time the visitor moves inside a
  // surface. Typing the address by hand reloads the page, which mounts again.
  const [guided] = useState(() => params.get("guided") === "1");

  // Put the parameter back whenever a navigation drops it, so the address bar
  // stays shareable and switching surfaces keeps the walkthrough on.
  useEffect(() => {
    if (!guided) return;
    const next = new URLSearchParams(location.search);
    if (next.get("guided") === "1") return;
    next.set("guided", "1");
    navigate({ pathname: location.pathname, search: `?${next}` }, { replace: true });
  }, [guided, location, navigate]);

  if (!guided) return null;

  // Only the flag travels: the query strings the surfaces use for their own
  // state belong to the screen that set them.
  function go(to: number) {
    setIndex(to);
    navigate({ pathname: STEPS[to].path, search: "?guided=1" });
  }

  const step = STEPS[index];

  return (
    <aside className="guide" aria-label="Guided walkthrough">
      <p className="guide__step">
        <span className="guide__count">
          Step {index + 1} of {STEPS.length}
        </span>
        <span>{step.text}</span>
      </p>
      <p className="guide__controls">
        <button
          type="button"
          className="btn btn--secondary guide__btn"
          onClick={() => go(index - 1)}
          disabled={index === 0}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn--secondary guide__btn"
          onClick={() => go(index + 1)}
          disabled={index === STEPS.length - 1}
        >
          Next
        </button>
      </p>
    </aside>
  );
}
