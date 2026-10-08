"use client";

import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";
import { formatCents } from "@/lib/utils";
import type { AdminAccountRow } from "@/lib/adminAccounts";
import type { SiteUsage, UsagePoint } from "@/lib/adminUsage";

function formatWhen(iso: string | null, withTime = false): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime
      ? { hour: "numeric", minute: "2-digit" }
      : {}),
  });
}

function BarSeries({
  title,
  points,
}: {
  title: string;
  points: UsagePoint[];
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
      <h3 className="text-sm font-medium text-slate-300 mb-3">{title}</h3>
      <div className="space-y-1.5">
        {points.map((p) => (
          <div key={p.key} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-slate-500 tabular-nums">
              {p.label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums text-slate-300">
              {p.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<AdminAccountRow[]>([]);
  const [usage, setUsage] = useState<SiteUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminAccountRow | null>(
    null
  );
  const [deleteTyped, setDeleteTyped] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/overview");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("Could not load admin data.");
      setLoading(false);
      return;
    }
    setUsers(data.users ?? []);
    setUsage(data.usage ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendInvite() {
    setInviteBusy(true);
    setInviteMessage("");
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteBusy(false);
    if (!res.ok) {
      setInviteMessage(data.error || "Could not send invite");
      return;
    }
    setInviteEmail("");
    const sentNote =
      data.sent === "skipped"
        ? "Account ready. Email skipped in this environment — use the web console magic-link URL."
        : data.status === "exists"
          ? "They already had an account. A sign-in link was emailed."
          : "Invite sent. They can join without the friends-only code.";
    setInviteMessage(sentNote);
    await load();
  }

  async function setStatus(userId: string, accountStatus: "FREE" | "PAID") {
    setStatusBusyId(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus }),
    });
    setStatusBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not update status");
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, accountStatus } : u))
    );
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (deleteTyped.trim().toLowerCase() !== pendingDelete.email) return;
    setDeleteBusy(true);
    const res = await fetch(`/api/admin/users/${pendingDelete.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setDeleteBusy(false);
    if (!res.ok) {
      alert(data.error || "Could not remove account");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== pendingDelete.id));
    setPendingDelete(null);
    setDeleteTyped("");
    await load();
  }

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BrandLockup />
          <div className="flex gap-3 shrink-0">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              Dashboard
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="text-slate-400 text-sm mt-1">
          {session?.user?.email} · site owner tools. Ledger cents only — no
          billing.
        </p>
      </header>

      {loading && <p className="text-slate-400">Loading…</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {usage && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Site activity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Users", value: usage.totals.users },
              { label: "Game nights", value: usage.totals.gameNights },
              { label: "Tournaments", value: usage.totals.tournaments },
              { label: "Hands dealt", value: usage.totals.hands },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-slate-900 rounded-xl p-4 border border-slate-800"
              >
                <p className="text-slate-400 text-sm">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Users today",
                value: usage.usersToday,
                hint: `Yesterday ${usage.usersYesterday}`,
              },
              {
                label: "Users this month",
                value: usage.usersThisMonth,
                hint: `Last month ${usage.usersLastMonth}`,
              },
              {
                label: "Nights this month",
                value: usage.gameNightsThisMonth,
                hint: `${usage.tournamentsThisMonth} tournaments`,
              },
              {
                label: "Hands this month",
                value: usage.handsThisMonth,
                hint: "Dealt, no cards stored",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-slate-900 rounded-xl p-4 border border-slate-800"
              >
                <p className="text-slate-400 text-sm">{s.label}</p>
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.hint}</p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <BarSeries title="Users / day (14d)" points={usage.daily.users} />
            <BarSeries
              title="Users / month (12mo)"
              points={usage.monthly.users}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <BarSeries
              title="Game nights / day"
              points={usage.daily.gameNights}
            />
            <BarSeries
              title="Tournaments / day"
              points={usage.daily.tournaments}
            />
            <BarSeries title="Hands / day" points={usage.daily.hands} />
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Invite a player</h2>
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
          <p className="text-slate-400 text-sm mb-4">
            They get a Poker Night email with a sign-in link. That creates their
            account — they do not need the friends-only code.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void sendInvite()}
              disabled={inviteBusy || !inviteEmail.trim()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-medium disabled:opacity-50"
            >
              {inviteBusy ? "Sending…" : "Send invite"}
            </button>
          </div>
          {inviteMessage && (
            <p className="text-sm text-amber-300 mt-3">{inviteMessage}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Accounts</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Last login</th>
                <th className="px-3 py-2 font-medium">Logins</th>
                <th className="px-3 py-2 font-medium">Nights</th>
                <th className="px-3 py-2 font-medium">Tournaments</th>
                <th className="px-3 py-2 font-medium">Ledger</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-slate-400 text-xs">{u.email}</p>
                    {u.role === "ADMIN" && (
                      <p className="text-amber-400/80 text-[10px] uppercase tracking-wide mt-0.5">
                        Admin
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                    {formatWhen(u.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                    {formatWhen(u.lastLoginAt, true)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{u.loginCount}</td>
                  <td className="px-3 py-3 tabular-nums">{u.gameNights}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {u.tournamentsPlayed}
                  </td>
                  <td className="px-3 py-3 text-slate-400 whitespace-nowrap">
                    {formatCents(u.totalPayoutCents - u.totalBuyInCents)}
                    <span className="block text-[10px] text-slate-600">
                      in {formatCents(u.totalBuyInCents)} / out{" "}
                      {formatCents(u.totalPayoutCents)}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1">
                      {(["FREE", "PAID"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={statusBusyId === u.id}
                          onClick={() => void setStatus(u.id, status)}
                          className={`px-2 py-1 rounded text-xs font-medium border ${
                            u.accountStatus === status
                              ? "bg-emerald-600 border-emerald-500 text-white"
                              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {status === "FREE" ? "Free" : "Paid"}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {u.canDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingDelete(u);
                          setDeleteTyped("");
                        }}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-8 text-center text-slate-400"
                  >
                    No accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pendingDelete && (
        <div className="fixed inset-0 z-20 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800 p-6">
            <h3 className="text-lg font-semibold mb-2">Remove account</h3>
            <p className="text-slate-400 text-sm mb-4">
              This cannot be undone. Type{" "}
              <span className="text-slate-200 font-medium">
                {pendingDelete.email}
              </span>{" "}
              to confirm.
            </p>
            <input
              type="email"
              value={deleteTyped}
              onChange={(e) => setDeleteTyped(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-red-500 focus:outline-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteTyped("");
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleteBusy ||
                  deleteTyped.trim().toLowerCase() !== pendingDelete.email
                }
                onClick={() => void confirmDelete()}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm font-medium disabled:opacity-40"
              >
                {deleteBusy ? "Removing…" : "Remove account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
