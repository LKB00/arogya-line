// The app bar every ASHA screen sits under: the way back, when the current
// screen has one (declared on its route as `handle.back`). The bar keeps its
// 56 px height either way, so every screen's title starts at the same y.

import { Link, useLocation, useMatches, useParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { IconArrowLeft } from "@tabler/icons-react";
import Icon from "../../shell/Icon";
import SyncBanner from "./SyncBanner";

/** Where a screen goes back to. Set per route in router.tsx. */
export type BackKind = "today" | "family" | "result";

/** `own`: the screen draws its own bar (Today, the check, results, booked). */
type Handle = { back?: BackKind; own?: boolean };

export default function TopBar() {
  const { familyId = "", memberId = "" } = useParams();
  const { search } = useLocation();
  const matches = useMatches();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));

  const handle = matches[matches.length - 1]?.handle as Handle | undefined;
  const kind = handle?.back;
  if (handle?.own) return null;

  let back: { to: string; label: string } | null = null;
  if (kind === "today" || (kind && !family)) back = { to: "/asha", label: "Back to today" };
  else if (kind === "family" && family) back = { to: `/asha/family/${family.id}`, label: `Back to ${family.head}` };
  else if (kind === "result" && family) {
    back = { to: `/asha/family/${family.id}/check/${memberId}/result${search}`, label: "Back to result" };
  }

  return (
    <header className="topbar">
      {back && (
        <Link className="iconbtn" to={back.to} aria-label={back.label} title={back.label}>
          <Icon icon={IconArrowLeft} size={24} />
        </Link>
      )}
      <SyncBanner />
    </header>
  );
}
