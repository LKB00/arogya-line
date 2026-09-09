// The 0–9 keypad, plus Call and Hang up (SPEC 6.2).

import { KEYS, type Key } from "./callMachine";

const HINT: Partial<Record<Key, string>> = { "9": "repeat", "0": "person" };

export default function Keypad({
  onKey,
  onCall,
  onHangUp,
  inCall,
}: {
  onKey: (key: Key) => void;
  onCall: () => void;
  onHangUp: () => void;
  inCall: boolean;
}) {
  return (
    <div>
      <div role="group" aria-label="Keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => onKey(k)} disabled={!inCall} aria-label={`Key ${k}`}>
            {k}
            {HINT[k] ? ` (${HINT[k]})` : ""}
          </button>
        ))}
      </div>
      <p>
        <button type="button" onClick={onCall} disabled={inCall}>
          Call
        </button>{" "}
        <button type="button" onClick={onHangUp} disabled={!inCall}>
          Hang up
        </button>
      </p>
    </div>
  );
}
