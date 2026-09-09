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

export type TriageAnswer = { questionId: string; answer: "yes" | "no" };

export type Concern = {
  id: string;
  familyId: string;
  memberId: string;
  source: Source;
  answers: TriageAnswer[];
  urgency: Urgency;
  reasons: string[]; // plain-text reasons shown to the user
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
  visitNeeded?: boolean; // set by doctor after consult
  advice?: string; // doctor's note text (stands in for the voice note)
  followUpDue?: string; // ISO date
  followUpStatus?: "pending" | "answered" | "missed";
  walkIn?: boolean; // came without a booking; only the PHC metrics strip reads this
};

export type Surface = "asha" | "voice" | "phc";

export type Store = {
  families: Family[];
  concerns: Concern[];
  bookings: Booking[];
  online: boolean; // ASHA app connectivity
  activeSurface: Surface;
};
