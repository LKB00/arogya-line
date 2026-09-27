// Family members, with the open concern marked (SPEC 6.1 FamilyDetail).
// The screen steers to the likely next step: the person the family reported,
// or the one with something open, comes first with their words quoted, and
// checking them is the one primary action at the foot of the screen. Anyone
// else is one tap on their card. The doctor's last advice is a voice note.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconChevronRight,
  IconIdBadge2,
  IconMapPin,
  IconMessageCircle,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconStethoscope,
} from "@tabler/icons-react";
import { latestAdviceFor, useStore } from "../../app/store";
import { isoDate } from "../../app/seed";
import { dayLabel, memberAge } from "../../app/format";
import type { Member } from "../../app/types";
import Icon from "../../shell/Icon";
import UrgencyChip from "./UrgencyChip";
import { personIcon } from "./pictograms";
import { rowFor } from "./rows";

/** A voice note's waveform: fixed bar heights, so it reads as speech. */
const WAVE = [8, 14, 20, 12, 24, 16, 10, 22, 18, 12, 8, 16, 24, 20, 12, 8, 14, 18, 10, 6, 12, 16, 8, 6];

/** Age, plus who they are in the household when that says something. */
function detail(m: Member): string {
  const role = m.role === "child" ? " · child" : m.role === "mother" ? " · mother" : "";
  return memberAge(m) + role;
}

export default function FamilyDetail() {
  const { familyId = "" } = useParams();
  const family = useStore((s) => s.families.find((f) => f.id === familyId));
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const [showNote, setShowNote] = useState(false);

  if (!family) {
    return (
      <section className="screen">
        <p className="screen__empty">Family {familyId} not found.</p>
      </section>
    );
  }

  const row = rowFor(family, concerns, bookings, isoDate(0));
  const openFor = (m: Member) => (row && row.band !== "done" && row.member?.id === m.id ? row : undefined);
  const flagged = (m: Member) => Boolean(openFor(m) || m.note);

  const latestAdvice = latestAdviceFor({ concerns, bookings }, family.id);
  const adviceFor = latestAdvice
    ? family.members.find((m) => m.id === concerns.find((c) => c.id === latestAdvice.concernId)?.memberId)
    : undefined;

  // The person with something open is why she is here: they come first.
  const members = [...family.members].sort((a, b) => Number(flagged(b)) - Number(flagged(a)));
  const focus = members.find(flagged);

  return (
    <>
      <section className="screen">
        <header className="pagehead">
          <p className="pagehead__meta">
            <span>
              <Icon icon={IconMapPin} size={16} />
              {family.village}
            </span>
            <span>
              <Icon icon={IconIdBadge2} size={16} />
              Card {family.id}
            </span>
          </p>
          <h1 className="pagehead__title">{family.head}'s family</h1>
        </header>

        <section className="block">
          <div className="block__head">
            <h2 className="block__title">Who is unwell?</h2>
            {!focus && <p className="block__sub">Tap the person you are worried about to check them.</p>}
          </div>
          <ul className="people">
            {members.map((m) => {
              const open = openFor(m);
              return (
                <li key={m.id}>
                  <Link
                    className={flagged(m) ? "person person--focus" : "person"}
                    to={`/asha/family/${family.id}/check/${m.id}`}
                    aria-label={`Check symptoms of ${m.name}`}
                  >
                    <span className="person__head">
                      <span className="person__disc">
                        <Icon icon={personIcon(m)} size={24} />
                      </span>
                      <span className="person__main">
                        <span className="person__name">{m.name}</span>
                        <span className="person__detail">{detail(m)}</span>
                      </span>
                      <Icon icon={IconChevronRight} className="row__chevron" />
                    </span>
                    {open && open.band !== "done" && (
                      <span className="person__status">
                        <UrgencyChip urgency={open.band} tonal />
                        <span className="person__task">
                          {open.task}
                          {open.day && ` · ${open.day}`}
                          {open.time && `, ${open.time}`}
                        </span>
                      </span>
                    )}
                    {m.note && (
                      <span className="quote">
                        <Icon icon={IconMessageCircle} />
                        <span>
                          <span className="quote__text">“{m.note[0].toUpperCase() + m.note.slice(1)}”</span>
                          <span className="quote__by">What the family told you</span>
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Only when a doctor has actually left a note. Drawn as the voice
            note she knows from WhatsApp; v1 has no audio, so playing it shows
            the words. */}
        {latestAdvice && (
          <section className="block">
            <h2 className="block__title">From the doctor</h2>
            <div className="voicenote">
              <div className="voicenote__player">
                <button
                  type="button"
                  className="voicenote__play"
                  aria-expanded={showNote}
                  aria-label={showNote ? "Hide the doctor's note" : "Hear last doctor note"}
                  onClick={() => setShowNote((v) => !v)}
                >
                  <Icon icon={showNote ? IconPlayerPauseFilled : IconPlayerPlayFilled} />
                </button>
                <span className="voicenote__track">
                  <span className="voicenote__wave" aria-hidden="true">
                    {WAVE.map((h, i) => (
                      <span key={i} className={showNote && i < 10 ? "is-played" : ""} style={{ height: h }} />
                    ))}
                  </span>
                  <span className="voicenote__time">
                    <span>{showNote ? "0:08" : "0:00"}</span>
                    <span>0:20</span>
                  </span>
                </span>
              </div>
              <p className="voicenote__meta">
                <Icon icon={IconStethoscope} size={16} />
                {latestAdvice.doctor}
                {/* Never a day still to come: advice written ahead of a visit has no "when". */}
                {latestAdvice.date <= isoDate(0) && ` · ${dayLabel(latestAdvice.date).toLowerCase()}`}
                {adviceFor && ` · about ${adviceFor.name}`}
              </p>
              {showNote && (
                <div className="voicenote__words">
                  <span className="voicenote__label">What the doctor said</span>
                  <blockquote>{latestAdvice.advice}</blockquote>
                </div>
              )}
            </div>
          </section>
        )}
      </section>

      {focus && (
        <div className="footbar">
          <Link className="btn btn--primary btn--block btn--tall" to={`/asha/family/${family.id}/check/${focus.id}`}>
            <Icon icon={IconStethoscope} />
            Check {focus.name}'s symptoms
          </Link>
          {members.length > 1 && <p className="footbar__hint">Or tap anyone above to check them</p>}
        </div>
      )}
    </>
  );
}
