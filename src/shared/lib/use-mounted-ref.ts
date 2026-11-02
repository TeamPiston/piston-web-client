"use client";

import { useEffect, useRef } from "react";

// Tracks committed effect lifetime only. Callers own cancellation and request epochs.
export function useMountedRef() {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return mountedRef;
}
