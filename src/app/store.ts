// Shared state + actions. Every write in the app goes through one of these.
// Source of truth: SPEC.md sections 4, 6 and 7.

import { create } from "zustand";
import type { Booking, Concern, Store, Surface } from "./types";
import { addDays, createSeed } from "./seed";

/**
 * The most recent booking with saved doctor advice for a family, if any.
 * Read by the ASHA FamilyDetail ("Hear last doctor note") and the Voice line
 * (menu 3) so both read back the same note.
 */
export function latestAdviceFor(state: Pick<Store, "concerns" | "bookings">, familyId: string): Booking | undefined {
  const concernIds = new Set(state.concerns.filter((c) => c.familyId === familyId).map((c) => c.id));
  return state.bookings
    .filter((b) => concernIds.has(b.concernId) && b.advice)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
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
  /** Doctor marks whether a physical visit is needed. */
  setVisitNeeded: (bookingId: string, visitNeeded: boolean) => void;
  /** Doctor saves advice; schedules a follow-up for the day after the booking. */
  saveAdvice: (bookingId: string, advice: string) => void;
  /** Demo control for the follow-up outcome. */
  setFollowUpStatus: (bookingId: string, status: NonNullable<Booking["followUpStatus"]>) => void;
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

  setVisitNeeded: (bookingId, visitNeeded) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, visitNeeded } : b)),
    }));
  },

  saveAdvice: (bookingId, advice) => {
    set((s) => ({
      bookings: s.bookings.map((b) =>
        b.id === bookingId
          ? // Editing advice keeps a follow-up that is already set, and its
            // outcome: correcting a word must not reopen an answered call.
            { ...b, advice, followUpDue: b.followUpDue ?? addDays(b.date, 1), followUpStatus: b.followUpStatus ?? "pending" }
          : b,
      ),
    }));
  },

  setFollowUpStatus: (bookingId, status) => {
    set((s) => ({
      bookings: s.bookings.map((b) => (b.id === bookingId ? { ...b, followUpStatus: status } : b)),
    }));
  },

  setActiveSurface: (surface) => set({ activeSurface: surface }),

  resetDemo: () => {
    clearSyncTimer();
    set(createSeed());
  },
}));
