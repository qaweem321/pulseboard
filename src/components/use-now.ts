"use client";

import { useEffect, useState } from "react";

// The current time, refreshed on an interval, so "down for 5 min so far" keeps counting.
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
