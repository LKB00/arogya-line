// The app bar every ASHA screen sits under. Left: the way back, when the
// current screen has one (declared on its route as `handle.back`). Right: who
// is signed in, as a mark. Destinations are the same ones the screens used to
// carry themselves; only where the link is drawn has moved.

import { Link, useLocation, useMatches, useParams } from "react-router-dom";
import { ASHA } from "../../app/seed";
import { useStore } from "../../app/store";

/** Where a screen goes back to. Set per route in router.tsx. */
export type BackKind = "today" | "family" | "result";

type Handle = { back?: BackKind };

export default function TopBar() {
  const { familyId = "", memberId = "" } = useParams();
  const { search } = useLocation();
  const matches = useMatches();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));

  const kind = (matches[matches.length - 1]?.handle as Handle | undefined)?.back;

  let back: { to: string; label: string } | null = null;
  if (kind === "today" || (kind && !family)) back = { to: "/asha", label: "Back to today" };
  else if (kind === "family" && family) back = { to: `/asha/family/${family.id}`, label: `Back to ${family.head}` };
  else if (kind === "result" && family) {
    back = { to: `/asha/family/${family.id}/check/${memberId}/result${search}`, label: "Back to result" };
  }

  return (
    <header className="topbar">
      {back ? (
        <Link className="backbtn" to={back.to} aria-label={back.label} title={back.label} />
      ) : (
        <span />
      )}
      <span className="avatar" title={`${ASHA.name} · ASHA worker`}>
        <span aria-hidden="true">{ASHA.name[0]}</span>
        <span className="visually-hidden">
          {ASHA.name}, ASHA worker
        </span>
      </span>
    </header>
  );
}
