const STORAGE_KEY = "poker-sounds-enabled";

export type TableSound = "shuffle" | "deal" | "cheer";

const SOUND_SRC: Record<TableSound, string> = {
  shuffle: "/sounds/shuffle.wav",
  deal: "/sounds/deal.wav",
  cheer: "/sounds/cheer.wav",
};

let unlocked = false;
const cache = new Map<TableSound, HTMLAudioElement>();

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw !== "0" && raw !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

function getAudio(name: TableSound): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(SOUND_SRC[name]);
    audio.preload = "auto";
    cache.set(name, audio);
  }
  return audio;
}

/** Call from a user gesture so later autoplay works in Chrome. */
export function unlockTableSounds(): void {
  if (typeof window === "undefined" || unlocked) return;
  unlocked = true;
  for (const name of Object.keys(SOUND_SRC) as TableSound[]) {
    const audio = getAudio(name);
    if (!audio) continue;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }
}

export function playTableSound(
  name: TableSound,
  options?: { volume?: number }
): void {
  if (typeof window === "undefined") return;
  if (!getSoundEnabled()) return;

  const base = getAudio(name);
  if (!base) return;

  // Clone so overlapping deal ticks don't cut each other off.
  const audio = base.cloneNode(true) as HTMLAudioElement;
  audio.volume = Math.max(0, Math.min(1, options?.volume ?? 1));
  void audio.play().catch(() => {
    // Autoplay blocked until a gesture — ignore.
  });
}

/** Shuffle, then staggered deal sounds for hole cards around the table. */
export function playNewHandSounds(activePlayerCount: number): void {
  if (!getSoundEnabled()) return;

  playTableSound("shuffle", { volume: 0.7 });

  const dealCount = Math.max(2, activePlayerCount * 2);
  const staggerMs = 120;
  const startMs = 400;
  for (let i = 0; i < dealCount; i++) {
    const delay = startMs + i * staggerMs;
    window.setTimeout(() => {
      playTableSound("deal", { volume: 0.55 });
    }, delay);
  }
}

export function playHandEndCheer(): void {
  playTableSound("cheer", { volume: 0.75 });
}
