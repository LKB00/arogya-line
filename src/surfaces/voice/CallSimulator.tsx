// The IVR player (SPEC 6.2). This file owns the React state and turns the
// machine's effects into store actions; all call logic lives in callMachine.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { EMERGENCY_SLOT, PHC } from "../../app/seed";
import { decodeAnswers } from "../../app/triage";
import PhoneFrame from "../../shell/PhoneFrame";
import { IconArrowLeft, IconBuildingHospital, IconMessageCircle } from "@tabler/icons-react";
import Icon from "../../shell/Icon";
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
  if (state === "operator") return "With a health worker";
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

/**
 * One call is one session: who it is for (family, person, mode, answers) and
 * which run of the demo it belongs to. When any of those change (a new
 * handover link, or Reset demo), the old call and its timers end and a fresh
 * one starts, so nothing from the old session can write into the new store.
 */
export default function CallSimulator() {
  const [params] = useSearchParams();
  const demoRun = useStore((s) => s.demoRun);
  const session = ["family", "member", "mode", "a"].map((k) => params.get(k) ?? "").join("|") + `#${demoRun}`;
  return <CallSession key={session} />;
}

function CallSession() {
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
        // An emergency arrival today, not a slot: the PHC list shows it first.
        if (e.type === "emergency") {
          createBooking({ concernId: concern.id, date: isoDate(0), slot: EMERGENCY_SLOT, emergency: true, facility: PHC.facility, doctor: PHC.doctor });
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

  // After goodbye the line is closed: no keys, and the button calls again.
  const inCall = call.state !== "idle" && call.state !== "ended";
  // Another surface started this call, so the caller belongs back there when
  // it is over. The way back sits where it does everywhere else in the
  // product — top-left, round, always there — not somewhere that appears.
  const handedOver = Boolean(params.get("family")) || params.get("mode") === "emergency";

  // Captions show the prompt still waiting for an answer from its first line,
  // so a long one (the doctor's advice) is read from the start, not from its
  // tail. With nothing waiting, the newest line. Jumped, not animated, so
  // there is nothing for reduced motion to suppress.
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const first = log.querySelector<HTMLElement>(".log__line--current");
    log.scrollTop = first ? first.offsetTop - 16 : log.scrollHeight;
  }, [call.transcript]);

  // A real caller uses the handset, not the mouse: the number row dials and
  // Backspace hangs up. The on-screen keypad stays for people who prefer it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (callRef.current.state === "idle" || callRef.current.state === "ended") return;
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

  // The prompt still hanging in the air is everything said since the caller
  // last pressed a key: a question and its "Press 1 for yes" read as one.
  const lastPress = call.transcript.reduce((found, line, i) => (line.speaker === "caller" ? i : found), -1);

  const status = call.state === "idle" ? "idle" : call.state === "ended" ? "ended" : "on";

  return (
    <div className="voice">
      <PhoneFrame variant="voice">
        <div className="call">
          <header className="call__header">
            {handedOver && (
              <Link className="iconbtn call__back" to="/asha" aria-label="Back to ASHA app" title="Back to ASHA app">
                <Icon icon={IconArrowLeft} size={24} />
              </Link>
            )}
            {/* Caller ID: this number belongs to the health centre. */}
            <span className="call__mark">
              <Icon icon={IconBuildingHospital} size={24} />
            </span>
            <p className="call__to">Arogya Line</p>
            <p className={`call__status call__status--${status}`}>
              <span className="call__number">{LINE_NUMBER}</span> · {statusLabel(call.state)}
            </p>
          </header>

          {/* What the line says, as live captions: there is no audio. */}
          <section className="captions" aria-label="Live captions">
            {call.transcript.length === 0 ? (
              <p className="captions__empty">
                <Icon icon={IconMessageCircle} size={24} />
                Not on a call. Press the green button to call the number on the family card.
              </p>
            ) : (
              <ol className="log" ref={logRef}>
                {call.transcript.map((line, i) => (
                  <li
                    key={i}
                    className={`log__line log__line--${line.speaker}${i > lastPress ? " log__line--current" : ""}`}
                  >
                    {/* Named once per run of lines, as a chat does. */}
                    {line.speaker !== "caller" && call.transcript[i - 1]?.speaker !== line.speaker && (
                      <span className="log__who">{SPEAKER_LABEL[line.speaker]}</span>
                    )}
                    <span className="log__text">{line.speaker === "caller" && /^\d+$/.test(line.text) ? `${line.text.length === 1 ? "Pressed" : "Entered"} ${line.text}` : line.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* The family ID keyed into four boxes, the way it is printed on the card. */}
          {call.state === "enterFamilyId" && (
            <div className="idboxes" aria-label={`Family ID: ${call.idBuffer.length} of 4 digits`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={i === call.idBuffer.length ? "idboxes__box is-next" : "idboxes__box"}>
                  {call.idBuffer[i] ?? ""}
                </span>
              ))}
            </div>
          )}

          <Keypad onKey={(key: Key) => apply(press(callRef.current, key, readEnv()))} onCall={dial} onHangUp={() => apply(hangUp())} inCall={inCall} ended={call.state === "ended"} listening={call.state !== "operator"} />
        </div>
      </PhoneFrame>

      <div className="voice__side">
        <div className="voice__intro">
          <h1>Voice line</h1>
          <p>A family on any phone, even a basic one, calls the number on their card. There is no audio here: what the line says appears as captions.</p>
          <p>Use the keypad, or the number keys 0–9. Backspace hangs up.</p>
        </div>
        <FamilyCard />
      </div>
    </div>
  );
}
