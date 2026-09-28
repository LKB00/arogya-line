import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNC_DELAY_MS, adviceByPerson, useStore } from "./store";
import { addDays, isoDate } from "./seed";

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

  it("advice alone sets no follow-up: the doctor chooses one", () => {
    useStore.getState().resetDemo();
    useStore.getState().saveAdvice("b-3120", "Advice.");
    const b = useStore.getState().bookings.find((x) => x.id === "b-3120")!;
    expect(b.followUpDue).toBeUndefined();
    expect(b.followUpStatus).toBeUndefined();
  });
});

describe("setFollowUp", () => {
  const get = (id: string) => useStore.getState().bookings.find((x) => x.id === id)!;

  it("sets the call that many days after the visit, pending", () => {
    useStore.getState().resetDemo();
    useStore.getState().setFollowUp("b-3120", 3);
    expect(get("b-3120").followUpDue).toBe(addDays(get("b-3120").date, 3));
    expect(get("b-3120").followUpStatus).toBe("pending");
  });

  it("choosing the day already set keeps its outcome; a new day reopens it", () => {
    useStore.getState().resetDemo();
    const b = get("b-7809"); // missed, due the day after the visit
    useStore.getState().setFollowUp("b-7809", 1);
    expect(get("b-7809").followUpStatus).toBe("missed");
    useStore.getState().setFollowUp("b-7809", 7);
    expect(get("b-7809").followUpDue).toBe(addDays(b.date, 7));
    expect(get("b-7809").followUpStatus).toBe("pending");
  });

  it("none clears it", () => {
    useStore.getState().resetDemo();
    useStore.getState().setFollowUp("b-2205", null);
    expect(get("b-2205").followUpDue).toBeUndefined();
    expect(get("b-2205").followUpStatus).toBeUndefined();
  });
});

describe("adviceByPerson", () => {
  it("each person's own latest advice, never another family member's", () => {
    useStore.getState().resetDemo();
    const s = useStore.getState();
    const dad = s.createConcern({ familyId: "3120", memberId: "3120-1", source: "ivr", answers: [], urgency: "green", reasons: [], homeCare: { tell: ["Rest"], callIf: ["Chest pain"] } });
    s.saveAdvice("b-3120", "Steam twice a day.");
    const advice = adviceByPerson(useStore.getState(), "3120");
    expect(advice.find((a) => a.memberId === "3120-2")?.booking?.advice).toBe("Steam twice a day.");
    expect(advice.find((a) => a.memberId === "3120-1")?.concern?.id).toBe(dad.id);
    expect(advice).toHaveLength(2);
  });

  it("a family with none has none", () => {
    useStore.getState().resetDemo();
    expect(adviceByPerson(useStore.getState(), "4471")).toEqual([]);
  });
});

describe("after a missed call, the doctor decides", () => {
  const get = (id: string) => useStore.getState().bookings.find((x) => x.id === id)!;

  it("marking missed asks nobody to do anything", () => {
    useStore.getState().resetDemo();
    useStore.getState().setFollowUpStatus("b-2205", "missed");
    expect(get("b-2205").ashaAsked).toBeUndefined();
  });

  it("asking the ASHA is an explicit step; calling again reopens today", () => {
    useStore.getState().resetDemo();
    useStore.getState().setFollowUpStatus("b-2205", "missed");
    useStore.getState().askAshaToFollowUp("b-2205");
    expect(get("b-2205").ashaAsked).toBe(true);
    useStore.getState().callAgainToday("b-2205");
    expect(get("b-2205")).toMatchObject({ followUpStatus: "pending", followUpDue: isoDate(0), ashaAsked: undefined });
  });

  it("the ASHA can only be asked about a missed call", () => {
    useStore.getState().resetDemo();
    useStore.getState().askAshaToFollowUp("b-2205"); // pending, not missed
    expect(get("b-2205").ashaAsked).toBeUndefined();
  });
});

