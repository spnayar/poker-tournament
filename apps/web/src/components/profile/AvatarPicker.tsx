"use client";

import { useMemo, useState } from "react";
import {
  AVATAR_CATEGORIES,
  AVATAR_LIBRARY,
  type AvatarCategory,
  type AvatarOption,
} from "@/lib/avatars";

interface AvatarPickerProps {
  currentUrl: string | null;
  onSelect: (avatar: AvatarOption) => Promise<void>;
}

export function AvatarPicker({ currentUrl, onSelect }: AvatarPickerProps) {
  const [category, setCategory] = useState<AvatarCategory | "all">("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (category === "all") return AVATAR_LIBRARY;
    return AVATAR_LIBRARY.filter((a) => a.category === category);
  }, [category]);

  async function handleSelect(avatar: AvatarOption) {
    if (avatar.url === currentUrl || savingId) return;
    setError("");
    setSavingId(avatar.id);
    try {
      await onSelect(avatar);
    } catch {
      setError("Could not save avatar. Try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-1">Avatar</h2>
      <p className="text-slate-400 text-sm mb-4">
        Pick a cartoony look — guys, gals, animals, and more.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {AVATAR_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              category === cat.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-80 overflow-y-auto pr-1">
        {filtered.map((avatar) => {
          const selected = avatar.url === currentUrl;
          const saving = savingId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              title={avatar.label}
              disabled={!!savingId}
              onClick={() => handleSelect(avatar)}
              className={`relative rounded-xl p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                selected
                  ? "ring-2 ring-emerald-500 bg-emerald-950/40"
                  : "ring-1 ring-slate-700 hover:ring-emerald-600/60 bg-slate-900"
              } ${savingId && !saving ? "opacity-50" : ""}`}
            >
              <img
                src={avatar.url}
                alt={avatar.label}
                className="w-full aspect-square rounded-lg bg-slate-800"
              />
              {saving && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/70 text-xs text-emerald-400">
                  …
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </section>
  );
}
