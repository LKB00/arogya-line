// "Signal on / off" for the ASHA app. Lives in the shell, outside the phone.
// setOnline(true) starts syncPending in the store, so nothing else is needed here.
// Labelled as simulated: the prototype has no network and no storage, so the
// offline story is a demonstration of the sync workflow, not offline-first code.

import { useStore } from "../app/store";

export default function ConnectivityToggle() {
  const online = useStore((s) => s.online);
  const setOnline = useStore((s) => s.setOnline);
  return (
    <label className="signal" title="Prototype only: there is no real network. Records live in this tab and reset on reload.">
      <input
        className="signal__input"
        type="checkbox"
        checked={online}
        onChange={(e) => setOnline(e.target.checked)}
      />
      <span className="signal__track" aria-hidden="true" />
      <span>Simulated ASHA signal: {online ? "online" : "offline"}</span>
    </label>
  );
}
