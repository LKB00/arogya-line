import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_DELAY_MS, useStore } from "./store";

const arjunConcern = {
  familyId: "4471",
  memberId: "4471-2",
  source: "asha" as const,
  answers: [],
  urgency: "amber" as const,
  reasons: ["Fever more than 2 days", "Drinking or feeding less than usual"],
};

describe("syncPending", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.getState().resetDemo();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts offline, so ASHA writes are saved_offline", () => {
    const s = useStore.getState();
    expect(s.online).toBe(false);
    const concern = s.createConcern(arjunConcern);
    const booking = s.createBooking({
      concernId: concern.id,
      date: "2026-01-02",
      slot: "10:00–11:00",
      facility: "PHC Tumkur",
      doctor: "Dr. Ramesh",
    });
    expect(concern.sync).toBe("saved_offline");
    expect(booking.sync).toBe("saved_offline");
  });

  it("flips saved_offline items to sent after the delay once online", async () => {
    const s = useStore.getState();
    const concern = s.createConcern(arjunConcern);
    s.createBooking({
      concernId: concern.id,
      date: "2026-01-02",
      slot: "10:00–11:00",
      facility: "PHC Tumkur",
      doctor: "Dr. Ramesh",
    });

    s.setOnline(true);
    const pending = s.syncPending();

    // Not yet: the delay has not elapsed.
    vi.advanceTimersByTime(SYNC_DELAY_MS - 1);
    expect(useStore.getState().concerns.some((c) => c.sync === "saved_offline")).toBe(true);

    vi.advanceTimersByTime(1);
    await pending;

    const after = useStore.getState();
    expect(after.concerns.every((c) => c.sync === "sent")).toBe(true);
    expect(after.bookings.every((b) => b.sync === "sent")).toBe(true);
  });

  it("does not sync if the signal drops before the delay ends", async () => {
    const s = useStore.getState();
    s.createConcern(arjunConcern);
    s.setOnline(true);
    const pending = s.syncPending();
    s.setOnline(false);

    vi.advanceTimersByTime(SYNC_DELAY_MS);
    await pending;

    expect(useStore.getState().concerns.some((c) => c.sync === "saved_offline")).toBe(true);
  });

  it("IVR concerns are sent even while the ASHA app is offline", () => {
    const concern = useStore.getState().createConcern({ ...arjunConcern, source: "ivr" });
    expect(concern.sync).toBe("sent");
  });

  it("resetDemo restores the seed", () => {
    const s = useStore.getState();
    s.createConcern(arjunConcern);
    s.setOnline(true);
    s.resetDemo();
    const after = useStore.getState();
    expect(after.online).toBe(false);
    expect(after.concerns).toHaveLength(4);
    expect(after.bookings).toHaveLength(4);
    expect(after.families.map((f) => f.id)).toContain("4471");
  });
});

describe("saveAdvice edge cases", () => {
  it("editing advice keeps the follow-up outcome", () => {
    useStore.getState().resetDemo();
    const s = useStore.getState();
    // b-7809's follow-up was missed; correcting the advice must not reopen it.
    s.saveAdvice("b-7809", "Corrected advice.");
    const b = useStore.getState().bookings.find((x) => x.id === "b-7809")!;
    expect(b.advice).toBe("Corrected advice.");
    expect(b.followUpStatus).toBe("missed");
  });

  it("first advice sets a follow-up for the next day, pending", () => {
    useStore.getState().resetDemo();
    useStore.getState().saveAdvice("b-3120", "Advice.");
    const b = useStore.getState().bookings.find((x) => x.id === "b-3120")!;
    expect(b.followUpStatus).toBe("pending");
    expect(b.followUpDue).toBeDefined();
  });
});
