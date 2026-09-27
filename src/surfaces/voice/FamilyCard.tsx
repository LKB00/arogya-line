// The printed card the family keeps at home (SPEC 6.2): the number to dial,
// the family ID to enter, and the menu. Drawn as the real card: the number
// largest, the ID in the four boxes it is keyed into, and each menu choice as
// a key with a picture, for anyone who reads slowly.

import { IconBuildingHospital, IconCalendarEvent, IconStethoscope, IconUser, IconVolume } from "@tabler/icons-react";
import { useStore } from "../../app/store";
import Icon from "../../shell/Icon";

/** The family whose card the visitor is holding. */
export const CARD_FAMILY_ID = "4471";

const LINE_NUMBER = "1800 4471 108";

const MENU = [
  { key: "1", icon: IconStethoscope, label: "Someone is unwell" },
  { key: "2", icon: IconCalendarEvent, label: "Book a visit" },
  { key: "3", icon: IconVolume, label: "Hear the doctor's advice" },
  { key: "0", icon: IconUser, label: "Talk to a person" },
];

export default function FamilyCard() {
  const family = useStore((s) => s.families.find((f) => f.id === CARD_FAMILY_ID));

  return (
    <aside className="card" aria-label="Family card">
      <p className="card__brand">
        <Icon icon={IconBuildingHospital} />
        Arogya Line
      </p>
      <div className="card__call">
        <p className="card__key">Call free, from any phone</p>
        <p className="card__number">{LINE_NUMBER}</p>
      </div>
      <div className="card__id-block">
        <p className="card__key">Your family ID</p>
        <p className="card__id" aria-label={`Family ID ${CARD_FAMILY_ID}`}>
          {CARD_FAMILY_ID.split("").map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </p>
        {family && (
          <p className="card__holder">
            {family.head} · {family.village} · PHC Tumkur
          </p>
        )}
      </div>
      <div className="card__menu-block">
        <p className="card__key">When the call connects, press</p>
        <ul className="card__menu">
          {MENU.map((m) => (
            <li key={m.key}>
              <span className="card__digit">{m.key}</span>
              <Icon icon={m.icon} />
              {m.label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
