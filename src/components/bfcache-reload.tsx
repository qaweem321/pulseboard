"use client";

import { useEffect } from "react";

// A page restored from the back/forward cache can show stale signed-in (or signed-out) content
// after a login or logout. Reload it so the server decides again.
export function BfcacheReload() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);
  return null;
}
