// Family members, with the open concern marked (SPEC 6.1 FamilyDetail).
// The screen steers to the likely next step: the person the family reported,
// or the one with something open, comes first with their words quoted, and
// checking them is the one primary action at the foot of the screen. Anyone
// else is one tap on their card. Each person's status and latest advice sit
// with that person, never pooled for the family: two people can need her.

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  IconChevronRight,
  IconHomeHeart,
  IconIdBadge2,
  IconMapPin,
  IconMessageCircle,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconStethoscope,
} from "@tabler/icons-react";
import { adviceByPerson, useStore, type PersonAdvice } from "../../app/store";
import { isoDate } from "../../app/seed";
import { dayLabel, memberAge } from "../../app/format";
import type { Member } from "../../app/types";
import Icon from "../../shell/Icon";
import UrgencyChip from "./UrgencyChip";
import { personIcon } from "./pictograms";
import { itemsFor } from "./rows";

/** A voice note's waveform: fixed bar heights, so it reads as speech. */
const WAVE = [8, 14, 20, 12, 24, 16, 10, 22, 18, 12, 8, 16, 24, 20, 12, 8, 14, 18, 10, 6, 12, 16, 8, 6];

/** ["Rest", "Drink water"] → "rest, and drink water." Read as a sentence, not a list. */
function sentence(items: string[], joiner: "and" | "or"): string {
  const words = items.map((t) => t[0].toLowerCase() + t.slice(1));
  const body = words.length > 1 ? `${words.slice(0, -1).join(", ")}, ${joiner} ${words.at(-1)}` : words.join("");
  return `${body}.`;
}

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
  const [shown, setShown] = useState<string | null>(null);

  if (!family) {
    return (
      <section className="screen">
        <p className="screen__empty">Family {familyId} not found.</p>
      </section>
    );
  }

  // Every open item for each person, not only the first: this is where the
  // folded "+1 more for Arjun" on Today unfolds.
  const items = itemsFor(family, concerns, bookings, isoDate(0));
  const openFor = (m: Member) => items.filter((r) => r.band !== "done" && r.member?.id === m.id);
  const flagged = (m: Member) => openFor(m).length > 0 || Boolean(m.note);

  const advice = adviceByPerson({ concerns, bookings }, family.id);
  const nameOf = (a: PersonAdvice) => family.members.find((m) => m.id === a.memberId)?.name ?? "Someone";

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
                    {open.map((item, i) =>
                      item.band !== "done" ? (
                        <span className="person__status" key={i}>
                          <UrgencyChip urgency={item.band} tonal />
                          <span className="person__task">
                            {item.task}
                            {item.day && ` · ${item.day}`}
                            {item.time && `, ${item.time}`}
                          </span>
                        </span>
                      ) : null,
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

        {/* Each person's latest advice, only when there is some. The doctor's
            is drawn as the voice note she knows from WhatsApp; v1 has no audio,
            so playing it shows the words. Home-care advice is shown as given. */}
        {advice.length > 0 && (
          <section className="block">
            <h2 className="block__title">Advice given</h2>
            {advice.map((a) =>
              a.from === "doctor" && a.booking ? (
                <div className="voicenote" key={a.memberId}>
                  <div className="voicenote__player">
                    <button
                      type="button"
                      className="voicenote__play"
                      aria-expanded={shown === a.memberId}
                      aria-label={shown === a.memberId ? `Hide the doctor's note for ${nameOf(a)}` : `Hear the doctor's note for ${nameOf(a)}`}
                      onClick={() => setShown((v) => (v === a.memberId ? null : a.memberId))}
                    >
                      <Icon icon={shown === a.memberId ? IconPlayerPauseFilled : IconPlayerPlayFilled} />
                    </button>
                    <span className="voicenote__track">
                      <span className="voicenote__wave" aria-hidden="true">
                        {WAVE.map((h, i) => (
                          <span key={i} className={shown === a.memberId && i < 10 ? "is-played" : ""} style={{ height: h }} />
                        ))}
                      </span>
                      <span className="voicenote__time">
                        <span>{shown === a.memberId ? "0:08" : "0:00"}</span>
                        <span>0:20</span>
                      </span>
                    </span>
                  </div>
                  <p className="voicenote__meta">
                    <Icon icon={IconStethoscope} size={16} />
                    For {nameOf(a)} · {a.booking.doctor}
                    {/* Never a day still to come: advice written ahead of a visit has no "when". */}
                    {a.date <= isoDate(0) && ` · ${dayLabel(a.date).toLowerCase()}`}
                  </p>
                  {shown === a.memberId && (
                    <div className="voicenote__words">
                      <span className="voicenote__label">What the doctor said</span>
                      <blockquote>{a.booking.advice}</blockquote>
                    </div>
                  )}
                </div>
              ) : a.concern?.homeCare ? (
                <div className="homecare" key={a.memberId}>
                  <p className="voicenote__meta">
                    <Icon icon={IconHomeHeart} size={16} />
                    For {nameOf(a)} · home care, {dayLabel(a.date).toLowerCase()}
                    {a.concern.source === "ivr" ? " · on the voice line" : ""}
                  </p>
                  <p className="homecare__line">
                    <b>At home:</b> {sentence(a.concern.homeCare.tell, "and")}
                  </p>
                  <p className="homecare__line">
                    <b>Call again if:</b> {sentence(a.concern.homeCare.callIf, "or")}
                  </p>
                </div>
              ) : null,
            )}
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
