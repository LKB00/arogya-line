// Persistent sync status (SPEC 6.1). While there is no signal and something
// is waiting, a calm dark chip says so, with the count. When the signal
// returns, the store sends after a short delay; for that moment the chip says
// "Sending", so it never disappears while rows still read "Waiting to send".
// A state of the phone, never of a patient, so it never takes a triage colour.

import { IconCloudOff, IconCloudUpload } from "@tabler/icons-react";
import { useStore } from "../../app/store";
import Icon from "../../shell/Icon";
import { waitingWords } from "./syncWords";

export default function SyncBanner() {
  const online = useStore((s) => s.online);
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const visits = bookings.filter((b) => b.sync === "saved_offline").length;
  // A concern waiting with its booking is part of that visit, not a second item.
  const checks = concerns.filter((c) => c.sync === "saved_offline" && !bookings.some((b) => b.concernId === c.id)).length;
  if (visits + checks === 0) return null;
  const words = waitingWords(visits, checks);
  if (online) {
    return (
      <span className="sync-chip sync-chip--sending" role="status">
        <Icon icon={IconCloudUpload} size={16} />
        Sending {words}…
      </span>
    );
  }
  return (
    <span className="sync-chip" role="status">
      <Icon icon={IconCloudOff} size={16} />
      <span>
        Offline · {words} to send
        <span className="visually-hidden"> — saved on this phone, sends when there is signal</span>
      </span>
    </span>
  );
}
