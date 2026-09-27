// Display only: the icon that depicts each triage question and each kind of
// person, so a symptom or a household is recognised by its picture before its
// words are read. The questions and their logic stay in app/triage.ts;
// nothing here decides anything.

import {
  IconBabyBottle,
  IconBabyCarriage,
  IconBed,
  IconBone,
  IconDroplet,
  IconEye,
  IconHandStop,
  IconHeartbeat,
  IconLungs,
  IconMoodKid,
  IconMoodSick,
  IconOld,
  IconTemperature,
  IconUser,
  IconWoman,
  type TablerIcon,
} from "@tabler/icons-react";
import { getQuestions, toTriageRole } from "../../app/triage";
import type { Member } from "../../app/types";

/** Each question shows the thing it asks about, not a metaphor for it. */
const ICON: Record<string, TablerIcon> = {
  child_fever: IconTemperature,
  child_vomiting: IconMoodSick,
  child_feeding: IconBabyBottle,
  child_breathing: IconLungs,
  adult_fever: IconTemperature,
  adult_pain: IconBone,
  adult_weakness: IconBed,
  adult_chest: IconHeartbeat,
  pregnant_headache: IconEye,
  pregnant_swelling: IconHandStop,
  pregnant_movement: IconBabyCarriage,
  pregnant_bleeding: IconDroplet,
};

export function iconFor(questionId: string): TablerIcon {
  return ICON[questionId] ?? IconHeartbeat;
}

/** A reason line ("Fever more than 2 days", "No fast breathing") back to its icon. */
export function iconForReason(role: Member["role"], reason: string): TablerIcon {
  const q = getQuestions(toTriageRole(role)).find((q) => q.label === reason || q.notFound === reason);
  return q ? iconFor(q.id) : IconHeartbeat;
}

/** Older people are 60 and over; the icon changes, the data does not. */
const OLDER_FROM = 60;

/** Who a person is, at a glance: a child, a woman, an older person, an adult. */
export function personIcon(m: Member): TablerIcon {
  if (m.role === "child") return IconMoodKid;
  if (m.role === "mother" || m.role === "pregnant") return IconWoman;
  if (m.age >= OLDER_FROM) return IconOld;
  return IconUser;
}

/** A one- or two-word name for each question, for the answered-so-far chips. */
const SHORT: Record<string, string> = {
  child_fever: "Fever",
  child_vomiting: "Vomiting",
  child_feeding: "Feeding",
  child_breathing: "Breathing",
  adult_fever: "Fever",
  adult_pain: "Body pain",
  adult_weakness: "Weakness",
  adult_chest: "Chest pain",
  pregnant_headache: "Headache",
  pregnant_swelling: "Swelling",
  pregnant_movement: "Baby moving",
  pregnant_bleeding: "Bleeding",
};

export function shortName(questionId: string): string {
  return SHORT[questionId] ?? "Answer";
}
