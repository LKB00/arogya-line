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
    <div className="dialer">
      <div className="keypad" role="group" aria-label="Keypad">
        {KEYS.map((k) => (
          <button className="key" key={k} type="button" onClick={() => onKey(k)} disabled={!inCall} aria-label={`Key ${k}`}>
            <span className="key__num">{k}</span>
            <span className="key__label">{HINT[k] ?? ""}</span>
          </button>
        ))}
      </div>
      <p className="dialer__actions">
        <button className="btn callbtn callbtn--dial" type="button" onClick={onCall} disabled={inCall}>
          Call
        </button>
        <button className="btn callbtn callbtn--hangup" type="button" onClick={onHangUp} disabled={!inCall}>
          Hang up
        </button>
      </p>
    </div>
  );
}
