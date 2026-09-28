// The 0–9 keypad, plus Call and Hang up (SPEC 6.2). Laid out as a handset
// dialer: round keys, and one round call button that is green to dial and
// red to hang up, as on the phone in her hand. Once the line has said
// goodbye the call is over: the button is green again, to call again.

import { IconPhone } from "@tabler/icons-react";
import Icon from "../../shell/Icon";
import { KEYS, type Key } from "./callMachine";

const HINT: Partial<Record<Key, string>> = { "9": "repeat", "0": "person" };

export default function Keypad({
  onKey,
  onCall,
  onHangUp,
  inCall,
  ended = false,
  listening = true,
}: {
  onKey: (key: Key) => void;
  onCall: () => void;
  onHangUp: () => void;
  inCall: boolean;
  /** The line has said goodbye: dialling again starts a new call. */
  ended?: boolean;
  /** False while a person is talking: keys do nothing, so they look it. */
  listening?: boolean;
}) {
  return (
    <div className="dialer">
      <div className="keypad" role="group" aria-label="Keypad">
        {KEYS.map((k) => (
          <button className="key" key={k} type="button" onClick={() => onKey(k)} disabled={!inCall || !listening} aria-label={`Key ${k}`}>
            <span className="key__num">{k}</span>
            {HINT[k] && <span className="key__label">{HINT[k]}</span>}
          </button>
        ))}
      </div>
      <p className="dialer__actions">
        {inCall ? (
          <button className="callbtn callbtn--hangup" type="button" onClick={onHangUp} aria-label="Hang up">
            <Icon icon={IconPhone} size={24} className="callbtn__end" />
          </button>
        ) : (
          <button className="callbtn callbtn--dial" type="button" onClick={onCall} aria-label={ended ? "Call again" : "Call"} title={ended ? "Call again" : undefined}>
            <Icon icon={IconPhone} size={24} />
          </button>
        )}
      </p>
    </div>
  );
}
