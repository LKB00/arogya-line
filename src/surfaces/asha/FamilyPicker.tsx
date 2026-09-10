// Choose which family the new concern is for (SPEC 6.1 TodayList primary
// action). The ASHA's register is already in the store; nothing is typed here.

import { Link } from "react-router-dom";
import { useStore } from "../../app/store";
import { ASHA } from "../../app/seed";

/** The rest of the household; the head is already the row's title. */
function others(head: string, members: { name: string }[]): string {
  return members
    .filter((m) => m.name !== head)
    .map((m) => m.name)
    .join(", ");
}

export default function FamilyPicker() {
  const families = useStore((s) => s.families).filter((f) => f.ashaId === ASHA.id);

  return (
    <section className="screen">
      <header className="screen__header">
        <p className="screen__eyebrow">New concern</p>
        <h1 className="screen__title">Which family?</h1>
      </header>

      <ul className="members">
        {families.map((f) => (
          <li key={f.id}>
            <Link className="member" to={`/asha/family/${f.id}`} aria-label={`Family ${f.id}, ${f.head}`}>
              <span className="member__main">
                <span className="member__head">
                  <span className="member__name">{f.head}</span>
                  <span className="member__age">
                    <span className="row__id">{f.id}</span> · {f.village}
                  </span>
                </span>
                {others(f.head, f.members) && <span className="member__note">{others(f.head, f.members)}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
