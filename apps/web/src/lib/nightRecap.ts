import { prisma } from "@poker/db";
import {
  computeNightLedger,
  computeSettleTransfers,
  normalizeGamePayouts,
  parseSettleUpMethods,
  type NightLedgerEntry,
  type SettleTransfer,
  type SettleUpMethod,
} from "@poker/protocol";
import { sendAppEmail } from "./mailer";
import { formatCents, LEDGER_DISCLAIMER } from "./utils";
import {
  absoluteAppUrl,
  clubEmailHtml,
  emailBody,
  emailCta,
  emailFinePrint,
  escapeHtml,
} from "./emailLayout";
import {
  formatSettleUpMethod,
  SETTLE_UP_DISCLAIMER,
} from "./settleUp";
import { formatSessionLabelShort } from "./labels";

export type NightRecapStats = {
  tournamentCount: number;
  totalHands: number;
  winners: { displayName: string; gameNumber: number; payoutCents: number }[];
  itm: { displayName: string; count: number }[];
};

export type NightRecapPayload = {
  nightName: string;
  ledger: NightLedgerEntry[];
  transfers: SettleTransfer[];
  settleUpByUserId: Record<string, SettleUpMethod[]>;
  stats: NightRecapStats;
  createUrl: string;
};

export function buildNightRecapHtml(payload: NightRecapPayload): string {
  const settlementHtml = renderSettlementBlock(payload);
  const statsHtml = renderStatsBlock(payload.stats);
  const night = escapeHtml(payload.nightName);

  return clubEmailHtml({
    heading: "Chips down!",
    innerHtml: [
      emailBody(
        `What a night at <strong style="color:#e2e8f0;">${night}</strong>. Time to settle the ledger — then bask in the glory.`
      ),
      settlementHtml,
      statsHtml,
      emailCta(payload.createUrl, "Run your own game night"),
      emailFinePrint(SETTLE_UP_DISCLAIMER),
      emailFinePrint(LEDGER_DISCLAIMER),
    ].join("\n    "),
  });
}

export function buildNightRecapText(payload: NightRecapPayload): string {
  const lines: string[] = [
    `Chips down! ${payload.nightName}`,
    "",
    "— Night settlement —",
    "Friends settle off-site. This site never moves money.",
  ];

  for (const row of payload.ledger) {
    const sign = row.netCents >= 0 ? "+" : "";
    lines.push(
      `${row.displayName}: ${sign}${formatCents(row.netCents)} (paid ${formatCents(row.totalBuyInCents)}, won ${formatCents(row.totalPayoutCents)})`
    );
  }

  if (payload.transfers.length > 0) {
    lines.push("", "Suggested pay-outs:");
    for (const t of payload.transfers) {
      lines.push(
        `${t.fromDisplayName} → ${t.toDisplayName}: ${formatCents(t.amountCents)}`
      );
      const methods = payload.settleUpByUserId[t.toUserId] ?? [];
      if (methods.length > 0) {
        lines.push(
          `  Pay ${t.toDisplayName} via: ${methods.map(formatSettleUpMethod).join("; ")}`
        );
      }
    }
  }

  const owed = payload.ledger.filter((r) => r.netCents > 0);
  if (owed.length > 0) {
    lines.push("", "How to pay winners:");
    for (const row of owed) {
      const methods = payload.settleUpByUserId[row.userId] ?? [];
      if (methods.length === 0) {
        lines.push(`${row.displayName}: no settle-up method on profile yet`);
      } else {
        lines.push(
          `${row.displayName}: ${methods.map(formatSettleUpMethod).join("; ")}`
        );
      }
    }
  }

  lines.push("", "— Night highlights —");
  lines.push(
    `Tournaments: ${payload.stats.tournamentCount}`,
    `Hands dealt: ${payload.stats.totalHands}`
  );
  for (const w of payload.stats.winners) {
    lines.push(
      `${formatSessionLabelShort(w.gameNumber)} winner: ${w.displayName} (${formatCents(w.payoutCents)})`
    );
  }
  if (payload.stats.itm.length > 0) {
    lines.push(
      `ITM: ${payload.stats.itm.map((r) => `${r.displayName}×${r.count}`).join(", ")}`
    );
  }

  lines.push(
    "",
    `Run your own game night: ${payload.createUrl}`,
    SETTLE_UP_DISCLAIMER,
    LEDGER_DISCLAIMER
  );
  return lines.join("\n");
}

function renderSettlementBlock(payload: NightRecapPayload): string {
  const rows = payload.ledger
    .map((row) => {
      const color = row.netCents >= 0 ? "#34d399" : "#f87171";
      const sign = row.netCents >= 0 ? "+" : "";
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #334155;color:#e2e8f0;">${escapeHtml(row.displayName)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #334155;text-align:right;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:${color};font-weight:600;">${sign}${escapeHtml(formatCents(row.netCents))}</td>
      </tr>`;
    })
    .join("");

  const transferLines =
    payload.transfers.length === 0
      ? `<p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">Everyone's even — nothing to settle.</p>`
      : `<p style="color:#94a3b8;font-size:13px;margin:16px 0 8px;">Suggested pay-outs</p>
    <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:14px;line-height:1.6;">
      ${payload.transfers
        .map((t) => {
          const methods = payload.settleUpByUserId[t.toUserId] ?? [];
          const how =
            methods.length > 0
              ? `<br/><span style="color:#94a3b8;font-size:12px;">Pay ${escapeHtml(t.toDisplayName)} via ${methods.map((m) => escapeHtml(formatSettleUpMethod(m))).join(" · ")}</span>`
              : `<br/><span style="color:#64748b;font-size:12px;">${escapeHtml(t.toDisplayName)} hasn't set a settle-up method yet — ask them.</span>`;
          return `<li><strong style="color:#e2e8f0;">${escapeHtml(t.fromDisplayName)}</strong> pays <strong style="color:#e2e8f0;">${escapeHtml(t.toDisplayName)}</strong> <span style="color:#fbbf24;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(formatCents(t.amountCents))}</span>${how}</li>`;
        })
        .join("")}
    </ul>`;

  const owedExtra = renderOwedMethods(payload);

  return `<div style="margin:24px 0;padding:16px;border-radius:12px;background:#0f172a;border:1px solid #334155;">
      <h2 style="margin:0 0 4px;font-size:16px;color:#f8fafc;">Night settlement</h2>
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">Ledger balances for friends to settle off-site. We never move money.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      ${transferLines}
      ${owedExtra}
    </div>`;
}

function renderOwedMethods(payload: NightRecapPayload): string {
  const owed = payload.ledger.filter((r) => r.netCents > 0);
  if (owed.length === 0) return "";

  const items = owed
    .map((row) => {
      const methods = payload.settleUpByUserId[row.userId] ?? [];
      const detail =
        methods.length > 0
          ? methods.map((m) => escapeHtml(formatSettleUpMethod(m))).join(" · ")
          : `<span style="color:#64748b;">No method on profile yet</span>`;
      return `<li style="margin:0 0 6px;"><strong style="color:#e2e8f0;">${escapeHtml(row.displayName)}</strong> is owed <span style="color:#34d399;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(formatCents(row.netCents))}</span><br/><span style="color:#94a3b8;font-size:12px;">${detail}</span></li>`;
    })
    .join("");

  return `<p style="color:#94a3b8;font-size:13px;margin:16px 0 8px;">How to pay who is owed</p>
    <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:14px;line-height:1.5;">${items}</ul>`;
}

function renderStatsBlock(stats: NightRecapStats): string {
  const winnerLines =
    stats.winners.length === 0
      ? `<li>No finished tournaments — just good company.</li>`
      : stats.winners
          .map(
            (w) =>
              `<li><strong style="color:#fbbf24;">${escapeHtml(formatSessionLabelShort(w.gameNumber))}</strong> — ${escapeHtml(w.displayName)} stacked for ${escapeHtml(formatCents(w.payoutCents))}</li>`
          )
          .join("");

  const itmLine =
    stats.itm.length > 0
      ? `<p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">In the money: ${stats.itm
          .map(
            (r) =>
              `${escapeHtml(r.displayName)}${r.count > 1 ? ` (×${r.count})` : ""}`
          )
          .join(", ")}</p>`
      : "";

  return `<div style="margin:24px 0;">
      <h2 style="margin:0 0 8px;font-size:16px;color:#f8fafc;">Night highlights</h2>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 8px;">
        <strong style="color:#e2e8f0;">${stats.tournamentCount}</strong> tournament${stats.tournamentCount === 1 ? "" : "s"}
        · <strong style="color:#e2e8f0;">${stats.totalHands}</strong> hand${stats.totalHands === 1 ? "" : "s"} dealt
      </p>
      <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:14px;line-height:1.6;">
        ${winnerLines}
      </ul>
      ${itmLine}
    </div>`;
}

export async function buildNightRecapPayload(
  tournamentId: string
): Promise<NightRecapPayload | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      host: {
        select: {
          id: true,
          displayName: true,
          email: true,
          settleUpMethods: true,
        },
      },
      players: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              settleUpMethods: true,
            },
          },
        },
      },
      games: {
        where: { status: "FINISHED" },
        orderBy: { gameNumber: "asc" },
        include: {
          results: {
            include: {
              user: { select: { id: true, displayName: true } },
            },
            orderBy: { finishPosition: "asc" },
          },
        },
      },
    },
  });

  if (!tournament) return null;

  const roster = tournament.players.map((p) => ({
    userId: p.userId,
    displayName: p.user.displayName,
  }));
  const rosterUserIds = roster.map((p) => p.userId);

  const ledger = computeNightLedger(
    tournament.buyInCents,
    roster,
    tournament.games.map((g) =>
      normalizeGamePayouts(
        g.prizePoolCents,
        g.results.map((r) => ({
          userId: r.userId,
          finishPosition: r.finishPosition,
          payoutCents: r.payoutCents,
        })),
        rosterUserIds
      )
    )
  );

  const transfers = computeSettleTransfers(ledger);

  const settleUpByUserId: Record<string, SettleUpMethod[]> = {};
  for (const p of tournament.players) {
    settleUpByUserId[p.userId] = parseSettleUpMethods(p.user.settleUpMethods);
  }
  if (!settleUpByUserId[tournament.host.id]) {
    settleUpByUserId[tournament.host.id] = parseSettleUpMethods(
      tournament.host.settleUpMethods
    );
  }

  const winners = tournament.games.map((g) => {
    const winner = g.results.find((r) => r.finishPosition === 1);
    return {
      displayName: winner?.user.displayName ?? "Unknown",
      gameNumber: g.gameNumber,
      payoutCents: winner?.payoutCents ?? 0,
    };
  });

  const itmCounts = new Map<string, { displayName: string; count: number }>();
  for (const g of tournament.games) {
    for (const r of g.results) {
      if (r.payoutCents <= 0) continue;
      const existing = itmCounts.get(r.userId);
      if (existing) existing.count += 1;
      else {
        itmCounts.set(r.userId, {
          displayName: r.user.displayName,
          count: 1,
        });
      }
    }
  }

  return {
    nightName: tournament.name,
    ledger,
    transfers,
    settleUpByUserId,
    stats: {
      tournamentCount: tournament.games.length,
      totalHands: tournament.games.reduce((sum, g) => sum + g.handsPlayed, 0),
      winners,
      itm: [...itmCounts.values()].sort((a, b) => b.count - a.count),
    },
    createUrl: absoluteAppUrl("/dashboard"),
  };
}

export type NightRecapSendResult = {
  recipients: string[];
  results: { email: string; status: "sent" | "skipped"; id?: string | null }[];
  previewHtml: string;
};

/**
 * Send settlement-first night recap to all participants (and host).
 * Call after host closes the night (`action: "close"` → FINISHED).
 */
export async function sendNightRecapEmail(
  tournamentId: string
): Promise<NightRecapSendResult | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      host: { select: { email: true, displayName: true } },
      players: {
        include: { user: { select: { email: true } } },
      },
    },
  });
  if (!tournament) return null;

  const payload = await buildNightRecapPayload(tournamentId);
  if (!payload) return null;

  const html = buildNightRecapHtml(payload);
  const text = buildNightRecapText(payload);
  const subject = `Settle up — ${tournament.name} recap`;

  const emails = new Set<string>();
  for (const p of tournament.players) {
    const email = p.user.email.trim().toLowerCase();
    if (email) emails.add(email);
  }
  const hostEmail = tournament.host.email.trim().toLowerCase();
  if (hostEmail) emails.add(hostEmail);

  const recipients = [...emails];
  const results: NightRecapSendResult["results"] = [];

  for (const email of recipients) {
    const sent = await sendAppEmail({
      to: email,
      subject,
      html,
      text,
    });
    if (sent.skipped) {
      results.push({ email, status: "skipped", id: null });
    } else {
      results.push({ email, status: "sent", id: sent.id });
    }
  }

  return { recipients, results, previewHtml: html };
}
