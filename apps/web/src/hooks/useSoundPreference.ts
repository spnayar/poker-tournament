"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getSoundEnabled,
  setSoundEnabled,
  unlockTableSounds,
} from "@/lib/sounds";

export function useSoundPreference() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getSoundEnabled());
  }, []);

  const toggle = useCallback(() => {
    unlockTableSounds();
    const next = !getSoundEnabled();
    setSoundEnabled(next);
    setEnabled(next);
  }, []);

  return { enabled, toggle };
}
