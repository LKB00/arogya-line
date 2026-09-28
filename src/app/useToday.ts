// Today's date for a screen that stays open: it changes at midnight, so a
// list left open overnight moves "tomorrow" into "today" without a reload.

import { useEffect, useState } from "react";
import { isoDate } from "./seed";

export function useToday(): string {
  const [today, setToday] = useState(() => isoDate(0));
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setToday(isoDate(0)), midnight.getTime() - now.getTime());
    return () => clearTimeout(timer);
  }, [today]);
  return today;
}
