// "Signal on / off" for the ASHA app. Lives in the shell, outside the phone.
// setOnline(true) starts syncPending in the store, so nothing else is needed here.

import { useStore } from "../app/store";

export default function ConnectivityToggle() {
  const online = useStore((s) => s.online);
  const setOnline = useStore((s) => s.setOnline);
  return (
    <label>
      <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />{" "}
      ASHA signal: {online ? "online" : "offline"}
    </label>
  );
}
