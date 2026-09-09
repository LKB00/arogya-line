// Persistent banner while offline with items waiting to sync (SPEC 6.1).

import { useStore } from "../../app/store";

export default function SyncBanner() {
  const online = useStore((s) => s.online);
  const waiting = useStore(
    (s) =>
      s.concerns.filter((c) => c.sync === "saved_offline").length +
      s.bookings.filter((b) => b.sync === "saved_offline").length,
  );
  if (online || waiting === 0) return null;
  return (
    <div className="sync-banner" role="status">
      No signal. {waiting} {waiting === 1 ? "item" : "items"} saved on the phone, waiting to send.
    </div>
  );
}
