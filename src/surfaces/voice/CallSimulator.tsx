// The IVR player (SPEC 6.2). This file owns the React state and turns the
// machine's effects into store actions; all call logic lives in callMachine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { PHC } from "../../app/seed";
import { decodeAnswers } from "../../app/triage";
import PhoneFrame from "../../shell/PhoneFrame";
import FamilyCard from "./FamilyCard";
import Keypad from "./Keypad";
import { IDLE, KEYS, hangUp, press, startCall, tick, type Call, type Effect, type Env, type Key, type Step } from "./callMachine";

/** Pause between the operator's scripted lines. */
const OPERATOR_DELAY_MS = 1200;

const SPEAKER_LABEL = { line: "Arogya Line", caller: "You", operator: "Health worker" } as const;

/** The number printed on the family card, dialled by the Call button. */
const LINE_NUMBER = "1800 4471 108";

/** What the handset shows: a call state, not the machine's state name. */
function statusLabel(state: Call["state"]): string {
  if (state === "idle") return "Ready to dial";
  if (state === "ended") return "Call ended";
  return "On call";
}

/** Fresh store slice at the moment of the key press, not at last render. */
function readEnv(): Env {
  const s = useStore.getState();
  return { families: s.families, concerns: s.concerns, bookings: s.bookings, today: isoDate(0) };
}

function callOptions(params: URLSearchParams) {
  return {
    familyId: params.get("family"),
    emergency: params.get("mode") === "emergency",
    memberId: params.get("member"),
    answers: decodeAnswers(params.get("a")),
  };
}

/**
 * A family ID or mode in the URL means another surface handed the call over,
 * so the call is already connected on the first render. Plain /voice waits for
 * the Call button. startCall never writes to the store, so this is safe here.
 */
function initialCall(params: URLSearchParams): Call {
  if (!params.get("family") && params.get("mode") !== "emergency") return IDLE;
  return startCall(readEnv(), callOptions(params)).call;
}

export default function CallSimulator() {
  const [params] = useSearchParams();
  const [call, setCall] = useState<Call>(() => initialCall(params));
  // Keys pressed faster than React re-renders must still see the latest call.
  const callRef = useRef<Call>(call);
  const logRef = useRef<HTMLOListElement>(null);

  const createConcern = useStore((s) => s.createConcern);
  const createBooking = useStore((s) => s.createBooking);

  const runEffects = useCallback(
    (effects: Effect[]) => {
      for (const e of effects) {
        const concern = createConcern(e.concern);
        if (e.type === "book") {
          createBooking({ concernId: concern.id, date: e.date, slot: e.slot, facility: PHC.facility, doctor: PHC.doctor });
        }
      }
    },
    [createBooking, createConcern],
  );

  const apply = useCallback(
    (step: Step) => {
      callRef.current = step.call;
      setCall(step.call);
      runEffects(step.effects);
    },
    [runEffects],
  );

  const dial = useCallback(() => {
    apply(startCall(readEnv(), callOptions(params)));
  }, [apply, params]);

  // The operator speaks on a timer; the last line books the visit.
  useEffect(() => {
    if (call.state !== "operator") return;
    const timer = setTimeout(() => apply(tick(callRef.current, readEnv())), OPERATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [apply, call]);

  const inCall = call.state !== "idle";

  // A call log shows the newest line, like a handset does. Jumped, not
  // animated, so there is nothing for reduced motion to suppress.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [call.transcript]);

  // A real caller uses the handset, not the mouse: the number row dials and
  // Backspace hangs up. The on-screen keypad stays for people who prefer it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (callRef.current.state === "idle") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        apply(hangUp());
        return;
      }
      if ((KEYS as readonly string[]).includes(e.key)) {
        e.preventDefault();
        apply(press(callRef.current, e.key as Key, readEnv()));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [apply]);

  // The prompt still hanging in the air is the last thing the line said, which
  // may sit above the keys the caller has pressed since.
  const currentIndex = call.transcript.reduce((found, line, i) => (line.speaker === "caller" ? found : i), -1);

  return (
    <div className="voice">
      <PhoneFrame>
        <div className="call">
          <header className="call__header">
            <p className="call__to">Arogya Line</p>
            <p className="call__number">{LINE_NUMBER}</p>
            <p className={`call__status call__status--${inCall ? "on" : call.state}`}>{statusLabel(call.state)}</p>
          </header>

          {call.transcript.length === 0 ? (
            <p className="call__empty">Not on a call. Press Call to dial.</p>
          ) : (
            <ol className="log" aria-label="Call log" ref={logRef}>
              {call.transcript.map((line, i) => (
                <li
                  key={i}
                  className={`log__line log__line--${line.speaker}${i === currentIndex ? " log__line--current" : ""}`}
                >
                  <span className="log__who">{SPEAKER_LABEL[line.speaker]}</span>
                  <span className="log__text">{line.text}</span>
                </li>
              ))}
            </ol>
          )}

          {call.state === "enterFamilyId" && (
            <p className="call__entry">
              <span className="call__entry-key">Family ID</span>
              <span className="call__digits">{call.idBuffer.padEnd(4, "·")}</span>
            </p>
          )}

          <Keypad onKey={(key: Key) => apply(press(callRef.current, key, readEnv()))} onCall={dial} onHangUp={() => apply(hangUp())} inCall={inCall} />
        </div>
      </PhoneFrame>

      <div className="voice__side">
        <div className="voice__intro">
          <h1>Voice line</h1>
          <p>Call simulator. No audio: each spoken prompt appears in the call log.</p>
          <p>Use the keypad, or the number keys 0–9 on your keyboard. Backspace hangs up.</p>
        </div>
        <FamilyCard />
      </div>
    </div>
  );
}
