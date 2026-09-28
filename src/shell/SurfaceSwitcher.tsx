import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { IconChevronDown } from "@tabler/icons-react";
import Icon from "./Icon";
import ConnectivityToggle from "./ConnectivityToggle";
import GuidedWalkthrough from "./GuidedWalkthrough";
import ScenarioReset from "./ScenarioReset";

/** Full names on a laptop; short ones on a phone, where the bar is one row. */
const surfaces = [
  { to: "/asha", label: "ASHA app", short: "ASHA" },
  { to: "/voice", label: "Voice line", short: "Voice" },
  { to: "/phc", label: "PHC dashboard", short: "PHC" },
] as const;

export default function SurfaceSwitcher() {
  // On a phone the controls fold behind one "Demo" button, so the product
  // gets the screen; on a laptop they are always shown and this does nothing.
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = surfaces.find((s) => pathname.startsWith(s.to)) ?? surfaces[0];

  return (
    <div className="demo">
      <header className={open ? "demo__bar is-open" : "demo__bar"}>
        <span className="demo__brand">Arogya Line</span>
        <button type="button" className="demo__toggle" aria-expanded={open} aria-controls="demo-controls" onClick={() => setOpen((v) => !v)}>
          <span className="demo__toggle-label">Demo</span>
          <span>{current.label}</span>
          <Icon icon={IconChevronDown} size={16} className="demo__chevron" />
        </button>
        <div className="demo__panel" id="demo-controls">
          <nav className="demo__nav" aria-label="Surface">
            {surfaces.map((s) => (
              <NavLink key={s.to} to={s.to} className="demo__tab" onClick={() => setOpen(false)}>
                <span className="demo__long">{s.label}</span>
                <span className="demo__short">{s.short}</span>
              </NavLink>
            ))}
          </nav>
          <div className="demo__controls">
            <ConnectivityToggle />
            <ScenarioReset />
          </div>
        </div>
      </header>
      <GuidedWalkthrough />
      <main className="stage">
        <Outlet />
      </main>
      <footer className="demo__footer">
        <p>Concept prototype. Illustrative triage questions, not clinical guidance. No real data.</p>
      </footer>
    </div>
  );
}
