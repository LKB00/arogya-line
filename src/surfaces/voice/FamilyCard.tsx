// The printed card the family keeps at home (SPEC 6.2): the number to dial,
// the family ID to enter, and the menu hint. Static panel beside the phone.

import { useStore } from "../../app/store";

/** The family whose card the visitor is holding. */
export const CARD_FAMILY_ID = "4471";

const LINE_NUMBER = "1800 4471 108";

export default function FamilyCard() {
  const family = useStore((s) => s.families.find((f) => f.id === CARD_FAMILY_ID));

  return (
    <aside className="card" aria-label="Family card">
      <div className="card__band">
        <h2 className="card__brand">Arogya Line card</h2>
      </div>
      <div className="card__body">
        <p className="card__key">Call</p>
        <p className="card__number">{LINE_NUMBER}</p>
        <p className="card__key">Family ID</p>
        <p className="card__id">{CARD_FAMILY_ID}</p>
        {family && (
          <p className="card__holder">
            {family.head} · {family.village}
          </p>
        )}
        <ul className="card__menu">
          <li>
            <span className="card__digit">1</span> someone is unwell
          </li>
          <li>
            <span className="card__digit">3</span> hear the doctor's advice
          </li>
          <li>
            <span className="card__digit">0</span> talk to a person
          </li>
        </ul>
      </div>
    </aside>
  );
}
