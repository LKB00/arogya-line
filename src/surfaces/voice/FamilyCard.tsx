// The printed card the family keeps at home (SPEC 6.2): the number to dial,
// the family ID to enter, and the menu hint. Static panel beside the phone.

import { useStore } from "../../app/store";

/** The family whose card the visitor is holding. */
export const CARD_FAMILY_ID = "4471";

const LINE_NUMBER = "1800 4471 108";

export default function FamilyCard() {
  const family = useStore((s) => s.families.find((f) => f.id === CARD_FAMILY_ID));

  return (
    <aside aria-label="Family card">
      <h2>Arogya Line card</h2>
      <p>Call {LINE_NUMBER}</p>
      <p>
        Family ID {CARD_FAMILY_ID}
        {family ? ` · ${family.head} · ${family.village}` : ""}
      </p>
      <ul>
        <li>1 — someone is unwell</li>
        <li>3 — hear the doctor's advice</li>
        <li>0 — talk to a person</li>
      </ul>
    </aside>
  );
}
