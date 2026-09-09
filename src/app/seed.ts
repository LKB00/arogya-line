// Demo scenario. Source of truth: SPEC.md section 7.
// All dates are relative to "today" so the PHC dashboard's default day
// (tomorrow) always has rows. createSeed() returns fresh objects each call.

import type { Booking, Concern, Family, Store } from "./types";

export const ASHA = { id: "asha-savitri", name: "Savitri" } as const;
export const PHC = { facility: "PHC Tumkur", doctor: "Dr. Ramesh" } as const;

/** Fixed slot list used by Booking (ASHA app) and the Voice line. */
export const SLOTS = [
  "09:00–10:00",
  "10:00–11:00",
  "11:00–12:00",
  "14:00–15:00",
] as const;

/** Local calendar date (YYYY-MM-DD) offset from today by `days`. */
export function isoDate(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add whole days to an ISO date string (YYYY-MM-DD). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function at(daysFromToday: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// Question ids below must match the ids used in triage.ts (step 3).

export function createSeed(): Store {
  const families: Family[] = [
    {
      // The family the visitor walks through. No concern yet.
      id: "4471",
      head: "Lakshmi",
      village: "Hebbur",
      phone: "98••• ••471",
      ashaId: ASHA.id,
      members: [
        { id: "4471-1", name: "Lakshmi", age: 28, role: "mother" },
        { id: "4471-2", name: "Arjun", age: 3, role: "child", note: "fever since Tuesday" },
      ],
    },
    {
      // Red booking tomorrow, reported by the ASHA.
      id: "3120",
      head: "Manjunath",
      village: "Hebbur",
      phone: "97••• ••120",
      ashaId: ASHA.id,
      members: [
        { id: "3120-1", name: "Manjunath", age: 34, role: "adult" },
        { id: "3120-2", name: "Kavya", age: 5, role: "child", note: "breathing fast" },
      ],
    },
    {
      // Green booking tomorrow, made on the Voice line.
      id: "5638",
      head: "Gowramma",
      village: "Kallur",
      phone: "99••• ••638",
      ashaId: ASHA.id,
      members: [{ id: "5638-1", name: "Gowramma", age: 62, role: "adult" }],
    },
    {
      // Consulted yesterday; doctor's advice already saved.
      id: "2205",
      head: "Basavaraj",
      village: "Kallur",
      phone: "96••• ••205",
      ashaId: ASHA.id,
      members: [
        { id: "2205-1", name: "Basavaraj", age: 31, role: "adult" },
        { id: "2205-2", name: "Shobha", age: 24, role: "pregnant" },
      ],
    },
    {
      // Walked in without a booking; follow-up missed.
      id: "7809",
      head: "Nagaraj",
      village: "Hebbur",
      phone: "95••• ••809",
      ashaId: ASHA.id,
      members: [{ id: "7809-1", name: "Nagaraj", age: 45, role: "adult" }],
    },
  ];

  const concerns: Concern[] = [
    {
      id: "c-3120",
      familyId: "3120",
      memberId: "3120-2",
      source: "asha",
      answers: [
        { questionId: "child_fever", answer: "yes" },
        { questionId: "child_vomiting", answer: "no" },
        { questionId: "child_feeding", answer: "no" },
        { questionId: "child_breathing", answer: "yes" },
      ],
      urgency: "red",
      reasons: ["Fever more than 2 days", "Breathing fast or difficulty breathing"],
      createdAt: at(0, 8),
      sync: "sent",
    },
    {
      id: "c-5638",
      familyId: "5638",
      memberId: "5638-1",
      source: "ivr",
      answers: [
        { questionId: "adult_fever", answer: "yes" },
        { questionId: "adult_pain", answer: "no" },
        { questionId: "adult_weakness", answer: "no" },
        { questionId: "adult_chest", answer: "no" },
      ],
      urgency: "green",
      reasons: ["Fever more than 2 days", "No chest pain or breathlessness"],
      createdAt: at(0, 9),
      sync: "sent",
    },
    {
      id: "c-2205",
      familyId: "2205",
      memberId: "2205-2",
      source: "asha",
      answers: [
        { questionId: "pregnant_headache", answer: "yes" },
        { questionId: "pregnant_swelling", answer: "yes" },
        { questionId: "pregnant_movement", answer: "no" },
        { questionId: "pregnant_bleeding", answer: "no" },
      ],
      urgency: "amber",
      reasons: ["Severe headache or blurred vision", "Swelling of face or hands", "No bleeding"],
      createdAt: at(-2, 10),
      sync: "sent",
    },
    {
      id: "c-7809",
      familyId: "7809",
      memberId: "7809-1",
      source: "asha",
      answers: [
        { questionId: "adult_fever", answer: "yes" },
        { questionId: "adult_pain", answer: "yes" },
        { questionId: "adult_weakness", answer: "no" },
        { questionId: "adult_chest", answer: "no" },
      ],
      urgency: "amber",
      reasons: ["Fever more than 2 days", "Body pain for more than 2 days", "No chest pain or breathlessness"],
      createdAt: at(-4, 11),
      sync: "sent",
    },
  ];

  const bookings: Booking[] = [
    {
      id: "b-3120",
      concernId: "c-3120",
      date: isoDate(1),
      slot: SLOTS[0],
      facility: PHC.facility,
      doctor: PHC.doctor,
      sync: "sent",
    },
    {
      id: "b-5638",
      concernId: "c-5638",
      date: isoDate(1),
      slot: SLOTS[2],
      facility: PHC.facility,
      doctor: PHC.doctor,
      sync: "sent",
    },
    {
      id: "b-2205",
      concernId: "c-2205",
      date: isoDate(-1),
      slot: SLOTS[1],
      facility: PHC.facility,
      doctor: PHC.doctor,
      sync: "sent",
      visitNeeded: true,
      advice:
        "Rest with feet raised. Take the iron tablet after food. Come back at once if the headache returns or vision blurs.",
      followUpDue: isoDate(0),
      followUpStatus: "pending",
    },
    {
      id: "b-7809",
      concernId: "c-7809",
      date: isoDate(-3),
      slot: SLOTS[3],
      facility: PHC.facility,
      doctor: PHC.doctor,
      sync: "sent",
      walkIn: true, // the one walk-in, so "pre-booked %" is not a flat 100%
      visitNeeded: false,
      advice: "Paracetamol twice a day for three days. Drink plenty of water. No visit needed unless fever passes five days.",
      followUpDue: isoDate(-2),
      followUpStatus: "missed",
    },
  ];

  return {
    families,
    concerns,
    bookings,
    online: false,
    activeSurface: "asha",
  };
}
