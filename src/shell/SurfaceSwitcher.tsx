import { NavLink, Outlet } from "react-router-dom";
import ConnectivityToggle from "./ConnectivityToggle";
import GuidedWalkthrough from "./GuidedWalkthrough";
import ScenarioReset from "./ScenarioReset";

const surfaces = [
  { to: "/asha", label: "ASHA app" },
  { to: "/voice", label: "Voice line" },
  { to: "/phc", label: "PHC dashboard" },
] as const;

export default function SurfaceSwitcher() {
  return (
    <div className="demo">
      <header className="demo__bar">
        <span className="demo__brand">Arogya Line</span>
        <nav className="demo__nav" aria-label="Surface">
          {surfaces.map((s) => (
            <NavLink key={s.to} to={s.to} className="demo__tab">
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="demo__controls">
          <ConnectivityToggle />
          <ScenarioReset />
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
