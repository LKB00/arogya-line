// Data model. Source of truth: SPEC.md section 4.

export type Urgency = "green" | "amber" | "red";
export type SyncStatus = "saved_offline" | "sent";
export type Source = "asha" | "ivr";

export type Member = {
  id: string;
  name: string;
  age: number;
  role: "mother" | "child" | "adult" | "pregnant";
  note?: string; // e.g. "fever since Tuesday"
};

export type Family = {
  id: string; // 4-digit, printed on the card, e.g. "4471"
  head: string;
  village: string;
  phone: string; // masked
  ashaId: string;
  members: Member[];
};

/** Home-care advice given with a "no urgent signs" result: what to do, and when to call again. */
export type HomeCare = {
  tell: string[];
  callIf: string[];
  /** The same advice as it was spoken on the phone, kept so a replay says exactly what was said. */
  spoken?: string[];
};

export type TriageAnswer = { questionId: string; answer: "yes" | "no" };

export type Concern = {
  id: string;
  familyId: string;
  memberId: string;
  source: Source;
  answers: TriageAnswer[];
  urgency: Urgency;
  reasons: string[]; // plain-text reasons shown to the user
  homeCare?: HomeCare; // the advice given, saved with a home-care result
  createdAt: string;
  sync: SyncStatus;
};

export type Booking = {
  id: string;
  concernId: string;
  date: string; // ISO date
  slot: string; // e.g. "10:00–11:00"
  facility: string; // "PHC Tumkur"
  doctor: string;
  sync: SyncStatus;
  /** Doctor, after the consult: could this have been handled without a visit? */
  avoidable?: boolean;
  advice?: string; // doctor's note text (stands in for the voice note)
  adviceAt?: string; // ISO timestamp the advice was last saved, so "latest" is exact
  followUpDue?: string; // ISO date
  followUpStatus?: "pending" | "answered" | "missed";
  /** The doctor, after a missed call, asked the ASHA to follow up. Never automatic. */
  ashaAsked?: boolean;
  /** An emergency: the patient is coming now, not to a slot. `slot` is "Now". */
  emergency?: boolean;
  /** Demo only: a future booking marked as arrived, so it can be consulted today. */
  arrived?: boolean;
  walkIn?: boolean; // came without a booking; only the PHC metrics strip reads this
};

export type Surface = "asha" | "voice" | "phc";

export type Store = {
  families: Family[];
  concerns: Concern[];
  bookings: Booking[];
  online: boolean; // ASHA app connectivity
  activeSurface: Surface;
  /** Counts resets, so anything still running from before (a call, its timer) ends with the old demo. */
  demoRun: number;
};
