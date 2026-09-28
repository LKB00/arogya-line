// ASHA home screen (SPEC 6.1 TodayList). It answers her first question of the
// day, "who needs me first?": the most urgent person leads as one large card
// with one action, and everyone else follows in order of urgency, sorted
// red → amber → green → done. One row per person: the person is the work, the
// family is where she finds them, and a row says when someone else in the same
// family also needs her. The village stays on every row so she can still plan
// her walk.

import { Fragment } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowRight,
  IconCalendarEvent,
  IconChevronRight,
  IconCircleCheck,
  IconCloudOff,
  IconHomeHeart,
  IconListCheck,
  IconMapPin,
  IconMessageCircle,
  IconPhoneCall,
  IconPlus,
  IconReportMedical,
  IconStethoscope,
  type TablerIcon,
} from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { ASHA, isoDate } from "../../app/seed";
import { URGENCY_LABEL, longDate } from "../../app/format";
import Icon from "../../shell/Icon";
import SyncBanner from "./SyncBanner";
import UrgencyChip from "./UrgencyChip";
import { BANDS, byWork, isUpcoming, personLabel, reasonFor, rowsFor, type Kind, type Row } from "./rows";

/** What she will do, drawn: see the doctor, phone, go to the home, note it, done. */
const KIND_ICON: Record<Kind, TablerIcon> = {
  visit: IconStethoscope,
  call: IconPhoneCall,
  home: IconHomeHeart,
  concern: IconReportMedical,
  done: IconCircleCheck,
};

function when(row: Row): string {
  return [row.day, row.time].filter(Boolean).join(", ");
}

/** "+1 more for Arjun": his other open items, folded into his one row. */
function moreLine(row: Row): string | undefined {
  return row.more > 0 ? `+${row.more} more for ${row.member?.name ?? "them"}` : undefined;
}

/** "+1 other in this family": others in the same household who also need her. */
function othersLine(row: Row, open: Row[]): string | undefined {
  const n = open.filter((r) => r.family.id === row.family.id && r !== row).length;
  if (n === 0) return undefined;
  return `+${n} other ${n === 1 ? "person" : "people"} in this family`;
}

export default function TodayList() {
  const families = useStore((s) => s.families);
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const today = isoDate(0);

  const rows = families
    .filter((f) => f.ashaId === ASHA.id)
    .flatMap((f) => rowsFor(f, concerns, bookings, today))
    .sort(byWork(today));

  const open = rows.filter((r) => r.band !== "done");
  // Today is today: a visit tomorrow is planned work, never "later today".
  const todays = open.filter((r) => !isUpcoming(r, today));
  const upcoming = open.filter((r) => isUpcoming(r, today));
  const urgent = todays.filter((r) => r.band === "red").length;
  const [next, ...later] = todays;
  const done = rows.filter((r) => r.band === "done");
  // Today's work, then planned days, then work already done.
  const sections = [
    { title: "Later today", rows: later },
    { title: "Upcoming", rows: upcoming },
    { title: "Already seen", rows: done },
  ].filter((sec) => sec.rows.length > 0);

  return (
    <>
      <section className="screen screen--today">
        <header className="home">
          <div className="home__top">
            <p className="home__date">{longDate(today)}</p>
            <SyncBanner />
          </div>
          <h1 className="home__title">Namaste, {ASHA.name}</h1>
          {todays.length > 0 && (
            <p className="home__sub">
              {todays.length} {todays.length === 1 ? "person needs" : "people need"} you today
              {urgent > 0 && <span className="home__urgent tri--red">{urgent} urgent</span>}
            </p>
          )}

        </header>

        {next && (
          <section className="block">
            <h2 className="block__title">Up next</h2>
            {/* Person, then what to do and when, then why, then where. The
                colour and the word say how urgent; the family screen carries
                everything else. */}
            <article className={`hero tri--${next.band}`}>
              <div className="hero__top">{next.band !== "done" && <UrgencyChip urgency={next.band} />}</div>
              <h3 className="hero__name">{personLabel(next)}</h3>
              <ul className="hero__facts">
                <li className="hero__task">
                  <Icon icon={next.kind === "visit" ? IconCalendarEvent : KIND_ICON[next.kind]} />
                  {next.task}
                  {when(next) && ` · ${when(next)}`}
                </li>
                {reasonFor(next, concerns) && (
                  <li>
                    <Icon icon={IconMessageCircle} />
                    {reasonFor(next, concerns)}
                  </li>
                )}
                <li>
                  <Icon icon={IconMapPin} />
                  {next.family.village} · Card {next.family.id}
                  {othersLine(next, open) && ` · ${othersLine(next, open)}`}
                </li>
                {moreLine(next) && (
                  <li>
                    <Icon icon={IconListCheck} />
                    {moreLine(next)}
                  </li>
                )}
              </ul>
              {next.sync === "saved_offline" && (
                <p className="hero__pending">
                  <Icon icon={IconCloudOff} size={16} />
                  Waiting to send
                </p>
              )}
              <Link className="hero__action" to={`/asha/family/${next.family.id}`}>
                Open {next.member ? `${next.member.name}'s` : "the"} family
                <Icon icon={IconArrowRight} />
              </Link>
            </article>
          </section>
        )}

        {/* A clear day is good news, said plainly, with the one thing she
            might need next. */}
        {todays.length === 0 && (
          <section className="empty">
            <span className="empty__mark">
              <Icon icon={IconCircleCheck} size={32} />
            </span>
            <h2 className="empty__title">No one is waiting on you today</h2>
            <p className="empty__sub">If someone falls ill, add a new concern.</p>
          </section>
        )}

        {sections.map((sec) => (
          <section className="block" key={sec.title}>
            <h2 className="block__title">
              {sec.title}
              <span className="block__aside">
                {sec.rows.length} {sec.rows.length === 1 ? "person" : "people"}
              </span>
            </h2>
            <div className="listcard">
              {BANDS.map((band) => {
                const group = sec.rows.filter((r) => r.band === band);
                if (group.length === 0) return null;
                return (
                  <Fragment key={band}>
                    {band !== "done" && <h3 className={`subhead tri--${band}`}>{URGENCY_LABEL[band]}</h3>}
                    <ul>
                      {group.map((r) => (
                        <li key={`${r.family.id}-${r.member?.id ?? ""}`}>
                          <Link className={`row tri--${r.band}`} to={`/asha/family/${r.family.id}`}>
                            <span className="row__disc">
                              <Icon icon={KIND_ICON[r.kind]} />
                            </span>
                            <span className="row__main">
                              <span className="row__title">{personLabel(r)}</span>
                              <span className="row__meta">
                                {r.task} · {r.family.village}
                              </span>
                              {r.note && <span className="row__note">{r.note}</span>}
                              {moreLine(r) && <span className="row__note">{moreLine(r)}</span>}
                              {r.band !== "done" && othersLine(r, open) && <span className="row__note">{othersLine(r, open)}</span>}
                              {r.sync === "saved_offline" && (
                                <span className="row__pending">
                                  <Icon icon={IconCloudOff} size={16} />
                                  Waiting to send
                                </span>
                              )}
                            </span>
                            {r.day && (
                              <span className="row__when">
                                <span>{r.day}</span>
                                {r.time && <span className="row__time">{r.time}</span>}
                              </span>
                            )}
                            <Icon icon={IconChevronRight} className="row__chevron" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Fragment>
                );
              })}
            </div>
          </section>
        ))}
      </section>
      {/* Care work, not data entry: she checks a person. */}
      <Link className="fab" to="/asha/families">
        <Icon icon={IconPlus} size={24} />
        Check someone
      </Link>
    </>
  );
}
