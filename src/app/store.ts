// Shared state + actions. Every write in the app goes through one of these.
// Source of truth: SPEC.md sections 4, 6 and 7.

import { create } from "zustand";
import type { Booking, Concern, Store, Surface } from "./types";
import { addDays, createSeed, isoDate } from "./seed";

/** Advice someone in a family has been given: by the doctor, or with a home-care result. */
export type PersonAdvice = {
  memberId: string;
  date: string; // ISO date it was given
  from: "doctor" | "check";
  booking?: Booking; // doctor's advice: the visit it came from
  concern?: Concern; // home-care advice: the check it came with
};

/**
 * The latest advice for each person in a family, newest first. Advice belongs
 * to a person, never to the family: the ASHA FamilyDetail and the Voice line
 * (menu 3) both read it here, so Arjun never hears Lakshmi's advice.
 */
export function adviceByPerson(state: Pick<Store, "concerns" | "bookings">, familyId: string): PersonAdvice[] {
  const concerns = state.concerns.filter((c) => c.familyId === familyId);
  const all: PersonAdvice[] = [
    ...state.bookings.flatMap((b) => {
      const c = concerns.find((x) => x.id === b.concernId);
      return c && b.advice ? [{ memberId: c.memberId, date: b.date, from: "doctor" as const, booking: b }] : [];
    }),
    ...concerns.filter((c) => c.homeCare).map((c) => ({ memberId: c.memberId, date: localDay(c.createdAt), from: "check" as const, concern: c })),
  ];
  // Newest first; on the same day the doctor's word outranks the check's.
  all.sort((a, b) => (a.date === b.date ? (a.from === "doctor" ? -1 : 1) : a.date < b.date ? 1 : -1));
  const seen = new Set<string>();
  return all.filter((a) => (seen.has(a.memberId) ? false : (seen.add(a.memberId), true)));
}

/** The local calendar day of an ISO timestamp. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const SYNC_DELAY_MS = 1500;

export type ConcernInput = Omit<Concern, "id" | "createdAt" | "sync">;
export type BookingInput = Omit<Booking, "id" | "sync">;

export type Actions = {
  /** Create a concern. IVR concerns are always "sent"; ASHA concerns respect `online`. */
  createConcern: (input: ConcernInput) => Concern;
  /** Create a booking. Sync follows the linked concern's source and `online`. */
  createBooking: (input: BookingInput) => Booking;
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
    const fromIvr = concern?.source === "ivr";
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

  setAvoidable: (bookingId, avoidable) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, avoidable } : b)),
    }));
  },

  // Advice never touches the follow-up: correcting a word must not reopen an
  // answered call, and not every consult needs one.
  saveAdvice: (bookingId, advice) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, advice } : b)),
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

  setFollowUpStatus: (bookingId, status) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, followUpStatus: status } : b)),
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
    set(createSeed());
  },
}));
