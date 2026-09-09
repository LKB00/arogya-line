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
    <div>
      <nav aria-label="Surface">
        {surfaces.map((s) => (
          <NavLink key={s.to} to={s.to}>
            {s.label}
          </NavLink>
        ))}
      </nav>
      <ConnectivityToggle />
      <ScenarioReset />
      <GuidedWalkthrough />
      <main>
        <Outlet />
      </main>
      <footer>
        <p>Concept prototype. Illustrative triage questions, not clinical guidance. No real data.</p>
      </footer>
    </div>
  );
}
