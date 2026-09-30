// Shared state + actions. Every write in the app goes through one of these.
// Source of truth: SPEC.md sections 4, 6 and 7.

import { create } from "zustand";
import type { Booking, Concern, Store, Surface } from "./types";
import { addDays, createSeed, isoDate } from "./seed";
import { isBookable } from "./slots";

/** Advice someone in a family has been given: by the doctor, or with a home-care result. */
export type PersonAdvice = {
  memberId: string;
  date: string; // ISO date it was given
  at: number; // when, to the millisecond: "latest" compares this, never the day
  from: "doctor" | "check";
  booking?: Booking; // doctor's advice: the visit it came from
  concern?: Concern; // home-care advice: the check it came with
};

/**
 * The latest advice for each person in a family, newest first. Advice belongs
 * to a person, never to the family: the ASHA FamilyDetail and the Voice line
 * (menu 3) both read it here, so Arjun never hears Pooja's advice.
 */
export function adviceByPerson(state: Pick<Store, "concerns" | "bookings">, familyId: string): PersonAdvice[] {
  const concerns = state.concerns.filter((c) => c.familyId === familyId);
  const all: PersonAdvice[] = [
    ...state.bookings.flatMap((b) => {
      const c = concerns.find((x) => x.id === b.concernId);
      // Advice saved without a time (older records) counts from midday of the visit.
      const at = Date.parse(b.adviceAt ?? `${b.date}T12:00:00`);
      return c && b.advice ? [{ memberId: c.memberId, date: b.date, at, from: "doctor" as const, booking: b }] : [];
    }),
    ...concerns
      .filter((c) => c.homeCare)
      .map((c) => ({ memberId: c.memberId, date: localDay(c.createdAt), at: Date.parse(c.createdAt), from: "check" as const, concern: c })),
  ];
  // Newest first, by the moment it was given: a check at 3 pm is newer than
  // the doctor's advice at 9 am the same day.
  all.sort((a, b) => b.at - a.at);
  const seen = new Set<string>();
  return all.filter((a) => (seen.has(a.memberId) ? false : (seen.add(a.memberId), true)));
}

/** The local calendar day of an ISO timestamp. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export { slotTaken } from "./slots";

/** A consult can be recorded only for a patient who can be in the room: today, a past day, or (demo) arrived. */
function canConsult(b: Booking): boolean {
  return b.date <= isoDate(0) || Boolean(b.arrived);
}

export const SYNC_DELAY_MS = 1500;

export type ConcernInput = Omit<Concern, "id" | "createdAt" | "sync">;
export type BookingInput = Omit<Booking, "id" | "sync">;

export type Actions = {
  /** Create a concern. IVR concerns are always "sent"; ASHA concerns respect `online`. */
  createConcern: (input: ConcernInput) => Concern;
  /**
   * Create a booking. Sync follows the linked concern's source and `online`.
   * Refused (undefined) if the concern does not exist or the slot is taken.
   */
  createBooking: (input: BookingInput) => Booking | undefined;
  /** Set ASHA connectivity. Turning it on starts syncPending. */
  setOnline: (online: boolean) => void;
  /** After SYNC_DELAY_MS, flip every "saved_offline" item to "sent" (if still online). */
  syncPending: () => Promise<void>;
  /** Doctor answers "Could this have been handled without a visit?". */
  setAvoidable: (bookingId: string, avoidable: boolean) => void;
  /** Doctor saves advice. The follow-up is a separate choice (setFollowUp). */
  saveAdvice: (bookingId: string, advice: string) => void;
  /** Doctor sets the follow-up call `days` after the visit, or none (null). */
  setFollowUp: (bookingId: string, days: number | null) => void;
  /** Demo control for the follow-up outcome. */
  setFollowUpStatus: (bookingId: string, status: NonNullable<Booking["followUpStatus"]>) => void;
  /** After a missed call, the doctor decides: ask the ASHA to follow up… */
  askAshaToFollowUp: (bookingId: string) => void;
  /** …or call again today. */
  callAgainToday: (bookingId: string) => void;
  /** Demo control: a future booking's patient has arrived, so it can be consulted. */
  markArrived: (bookingId: string) => void;
  /** Which surface is showing (used when one surface hands off to another). */
  setActiveSurface: (surface: Surface) => void;
  /** Restore seed data and clear any pending sync. */
  resetDemo: () => void;
};

export type StoreState = Store & Actions;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function clearSyncTimer() {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
}

export const useStore = create<StoreState>()((set, get) => ({
  ...createSeed(),

  createConcern: (input) => {
    const { online } = get();
    const concern: Concern = {
      ...input,
      id: nextId("c"),
      createdAt: new Date().toISOString(),
      sync: input.source === "ivr" || online ? "sent" : "saved_offline",
    };
    set((s) => ({ concerns: [...s.concerns, concern] }));
    return concern;
  },

  createBooking: (input) => {
    const { online, concerns } = get();
    const concern = concerns.find((c) => c.id === input.concernId);
    // The data layer enforces the invariants; screens only warn.
    if (!concern) return undefined;
    // An emergency is an arrival today, never a booking for another day.
    if (input.emergency && input.date !== isoDate(0)) return undefined;
    // The same rule every screen uses, against the clock now: never a slot
    // that is taken, on a past day, or already started today.
    if (!input.emergency && !isBookable(get().bookings, input.date, input.slot, isoDate(0), new Date().getHours())) return undefined;
    const fromIvr = concern.source === "ivr";
    const booking: Booking = {
      ...input,
      id: nextId("b"),
      sync: fromIvr || online ? "sent" : "saved_offline",
    };
    set((s) => ({ bookings: [...s.bookings, booking] }));
    return booking;
  },

  setOnline: (online) => {
    set({ online });
    if (online) void get().syncPending();
  },

  syncPending: () => {
    clearSyncTimer();
    return new Promise((resolve) => {
      syncTimer = setTimeout(() => {
        syncTimer = null;
        if (get().online) {
          set((s) => ({
            concerns: s.concerns.map((c) => (c.sync === "saved_offline" ? { ...c, sync: "sent" } : c)),
            bookings: s.bookings.map((b) => (b.sync === "saved_offline" ? { ...b, sync: "sent" } : b)),
          }));
        }
        resolve();
      }, SYNC_DELAY_MS);
    });
  },

  // Decided with the patient seen: refused for a booking not yet arrived.
  setAvoidable: (bookingId, avoidable) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId && canConsult(b) ? { ...b, avoidable } : b)),
    }));
  },

  // Advice never touches the follow-up: correcting a word must not reopen an
  // answered call, and not every consult needs one.
  // Only for a patient who can have been seen. An edit keeps the words it
  // replaces, with their time: what the family was told is part of the record.
  saveAdvice: (bookingId, advice) => {
    set((s) => ({
      bookings: s.bookings.map((b) => {
        if (b.id !== bookingId || !canConsult(b) || b.advice === advice) return b;
        const adviceLog = b.advice ? [...(b.adviceLog ?? []), { text: b.advice, at: b.adviceAt ?? `${b.date}T12:00:00` }] : b.adviceLog;
        return { ...b, advice, adviceAt: new Date().toISOString(), adviceLog };
      }),
    }));
  },

  setFollowUp: (bookingId, days) => {
    set((s) => ({
      bookings: s.bookings.map((b) => {
        if (b.id !== bookingId) return b;
        if (days === null) return { ...b, followUpDue: undefined, followUpStatus: undefined };
        const due = addDays(b.date, days);
        // Choosing the day already set keeps its outcome; a new day reopens it.
        return due === b.followUpDue ? b : { ...b, followUpDue: due, followUpStatus: "pending" };
      }),
    }));
  },

  // An outcome needs a planned call, and every outcome is logged, so clearing
  // or moving the follow-up later never erases that a call was missed.
  setFollowUpStatus: (bookingId, status) => {
    set((s) => ({
      bookings: s.bookings.map((b) => {
        if (b.id !== bookingId || !b.followUpDue || b.followUpStatus === status) return b;
        const followUpLog =
          status === "pending" ? b.followUpLog : [...(b.followUpLog ?? []), { due: b.followUpDue, outcome: status, at: new Date().toISOString() }];
        return { ...b, followUpStatus: status, followUpLog };
      }),
    }));
  },

  askAshaToFollowUp: (bookingId) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId && b.followUpStatus === "missed" ? { ...b, ashaAsked: true } : b)),
    }));
  },

  callAgainToday: (bookingId) => {
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId ? { ...b, followUpDue: isoDate(0), followUpStatus: "pending", ashaAsked: undefined } : b,
      ),
    }));
  },

  markArrived: (bookingId) => {
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, arrived: true } : b)) }));
  },

  setActiveSurface: (surface) => set({ activeSurface: surface }),

  resetDemo: () => {
    clearSyncTimer();
    // A new run: open sessions keyed on it (the voice call) start over.
    set({ ...createSeed(), demoRun: get().demoRun + 1 });
  },
}));
