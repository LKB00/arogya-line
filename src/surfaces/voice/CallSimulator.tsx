// The IVR player (SPEC 6.2). This file owns the React state and turns the
// machine's effects into store actions; all call logic lives in callMachine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { PHC } from "../../app/seed";
import { decodeAnswers } from "../../app/triage";
import FamilyCard from "./FamilyCard";
import Keypad from "./Keypad";
import { IDLE, KEYS, hangUp, press, startCall, tick, type Call, type Effect, type Env, type Key, type Step } from "./callMachine";

/** Pause between the operator's scripted lines. */
const OPERATOR_DELAY_MS = 1200;

const SPEAKER_LABEL = { line: "Arogya Line", caller: "You", operator: "Health worker" } as const;

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

  return (
    <section>
      <h1>Voice line</h1>
      <p>Call simulator. No audio: each spoken prompt appears in the call log.</p>
      <p>Use the keypad below, or the number keys 0–9 on your keyboard. Backspace hangs up.</p>

      <FamilyCard />

      <div>
        <h2>Call log</h2>
        <p>Status: {call.state}</p>
        {call.transcript.length === 0 ? (
          <p>Not on a call. Press Call to dial.</p>
        ) : (
          <ol aria-label="Call log">
            {call.transcript.map((line, i) => (
              <li key={i}>
                {SPEAKER_LABEL[line.speaker]}: {line.text}
              </li>
            ))}
          </ol>
        )}
        {call.state === "enterFamilyId" && <p>Entered: {call.idBuffer || "____"}</p>}
      </div>

      <Keypad onKey={(key: Key) => apply(press(callRef.current, key, readEnv()))} onCall={dial} onHangUp={() => apply(hangUp())} inCall={inCall} />
    </section>
  );
}
