"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatCents, getAvatarUrl } from "@/lib/utils";
import { AvatarPicker } from "@/components/profile/AvatarPicker";
import type { AvatarOption } from "@/lib/avatars";

interface Stats {
  tournamentsPlayed: number;
  wins: number;
  itmCount: number;
  totalBuyInCents: number;
  totalPayoutCents: number;
}

interface HistoryItem {
  finishPosition: number | null;
  payoutCents: number;
  tournament: { name: string; buyInCents: number; finishedAt: string | null };
}

interface ProfileUser {
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

export default function ProfilePage() {
  const { status, update: updateSession } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [user, setUser] = useState<ProfileUser | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/profile")
        .then((r) => r.json())
        .then((data) => {
          setStats(data.stats);
          setHistory(data.history ?? []);
          setUser(data.user ?? null);
        });
    }
  }, [status]);

  const handleAvatarSelect = useCallback(
    async (avatar: AvatarOption) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: avatar.url }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setUser(data.user);
      await updateSession({ image: data.user.avatarUrl });
    },
    [updateSession]
  );

  if (!stats || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">Loading profile...</p>
      </div>
    );
  }

  const net = stats.totalPayoutCents - stats.totalBuyInCents;
  const roi =
    stats.totalBuyInCents > 0
      ? ((net / stats.totalBuyInCents) * 100).toFixed(1)
      : "0.0";
  const itmPct =
    stats.tournamentsPlayed > 0
      ? Math.round((stats.itmCount / stats.tournamentsPlayed) * 100)
      : 0;
  const winPct =
    stats.tournamentsPlayed > 0
      ? Math.round((stats.wins / stats.tournamentsPlayed) * 100)
      : 0;

  const avatarSrc = getAvatarUrl(user.displayName, user.avatarUrl);

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-emerald-400 text-sm hover:underline">
        ← Back
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-6">
        <img
          src={avatarSrc}
          alt=""
          className="w-20 h-20 rounded-full ring-2 ring-emerald-600/50"
        />
        <div>
          <h1 className="text-2xl font-bold">{user.displayName}</h1>
          <p className="text-slate-400">{user.email}</p>
        </div>
      </div>

      <AvatarPicker currentUrl={user.avatarUrl} onSelect={handleAvatarSelect} />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Tournaments", value: stats.tournamentsPlayed },
          { label: "Wins", value: `${stats.wins} (${winPct}%)` },
          { label: "ITM", value: `${itmPct}%` },
          { label: "Total Buy-in", value: formatCents(stats.totalBuyInCents) },
          { label: "Total Payout", value: formatCents(stats.totalPayoutCents) },
          { label: "ROI", value: `${roi}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-slate-900 rounded-xl p-4 border border-slate-800"
          >
            <p className="text-slate-400 text-sm">{s.label}</p>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold mb-4">History</h2>
      {history.length === 0 ? (
        <p className="text-slate-400">No tournament history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h, i) => (
            <div
              key={i}
              className="bg-slate-900 rounded-lg p-3 border border-slate-800 flex justify-between"
            >
              <div>
                <p className="font-medium">{h.tournament.name}</p>
                <p className="text-slate-400 text-sm">
                  Buy-in: {formatCents(h.tournament.buyInCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">#{h.finishPosition ?? "—"}</p>
                {h.payoutCents > 0 && (
                  <p className="text-emerald-400 text-sm">
                    +{formatCents(h.payoutCents)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
