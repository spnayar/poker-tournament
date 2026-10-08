import { prisma } from "@poker/db";
import { compareFiveCardHands } from "@poker/game-engine";
import {
  computeNightLedger,
  computeSettleTransfers,
  normalizeGamePayouts,
  parseGameFunStats,
  parseSettleUpMethods,
  type Card,
  type GameFunStats,
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

export type NightRecapNamedCount = {
  displayName: string;
  count: number;
};

export type NightRecapStats = {
  tournamentCount: number;
  totalHands: number;
  winners: {
    displayName: string;
    gameNumber: number;
    payoutCents: number;
    buyInCents: number;
    netCents: number;
  }[];
  itm: NightRecapNamedCount[];
  /** Hands won across the night (any pot share counts as a hand won). */
  handsWon: NightRecapNamedCount[];
  /** Players eliminated by each person. */
  knockouts: NightRecapNamedCount[];
  largestPot: {
    amountChips: number;
    winnerNames: string[];
    gameNumber: number;
    handNumber: number;
  } | null;
  bestHand: {
    displayName: string;
    handName: string;
    cards: Card[];
    gameNumber: number;
    handNumber: number;
  } | null;
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
    const netSign = w.netCents >= 0 ? "+" : "";
    lines.push(
      `${w.displayName} won ${formatSessionLabelShort(w.gameNumber)}, ${netSign}${formatCents(w.netCents)} (${formatCents(w.payoutCents)} payout on a ${formatCents(w.buyInCents)} buy-in)`
    );
  }
  if (payload.stats.itm.length > 0) {
    lines.push(
      `ITM: ${payload.stats.itm.map((r) => `${r.displayName}×${r.count}`).join(", ")}`
    );
  }
  if (payload.stats.bestHand) {
    const bh = payload.stats.bestHand;
    lines.push(
      `Best hand of the night: ${bh.displayName} — ${bh.handName} (${formatCardsPlain(bh.cards)})`
    );
  }
  if (payload.stats.largestPot) {
    const lp = payload.stats.largestPot;
    lines.push(
      `Largest pot: ${formatChipCount(lp.amountChips)} chips (${lp.winnerNames.join(" & ")})`
    );
  }
  if (payload.stats.handsWon.length > 0) {
    lines.push(
      `Hands won: ${payload.stats.handsWon
        .map((r) => `${r.displayName} ${r.count}`)
        .join(", ")}`
    );
  }
  if (payload.stats.knockouts.length > 0) {
    lines.push(
      `Most knockouts: ${payload.stats.knockouts
        .map((r) => `${r.displayName} ${r.count}`)
        .join(", ")}`
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

function formatChipCount(n: number): string {
  return n.toLocaleString("en-US");
}

const SUIT_SYMBOLS: Record<string, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

/** Plain-text card list for email (showdown five-card hands only). */
export function formatCardsPlain(cards: Card[]): string {
  return cards
    .map((card) => {
      const rank = card.length === 2 ? card[0]! : card.slice(0, -1);
      const suit = card[card.length - 1]!;
      return `${rank}${SUIT_SYMBOLS[suit] ?? suit}`;
    })
    .join(" ");
}

function namedCountLine(rows: NightRecapNamedCount[]): string {
  return rows
    .map(
      (r) =>
        `<strong style="color:#e2e8f0;">${escapeHtml(r.displayName)}</strong> ${r.count}`
    )
    .join(" · ");
}

function renderStatsBlock(stats: NightRecapStats): string {
  const winnerLines =
    stats.winners.length === 0
      ? `<li>No finished tournaments — just good company.</li>`
      : stats.winners
          .map((w) => {
            const netSign = w.netCents >= 0 ? "+" : "";
            const netColor = w.netCents >= 0 ? "#34d399" : "#f87171";
            return `<li><strong style="color:#e2e8f0;">${escapeHtml(w.displayName)}</strong> won <strong style="color:#fbbf24;">${escapeHtml(formatSessionLabelShort(w.gameNumber))}</strong>, <span style="color:${netColor};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${netSign}${escapeHtml(formatCents(w.netCents))}</span> <span style="color:#94a3b8;">(${escapeHtml(formatCents(w.payoutCents))} payout on a ${escapeHtml(formatCents(w.buyInCents))} buy-in)</span></li>`;
          })
          .join("");

  const funFacts: string[] = [];
  if (stats.bestHand) {
    const bh = stats.bestHand;
    funFacts.push(
      `<li><span style="color:#94a3b8;">Best hand of the night</span><br/><strong style="color:#e2e8f0;">${escapeHtml(bh.displayName)}</strong> — ${escapeHtml(bh.handName)} <span style="color:#fbbf24;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(formatCardsPlain(bh.cards))}</span></li>`
    );
  }
  if (stats.largestPot) {
    const lp = stats.largestPot;
    funFacts.push(
      `<li><span style="color:#94a3b8;">Largest pot</span><br/><strong style="color:#fbbf24;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(formatChipCount(lp.amountChips))}</strong> chips — ${escapeHtml(lp.winnerNames.join(" & "))}</li>`
    );
  }
  if (stats.handsWon.length > 0) {
    funFacts.push(
      `<li><span style="color:#94a3b8;">Hands won</span><br/>${namedCountLine(stats.handsWon)}</li>`
    );
  }
  if (stats.knockouts.length > 0) {
    funFacts.push(
      `<li><span style="color:#94a3b8;">Knockout kings</span><br/>${namedCountLine(stats.knockouts)}</li>`
    );
  }

  const itmLine =
    stats.itm.length > 0
      ? `<p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">In the money: ${stats.itm
          .map(
            (r) =>
              `${escapeHtml(r.displayName)}${r.count > 1 ? ` (×${r.count})` : ""}`
          )
          .join(", ")}</p>`
      : "";

  const funFactsBlock =
    funFacts.length > 0
      ? `<p style="color:#94a3b8;font-size:13px;margin:16px 0 8px;">Fun facts</p>
      <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:14px;line-height:1.7;">
        ${funFacts.join("")}
      </ul>`
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
      ${funFactsBlock}
    </div>`;
}

function sortNamedCounts(
  map: Map<string, NightRecapNamedCount>
): NightRecapNamedCount[] {
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName)
  );
}

function addCounts(
  target: Map<string, NightRecapNamedCount>,
  byUserId: Record<string, number>,
  nameByUserId: Map<string, string>
): void {
  for (const [userId, count] of Object.entries(byUserId)) {
    if (count <= 0) continue;
    const existing = target.get(userId);
    if (existing) existing.count += count;
    else {
      target.set(userId, {
        displayName: nameByUserId.get(userId) ?? "Player",
        count,
      });
    }
  }
}

/** Merge per-game funStats into night-level highlight fields. */
export function aggregateNightFunFacts(
  games: { gameNumber: number; funStats: unknown }[],
  nameByUserId: Map<string, string>
): Pick<
  NightRecapStats,
  "handsWon" | "knockouts" | "largestPot" | "bestHand"
> {
  const handsWon = new Map<string, NightRecapNamedCount>();
  const knockouts = new Map<string, NightRecapNamedCount>();
  let largestPot: NightRecapStats["largestPot"] = null;
  let bestHand: NightRecapStats["bestHand"] = null;
  let bestCards: Card[] | null = null;

  for (const game of games) {
    const stats: GameFunStats = parseGameFunStats(game.funStats);
    addCounts(handsWon, stats.handsWonByUserId, nameByUserId);
    addCounts(knockouts, stats.knockoutsByUserId, nameByUserId);

    if (
      stats.largestPot &&
      stats.largestPot.amountChips >
        (largestPot?.amountChips ?? 0)
    ) {
      largestPot = {
        amountChips: stats.largestPot.amountChips,
        winnerNames: stats.largestPot.winnerUserIds.map(
          (id) => nameByUserId.get(id) ?? "Player"
        ),
        gameNumber: game.gameNumber,
        handNumber: stats.largestPot.handNumber,
      };
    }

    if (stats.bestHand) {
      const cards = stats.bestHand.cards;
      if (
        !bestCards ||
        compareFiveCardHands(cards, bestCards) > 0
      ) {
        bestCards = cards;
        bestHand = {
          displayName:
            nameByUserId.get(stats.bestHand.userId) ?? "Player",
          handName: stats.bestHand.handName,
          cards: [...cards],
          gameNumber: game.gameNumber,
          handNumber: stats.bestHand.handNumber,
        };
      }
    }
  }

  return {
    handsWon: sortNamedCounts(handsWon),
    knockouts: sortNamedCounts(knockouts),
    largestPot,
    bestHand,
  };
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
    const payoutCents = winner?.payoutCents ?? 0;
    const buyInCents = tournament.buyInCents;
    return {
      displayName: winner?.user.displayName ?? "Unknown",
      gameNumber: g.gameNumber,
      payoutCents,
      buyInCents,
      netCents: payoutCents - buyInCents,
    };
  });

  const itmCounts = new Map<string, NightRecapNamedCount>();
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

  const nameByUserId = new Map<string, string>();
  for (const p of tournament.players) {
    nameByUserId.set(p.userId, p.user.displayName);
  }
  nameByUserId.set(tournament.host.id, tournament.host.displayName);
  for (const g of tournament.games) {
    for (const r of g.results) {
      nameByUserId.set(r.userId, r.user.displayName);
    }
  }

  const funFacts = aggregateNightFunFacts(
    tournament.games.map((g) => ({
      gameNumber: g.gameNumber,
      funStats: g.funStats,
    })),
    nameByUserId
  );

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
      ...funFacts,
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
