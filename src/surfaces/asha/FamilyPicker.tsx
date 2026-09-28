// Choose which family the person to check is in (SPEC 6.1 TodayList primary
// action, "Check someone"). Grouped by village, the way she holds her households in her head.
// Each household is drawn as its people, and anything open or anything the
// family has said shows on the row, so the right family stands out before
// she reads a name.

import { Link } from "react-router-dom";
import { IconChevronRight, IconMapPin, IconMessageCircle } from "@tabler/icons-react";
import { useStore } from "../../app/store";
import { useToday } from "../../app/useToday";
import { ASHA } from "../../app/seed";
import Icon from "../../shell/Icon";
import { personIcon } from "./pictograms";
import { rowFor } from "./rows";
import { URGENCY_LABEL } from "../../app/format";

export default function FamilyPicker() {
  const families = useStore((s) => s.families).filter((f) => f.ashaId === ASHA.id);
  const concerns = useStore((s) => s.concerns);
  const bookings = useStore((s) => s.bookings);
  const today = useToday();
  const villages = [...new Set(families.map((f) => f.village))];

  return (
    <section className="screen">
      <header className="pagehead">
        <p className="pagehead__eyebrow">Check someone</p>
        <h1 className="pagehead__title">Which family?</h1>
      </header>

      {villages.map((village) => {
        const here = families.filter((f) => f.village === village);
        return (
          <section className="block" key={village}>
            <h2 className="block__title block__title--place">
              <Icon icon={IconMapPin} />
              {village}
              <span className="block__aside">
                {here.length} {here.length === 1 ? "family" : "families"}
              </span>
            </h2>
            <ul className="listcard">
              {here.map((f) => {
                const row = rowFor(f, concerns, bookings, today);
                const told = f.members.find((m) => m.note && !concerns.some((c) => c.memberId === m.id));
                return (
                  <li key={f.id}>
                    <Link className="fam" to={`/asha/family/${f.id}`}>
                      <span className="fam__main">
                        <span className="fam__head">
                          <span className="fam__name">{f.head}</span>
                          <span className="fam__card">Card {f.id}</span>
                        </span>
                        <span className="fam__people">
                          {f.members.map((m) => (
                            <span key={m.id} className="fam__person">
                              <Icon icon={personIcon(m)} size={16} />
                              {m.name}, {m.age}
                            </span>
                          ))}
                        </span>
                        {told ? (
                          <span className="fam__told">
                            <Icon icon={IconMessageCircle} size={16} />
                            {told.name}: “{told.note}”
                          </span>
                        ) : row && row.band !== "done" ? (
                          <span className={`fam__status tri--${row.band}`}>
                            {URGENCY_LABEL[row.band]} · {row.member?.name}, {row.task.toLowerCase().replace("phc", "PHC")}
                            {row.day && ` ${row.day.toLowerCase()}`}
                          </span>
                        ) : null}
                      </span>
                      <Icon icon={IconChevronRight} className="row__chevron" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
