import { describe, expect, it } from "vitest";
import { waitingWords } from "./syncWords";

describe("what is waiting to send, in her units", () => {
  it("a booking is one visit, not a concern plus a booking", () => {
    expect(waitingWords(1, 0)).toBe("1 visit");
  });
  it("checks without a booking are counted as checks", () => {
    expect(waitingWords(0, 2)).toBe("2 checks");
    expect(waitingWords(2, 1)).toBe("2 visits, 1 check");
  });
});
