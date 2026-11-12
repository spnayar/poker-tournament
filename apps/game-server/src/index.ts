import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../.env") });

import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { prisma, incrementHandsPlayed } from "@poker/db";
import {
  TableEngine,
  mapTableFunStatsToGame,
  type TableSnapshot,
} from "@poker/game-engine";
import {
  ClientEvents,
  ServerEvents,
  computePayoutsFromPercents,
  PlayerActionSchema,
  SeatIdPayloadSchema,
  resolveBlindLevels,
  resolveActionTimerSeconds,
  shouldResumeOnReconnect,
  applySocketAwayFlags,
  ChopTournamentSchema,
  rankChopFinish,
  validateChopShares,
  type BlindLevel,
  type TableState,
} from "@poker/protocol";
import {
  GAME_SERVER_SECRET_HEADER,
  gameServerBootSecretError,
  resolveGameServerSecret,
  resolveJwtSecret,
  secretsEqual,
} from "@poker/protocol/server";
import { BlindTimer, type BlindTimerSnapshot } from "./blindTimer";

const bootError = gameServerBootSecretError({
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  gameServerSecret: process.env.GAME_SERVER_SECRET,
});
if (bootError) {
  console.error(bootError);
  process.exit(1);
}

const PORT = parseInt(
  process.env.PORT ?? process.env.GAME_SERVER_PORT ?? "3001",
  10
);
const JWT_SECRET = resolveJwtSecret({
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
});
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const SNAPSHOT_TTL_SEC = 60 * 60 * 24 * 7;
/** Brief reconnect window so socket.io blips don't immediately fold a seat. */
const DISCONNECT_GRACE_MS = 8_000;
/** Current actor drop: fold quickly so the hand does not stall on Waiting. */
const DISCONNECT_ACTOR_GRACE_MS = 1_500;

/** Allow both apex and www (and optional CORS_ORIGINS) so domain forwarding doesn't break sockets. */
function resolveCorsOrigins(): string[] {
  const configured = [
    process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    ...(process.env.CORS_ORIGINS ?? "").split(","),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  const origins = new Set<string>();
  for (const origin of configured) {
    origins.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname.startsWith("www.")) {
        origins.add(`${url.protocol}//${url.hostname.slice(4)}`);
      } else if (url.hostname.includes(".")) {
        origins.add(`${url.protocol}//www.${url.hostname}`);
      }
    } catch {
      // ignore invalid origin strings
    }
  }
  return [...origins];
}

const CORS_ORIGINS = resolveCorsOrigins();

const redis = new Redis(REDIS_URL);
const app: express.Application = express();
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ["GET", "POST"],
  },
});

interface TournamentRoom {
  table: TableEngine;
  playerSockets: Map<string, string>;
  /** Players who have JOINed this running game at least once (Away only after this). */
  seenPlayers: Set<string>;
  seatByUserId: Map<string, number>;
  buyInCents: number;
  gameId: string;
  gameNumber: number;
  payoutPercents: number[];
  hostUserId: string;
  blindLevels: BlindLevel[];
  blindTimer: BlindTimer;
  /** Active session length; 0 = off. Host can disable without changing DB. */
  actionTimerSeconds: number;
  /** Original night setting — used when host resets after turning the timer off. */
  actionTimerConfiguredSeconds: number;
  actionTimer: ReturnType<typeof setTimeout> | null;
  actionDeadlineAt: number | null;
  actionTimerPaused: boolean;
  actionTimerPausedRemainingMs: number | null;
  actionTimerGeneration: number;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  syncSeq: number;
}

const rooms = new Map<string, TournamentRoom>();

interface JwtPayload {
  userId: string;
  email: string;
  displayName: string;
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function snapshotKey(tournamentId: string, gameNumber: number): string {
  return `tournament:${tournamentId}:game:${gameNumber}:snapshot`;
}

function begunKey(tournamentId: string, gameNumber: number): string {
  return `tournament:${tournamentId}:game:${gameNumber}:begun`;
}

function beginLockKey(tournamentId: string, gameNumber: number): string {
  return `tournament:${tournamentId}:game:${gameNumber}:begin-lock`;
}

function blindTimerKey(tournamentId: string, gameNumber: number): string {
  return `tournament:${tournamentId}:game:${gameNumber}:blind-timer`;
}

type TournamentSettings = {
  buyInCents: number;
  payoutPercents: unknown;
  hostUserId: string;
  startingChips: number;
  blindLevels: unknown;
  blindPace: string;
  blindPreset: string;
  blindLevelMinutes: number;
  actionTimerSeconds?: number | null;
};

function getBlindLevelsForTournament(tournament: TournamentSettings): BlindLevel[] {
  return resolveBlindLevels(tournament.startingChips, {
    blindLevels: tournament.blindLevels,
    blindPace: tournament.blindPace,
    blindPreset: tournament.blindPreset,
  });
}

async function getRunningGame(tournamentId: string) {
  return prisma.game.findFirst({
    where: { tournamentId, status: "RUNNING" },
    orderBy: { gameNumber: "desc" },
  });
}

async function persistRoom(tournamentId: string, room: TournamentRoom): Promise<void> {
  const snapshot = room.table.toSnapshot();
  await redis.set(
    snapshotKey(tournamentId, room.gameNumber),
    JSON.stringify(snapshot),
    "EX",
    SNAPSHOT_TTL_SEC
  );
  await redis.set(
    blindTimerKey(tournamentId, room.gameNumber),
    JSON.stringify(room.blindTimer.toSnapshot()),
    "EX",
    SNAPSHOT_TTL_SEC
  );
}

function broadcastBlindTimer(tournamentId: string, room: TournamentRoom): void {
  const snap = room.table.toSnapshot();
  const timerState = room.blindTimer.getPublicState(
    snap.smallBlind,
    snap.bigBlind,
    snap.blindLevel
  );
  io.to(`tournament:${tournamentId}`).emit(ServerEvents.BLIND_TIMER, {
    ...timerState,
    hostUserId: room.hostUserId,
  });
}

async function applyPendingBlindIncrease(room: TournamentRoom): Promise<boolean> {
  if (!room.blindTimer.getIncreasePending()) return false;
  const applied = room.table.applyScheduledBlindIncrease();
  if (applied) {
    room.blindTimer.onLevelApplied(room.table.toSnapshot().blindLevel);
    return true;
  }
  room.blindTimer.clearIncreasePending();
  return false;
}

function clearActionTimer(room: TournamentRoom): void {
  if (room.actionTimer) {
    clearTimeout(room.actionTimer);
    room.actionTimer = null;
  }
  room.actionDeadlineAt = null;
  room.actionTimerPaused = false;
  room.actionTimerPausedRemainingMs = null;
  room.actionTimerGeneration += 1;
}

function isBettingPhase(phase: string): boolean {
  return (
    phase === "preflop" ||
    phase === "flop" ||
    phase === "turn" ||
    phase === "river"
  );
}

function publicTableState(room: TournamentRoom): TableState {
  const state = room.table.getPublicState();
  room.syncSeq += 1;
  return {
    ...state,
    actionDeadlineAt: room.actionDeadlineAt,
    actionTimerSeconds: room.actionTimerSeconds,
    actionTimerPaused: room.actionTimerPaused,
    actionTimerPausedRemainingMs: room.actionTimerPausedRemainingMs,
    syncSeq: room.syncSeq,
    seats: applySocketAwayFlags(
      state.seats,
      room.seenPlayers,
      room.playerSockets.keys()
    ),
  };
}

function armActionTimer(
  tournamentId: string,
  room: TournamentRoom,
  durationMs?: number
): void {
  clearActionTimer(room);

  if (room.actionTimerSeconds <= 0) {
    return;
  }

  let state = room.table.getPublicState();
  if (!isBettingPhase(state.phase) || state.currentActorSeat === null) {
    return;
  }

  if (room.table.isSkipped(state.currentActorSeat)) {
    room.table.resolveSkippedActors();
    state = room.table.getPublicState();
    if (!isBettingPhase(state.phase) || state.currentActorSeat === null) {
      return;
    }
  }

  const actorSeat = state.currentActorSeat;
  if (room.table.isSkipped(actorSeat)) {
    return;
  }

  const legal = room.table.getLegalActions(actorSeat);
  if (!legal) return;

  const timeoutMs =
    durationMs ?? Math.max(1_000, room.actionTimerSeconds * 1000);
  const handNumber = state.handNumber;
  const generation = room.actionTimerGeneration;
  room.actionDeadlineAt = Date.now() + timeoutMs;
  room.actionTimer = setTimeout(() => {
    void (async () => {
      if (room.actionTimerGeneration !== generation) return;
      const live = rooms.get(tournamentId);
      if (live !== room) return;

      const now = room.table.getPublicState();
      if (
        now.handNumber !== handNumber ||
        now.currentActorSeat !== actorSeat ||
        !isBettingPhase(now.phase)
      ) {
        return;
      }
      if (room.table.isSkipped(actorSeat)) return;

      // Timeout = check/fold for this hand only — not a sit-out.
      if (!room.table.applyActionTimeout(actorSeat)) return;
      await afterAction(tournamentId, room);
    })();
  }, timeoutMs);
}

function buildSeatMap(table: TableEngine): Map<string, number> {
  const map = new Map<string, number>();
  for (const seat of table.getPublicState().seats) {
    map.set(seat.userId, seat.seatId);
  }
  return map;
}

function buildRoom(
  table: TableEngine,
  tournament: TournamentSettings,
  game: { id: string; gameNumber: number },
  blindTimerSnapshot?: BlindTimerSnapshot
): TournamentRoom {
  const blindLevels = getBlindLevelsForTournament(tournament);
  const levelDurationMs = tournament.blindLevelMinutes * 60 * 1000;
  const actionTimerSeconds = resolveActionTimerSeconds(
    tournament.actionTimerSeconds
  );
  return {
    table,
    playerSockets: new Map(),
    seenPlayers: new Set(),
    seatByUserId: buildSeatMap(table),
    buyInCents: tournament.buyInCents,
    gameId: game.id,
    gameNumber: game.gameNumber,
    payoutPercents: tournament.payoutPercents as number[],
    hostUserId: tournament.hostUserId,
    blindLevels,
    blindTimer: new BlindTimer(blindLevels, levelDurationMs, blindTimerSnapshot),
    actionTimerSeconds,
    actionTimerConfiguredSeconds: actionTimerSeconds,
    actionTimer: null,
    actionDeadlineAt: null,
    actionTimerPaused: false,
    actionTimerPausedRemainingMs: null,
    actionTimerGeneration: 0,
    disconnectTimers: new Map(),
    syncSeq: 0,
  };
}

async function createRoomFromDb(tournamentId: string): Promise<TournamentRoom | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { players: { include: { user: true } } },
  });
  if (!tournament || tournament.status === "FINISHED") return null;

  const runningGame = await getRunningGame(tournamentId);
  if (!runningGame) return null;

  const alreadyBegun = await redis.get(
    begunKey(tournamentId, runningGame.gameNumber)
  );
  if (alreadyBegun) {
    console.error(
      `Game ${runningGame.gameNumber} in ${tournamentId} was begun but snapshot missing`
    );
    return null;
  }

  const table = new TableEngine({
    tournamentId,
    startingChips: tournament.startingChips,
    blindLevels: getBlindLevelsForTournament(tournament),
  });

  tournament.players.forEach((p, idx) => {
    table.addPlayer(
      idx,
      p.userId,
      p.user.displayName,
      p.user.avatarUrl,
      tournament.startingChips
    );
  });

  // Dealer + seat order are randomized when the host confirms ready — not on open.
  const room = buildRoom(table, tournament, runningGame);
  rooms.set(tournamentId, room);
  return room;
}

async function loadOrCreateRoom(tournamentId: string): Promise<TournamentRoom | null> {
  const existing = rooms.get(tournamentId);
  if (existing) return existing;

  const runningGame = await getRunningGame(tournamentId);
  if (!runningGame) return null;

  const snapshotRaw = await redis.get(
    snapshotKey(tournamentId, runningGame.gameNumber)
  );
  if (snapshotRaw) {
    try {
      const snapshot = JSON.parse(snapshotRaw) as TableSnapshot;
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
      });
      if (!tournament || tournament.status === "FINISHED") {
        await redis.del(snapshotKey(tournamentId, runningGame.gameNumber));
        return null;
      }

      const table = TableEngine.fromSnapshot(snapshot);
      table.resolveSkippedActors();
      const timerRaw = await redis.get(
        blindTimerKey(tournamentId, runningGame.gameNumber)
      );
      const timerSnapshot = timerRaw
        ? (JSON.parse(timerRaw) as BlindTimerSnapshot)
        : undefined;
      const room = buildRoom(table, tournament, runningGame, timerSnapshot);
      rooms.set(tournamentId, room);
      return room;
    } catch (err) {
      console.error("Failed to restore game snapshot:", err);
    }
  }

  return createRoomFromDb(tournamentId);
}

function emitToPlayer(
  room: TournamentRoom,
  userId: string,
  event: string,
  payload: unknown
): void {
  const socketId = room.playerSockets.get(userId);
  if (!socketId) return;
  const sock = io.sockets.sockets.get(socketId);
  if (sock) sock.emit(event, payload);
}

function sendPrivateStateToSocket(
  socket: import("socket.io").Socket,
  room: TournamentRoom,
  userId: string
): void {
  const seatId = room.seatByUserId.get(userId);
  if (seatId === undefined) return;

  const cards = room.table.getHoleCards(seatId);
  if (cards.length > 0) {
    socket.emit(ServerEvents.PLAYER_CARDS, cards);
  }

  const state = room.table.getPublicState();
  if (state.currentActorSeat === seatId) {
    const legal = room.table.getLegalActions(seatId);
    if (legal) {
      socket.emit(ServerEvents.ACTION_REQUIRED, legal);
    }
  }
}

function syncPlayerState(room: TournamentRoom, tournamentId: string): void {
  const state = publicTableState(room);
  io.to(`tournament:${tournamentId}`).emit(ServerEvents.TABLE_STATE, state);

  for (const [uid] of room.seatByUserId) {
    if (!room.playerSockets.has(uid)) continue;
    const seatId = room.seatByUserId.get(uid)!;
    const cards = room.table.getHoleCards(seatId);
    if (cards.length > 0) {
      emitToPlayer(room, uid, ServerEvents.PLAYER_CARDS, cards);
    }
  }

  const actorSeat = state.currentActorSeat;
  if (actorSeat !== null && !room.table.isSkipped(actorSeat)) {
    const actorUserId = [...room.seatByUserId.entries()].find(
      ([, seat]) => seat === actorSeat
    )?.[0];
    if (actorUserId) {
      const legal = room.table.getLegalActions(actorSeat);
      if (legal) {
        emitToPlayer(room, actorUserId, ServerEvents.ACTION_REQUIRED, legal);
      }
    }
  }
}

async function processTableEvents(
  room: TournamentRoom,
  tournamentId: string
): Promise<void> {
  const events = room.table.drainEvents();
  const handResults: unknown[] = [];

  for (const event of events) {
    switch (event.type) {
      case "deal":
        io.to(`tournament:${tournamentId}`).emit(ServerEvents.ANIM_DEAL, event.payload);
        break;
      case "reveal":
        io.to(`tournament:${tournamentId}`).emit(ServerEvents.ANIM_REVEAL, event.payload);
        break;
      case "chips":
        io.to(`tournament:${tournamentId}`).emit(ServerEvents.ANIM_CHIPS, event.payload);
        break;
      case "handResult":
        handResults.push(event.payload);
        break;
      case "state":
        break;
    }
  }

  syncPlayerState(room, tournamentId);

  for (const payload of handResults) {
    io.to(`tournament:${tournamentId}`).emit(ServerEvents.HAND_RESULT, payload);
  }

  await persistRoom(tournamentId, room);
}

function clearDisconnectTimer(room: TournamentRoom, userId: string): void {
  const timer = room.disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    room.disconnectTimers.delete(userId);
  }
}

function clearAllDisconnectTimers(room: TournamentRoom): void {
  for (const timer of room.disconnectTimers.values()) {
    clearTimeout(timer);
  }
  room.disconnectTimers.clear();
}

async function sitOutDisconnectedPlayer(
  tournamentId: string,
  room: TournamentRoom,
  userId: string
): Promise<void> {
  if (rooms.get(tournamentId) !== room) return;
  if (room.playerSockets.has(userId)) return;

  // Always the disconnected user's mapped seat — never currentActorSeat.
  const seatId = room.seatByUserId.get(userId);
  if (seatId === undefined) return;
  if (room.table.getSkipReason(seatId) === "host") {
    await afterAction(tournamentId, room);
    return;
  }

  room.table.setSkipped(seatId, true, "disconnect");
  await afterAction(tournamentId, room);
}

async function afterAction(tournamentId: string, room: TournamentRoom): Promise<void> {
  armActionTimer(tournamentId, room);
  await processTableEvents(room, tournamentId);

  const state = room.table.getPublicState();
  if (
    room.table.isTournamentComplete() &&
    state.phase === "hand-complete"
  ) {
    void finishGame(tournamentId, room);
  }
}

async function startNextHand(
  tournamentId: string,
  room: TournamentRoom
): Promise<boolean> {
  const state = room.table.getPublicState();
  const firstDeal =
    state.phase === "waiting" &&
    state.handNumber === 0 &&
    room.table.isSeatingReady();
  if (state.phase !== "hand-complete" && !firstDeal) return false;
  if (room.table.isTournamentComplete()) return false;

  await applyPendingBlindIncrease(room);
  const started = room.table.startHand();
  if (!started) return false;
  try {
    await incrementHandsPlayed(room.gameId);
  } catch (err) {
    console.error("Could not record hand count:", err);
  }

  if (room.table.getPublicState().handNumber === 1) {
    room.blindTimer.startLevelTimer();
    await redis.set(
      begunKey(tournamentId, room.gameNumber),
      "1",
      "EX",
      SNAPSHOT_TTL_SEC
    );
  }

  await afterAction(tournamentId, room);
  broadcastBlindTimer(tournamentId, room);

  return true;
}

/**
 * Open the live table for the current RUNNING game without dealing.
 * Host may sit alone and wait; seating/dealer randomize happens on ready.
 */
async function openTable(tournamentId: string): Promise<boolean> {
  let room = await loadOrCreateRoom(tournamentId);
  if (!room) {
    room = await createRoomFromDb(tournamentId);
  }
  if (!room) return false;

  await persistRoom(tournamentId, room);
  broadcastGameStarted(tournamentId, room);
  broadcastBlindTimer(tournamentId, room);
  syncPlayerState(room, tournamentId);
  return true;
}

/** Host ready: randomize seats + dealer. Does not deal. */
async function readySeating(tournamentId: string): Promise<boolean> {
  const room = await loadOrCreateRoom(tournamentId);
  if (!room) return false;
  const ok = room.table.prepareTournamentStart();
  if (!ok) return false;
  room.seatByUserId = buildSeatMap(room.table);
  await persistRoom(tournamentId, room);
  syncPlayerState(room, tournamentId);
  return true;
}

function preDealJoinOpen(room: TournamentRoom): boolean {
  const state = room.table.getPublicState();
  return (
    state.phase === "waiting" &&
    state.handNumber === 0 &&
    !room.table.isSeatingReady()
  );
}

async function seatLateJoiner(opts: {
  tournamentId: string;
  room: TournamentRoom;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}): Promise<number | null> {
  const { tournamentId, room, userId, displayName, avatarUrl } = opts;
  if (room.seatByUserId.has(userId) || room.table.hasPlayer(userId)) {
    return room.seatByUserId.get(userId) ?? null;
  }
  if (!preDealJoinOpen(room)) return null;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { maxPlayers: true, startingChips: true },
  });
  if (!tournament) return null;

  const seatId = room.table.findOpenSeat(tournament.maxPlayers);
  if (seatId === null) return null;

  room.table.addPlayer(
    seatId,
    userId,
    displayName,
    avatarUrl,
    tournament.startingChips
  );
  room.seatByUserId.set(userId, seatId);
  await persistRoom(tournamentId, room);
  syncPlayerState(room, tournamentId);
  return seatId;
}

async function clearGameRedis(tournamentId: string, gameNumber: number): Promise<void> {
  await redis.del(snapshotKey(tournamentId, gameNumber));
  await redis.del(begunKey(tournamentId, gameNumber));
  await redis.del(beginLockKey(tournamentId, gameNumber));
  await redis.del(blindTimerKey(tournamentId, gameNumber));
}

async function finishGame(
  tournamentId: string,
  room: TournamentRoom,
  chopShares?: Map<string, number>
): Promise<void> {
  clearActionTimer(room);
  clearAllDisconnectTimers(room);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { hostUserId: true },
  });

  const players = await prisma.tournamentPlayer.findMany({
    where: { tournamentId },
    include: { user: true },
  });

  const playerCount = players.length;
  const prizePool = room.buyInCents * playerCount;

  const userById = new Map(
    players.map((p) => [
      p.userId,
      { displayName: p.user.displayName, avatarUrl: p.user.avatarUrl },
    ] as const)
  );

  let finishOrder: {
    userId: string;
    position: number;
    payoutCents: number;
    displayName: string;
    avatarUrl: string | null;
  }[];

  if (chopShares) {
    const chipByUser = new Map(
      room.table
        .getPublicState()
        .seats.map((seat) => [seat.userId, seat.chipCount] as const)
    );
    const seatByUser = room.seatByUserId;
    const bustIndex = new Map<string, number>();
    room.table.getEliminationOrder().forEach((seatId, index) => {
      for (const [userId, mappedSeat] of seatByUser) {
        if (mappedSeat === seatId) bustIndex.set(userId, index);
      }
    });
    const ranked = rankChopFinish({
      remaining: [...chopShares.entries()].map(([userId, payoutCents]) => ({
        userId,
        payoutCents,
        chipCount: chipByUser.get(userId) ?? 0,
      })),
      eliminated: players
        .filter((player) => !chopShares.has(player.userId))
        .map((player) => ({
          userId: player.userId,
          bustIndex: bustIndex.get(player.userId) ?? -1,
        })),
    });
    finishOrder = ranked.map((row) => {
      const user = userById.get(row.userId);
      return {
        userId: row.userId,
        position: row.position,
        payoutCents: row.payoutCents,
        displayName: user?.displayName ?? "Player",
        avatarUrl: user?.avatarUrl ?? null,
      };
    });
  } else {
    const payoutAmounts = computePayoutsFromPercents(
      prizePool,
      room.payoutPercents,
      playerCount
    );
    const ranked = players.map((p) => {
      const seatId = room.seatByUserId.get(p.userId);
      let position =
        seatId !== undefined ? room.table.getFinishPosition(seatId) : 0;
      if (position === 0) position = players.length;
      const user = userById.get(p.userId);
      return {
        userId: p.userId,
        position,
        displayName: user?.displayName ?? "Player",
        avatarUrl: user?.avatarUrl ?? null,
      };
    });
    ranked.sort((a, b) => a.position - b.position);
    finishOrder = ranked.map((row, index) => ({
      userId: row.userId,
      position: index + 1,
      payoutCents: payoutAmounts[index] ?? 0,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    }));
  }

  const wasChopped = Boolean(chopShares);

  for (const { userId, position, payoutCents } of finishOrder) {
    await prisma.gameResult.create({
      data: {
        gameId: room.gameId,
        userId,
        finishPosition: position,
        payoutCents,
      },
    });

    const countsAsWin = !wasChopped && position === 1;
    const countsAsItm = !wasChopped && payoutCents > 0;

    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        tournamentsPlayed: 1,
        wins: countsAsWin ? 1 : 0,
        itmCount: countsAsItm ? 1 : 0,
        totalBuyInCents: room.buyInCents,
        totalPayoutCents: payoutCents,
      },
      update: {
        tournamentsPlayed: { increment: 1 },
        wins: countsAsWin ? { increment: 1 } : undefined,
        itmCount: countsAsItm ? { increment: 1 } : undefined,
        totalBuyInCents: { increment: room.buyInCents },
        totalPayoutCents: { increment: payoutCents },
      },
    });
  }

  const userIdBySeat = new Map<number, string>();
  for (const [userId, seatId] of room.seatByUserId) {
    userIdBySeat.set(seatId, userId);
  }
  const funStats = mapTableFunStatsToGame(
    room.table.getFunStats(),
    userIdBySeat
  );

  await prisma.game.update({
    where: { id: room.gameId },
    data: {
      status: "FINISHED",
      finishedAt: new Date(),
      prizePoolCents: prizePool,
      chopped: wasChopped,
      funStats,
    },
  });

  io.to(`tournament:${tournamentId}`).emit(ServerEvents.GAME_FINISHED, {
    gameId: room.gameId,
    gameNumber: room.gameNumber,
    buyInCents: room.buyInCents,
    hostUserId: tournament?.hostUserId ?? "",
    finishOrder,
    prizePoolCents: prizePool,
    chopped: wasChopped,
  });

  await clearGameRedis(tournamentId, room.gameNumber);
  rooms.delete(tournamentId);
}

async function teardownTournament(tournamentId: string): Promise<void> {
  const room = rooms.get(tournamentId);
  if (room) {
    clearActionTimer(room);
    clearAllDisconnectTimers(room);
    for (const userId of room.seatByUserId.keys()) {
      await redis.del(`player:${userId}:tournament`);
    }
    io.to(`tournament:${tournamentId}`).emit(ServerEvents.ERROR, {
      message: "Tournament was deleted by the host.",
    });
    rooms.delete(tournamentId);
  }

  const games = await prisma.game.findMany({
    where: { tournamentId },
    select: { gameNumber: true },
  });
  for (const g of games) {
    await clearGameRedis(tournamentId, g.gameNumber);
  }
}

function broadcastGameStarted(
  tournamentId: string,
  room: TournamentRoom
): void {
  const payload = {
    gameId: room.gameId,
    gameNumber: room.gameNumber,
  };
  io.to(`tournament:${tournamentId}`).emit(ServerEvents.GAME_STARTED, payload);
  io.to(`tournament-watch:${tournamentId}`).emit(
    ServerEvents.GAME_STARTED,
    payload
  );
}

/**
 * Legacy `/begin` path: open the table and, when 2+ are seated, randomize
 * seats + dealer. Never auto-deals — the button dealer starts hand 1.
 */
async function beginGame(tournamentId: string): Promise<boolean> {
  const opened = await openTable(tournamentId);
  if (!opened) return false;
  const room = rooms.get(tournamentId);
  if (!room) return false;
  if (room.table.getActivePlayerCount() >= 2 && !room.table.isSeatingReady()) {
    await readySeating(tournamentId);
  }
  return true;
}

/** Replay the latest finished game so a table reload after end is not stuck loading. */
async function emitLastFinishedGame(
  socket: import("socket.io").Socket,
  tournamentId: string
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { hostUserId: true, buyInCents: true },
  });
  if (!tournament) return false;

  const game = await prisma.game.findFirst({
    where: { tournamentId, status: "FINISHED" },
    orderBy: { gameNumber: "desc" },
    include: {
      results: {
        include: {
          user: { select: { displayName: true, avatarUrl: true } },
        },
        orderBy: { finishPosition: "asc" },
      },
    },
  });
  if (!game || game.results.length === 0) return false;

  socket.emit(ServerEvents.GAME_FINISHED, {
    gameId: game.id,
    gameNumber: game.gameNumber,
    buyInCents: tournament.buyInCents,
    hostUserId: tournament.hostUserId,
    finishOrder: game.results.map((r) => ({
      userId: r.userId,
      position: r.finishPosition,
      payoutCents: r.payoutCents,
      displayName: r.user.displayName,
      avatarUrl: r.user.avatarUrl,
    })),
    prizePoolCents: game.prizePoolCents,
    chopped: game.chopped,
  });
  return true;
}

async function joinAsRegisteredWatcher(
  socket: import("socket.io").Socket,
  userId: string,
  tournamentId: string
): Promise<boolean> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { players: { select: { userId: true } } },
  });
  if (!tournament || tournament.status === "FINISHED") return false;
  if (!tournament.players.some((p) => p.userId === userId)) return false;

  await socket.join(`tournament:${tournamentId}`);
  await socket.join(`tournament-watch:${tournamentId}`);
  socket.data.tournamentId = tournamentId;
  socket.data.watchingOnly = true;

  await redis.set(
    `player:${userId}:tournament`,
    tournamentId,
    "EX",
    86400
  );

  // Between tournaments the in-memory room is gone — restore results so /table
  // does not hang on "Loading table…" after a refresh.
  await emitLastFinishedGame(socket, tournamentId);
  return true;
}

async function resyncSocket(
  socket: import("socket.io").Socket,
  room: TournamentRoom,
  userId: string
): Promise<void> {
  socket.emit(ServerEvents.TABLE_STATE, publicTableState(room));
  sendPrivateStateToSocket(socket, room, userId);
  const snap = room.table.toSnapshot();
  socket.emit(ServerEvents.BLIND_TIMER, {
    ...room.blindTimer.getPublicState(snap.smallBlind, snap.bigBlind, snap.blindLevel),
    hostUserId: room.hostUserId,
  });
}

function requireGameServerSecret(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const expected = resolveGameServerSecret({
    nodeEnv: process.env.NODE_ENV,
    configured: process.env.GAME_SERVER_SECRET,
  });
  const provided = req.get(GAME_SERVER_SECRET_HEADER);
  if (!secretsEqual(provided, expected)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

app.post("/tournaments/:id/begin", requireGameServerSecret, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ok = await beginGame(id);
  if (!ok) {
    res.status(400).json({ error: "Could not start game" });
    return;
  }
  res.json({ ok: true });
});

app.post("/tournaments/:id/open", requireGameServerSecret, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ok = await openTable(id);
  if (!ok) {
    res.status(400).json({ error: "Could not open table" });
    return;
  }
  res.json({ ok: true });
});

app.post("/tournaments/:id/ready", requireGameServerSecret, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const ok = await readySeating(id);
  if (!ok) {
    res.status(400).json({ error: "Need at least 2 seated players to start" });
    return;
  }
  res.json({ ok: true });
});

app.get("/tournaments/:id/join-window", requireGameServerSecret, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const room = await loadOrCreateRoom(id);
  if (!room) {
    res.json({ canJoin: false, seatingReady: false });
    return;
  }
  res.json({
    canJoin: preDealJoinOpen(room),
    seatingReady: room.table.isSeatingReady(),
  });
});

app.delete("/tournaments/:id", requireGameServerSecret, async (req, res) => {
  const id = req.params.id;
  if (typeof id !== "string") {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await teardownTournament(id);
  res.json({ ok: true });
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string;
  if (!token) return next(new Error("Authentication required"));
  const payload = verifyToken(token);
  if (!payload) return next(new Error("Invalid token"));
  socket.data.user = payload;
  next();
});

io.on("connection", (socket) => {
  const user = socket.data.user as JwtPayload;

  socket.on(ClientEvents.JOIN_TOURNAMENT, async (tournamentId: string) => {
    const room = await loadOrCreateRoom(tournamentId);
    if (!room) {
      const watching = await joinAsRegisteredWatcher(
        socket,
        user.userId,
        tournamentId
      );
      if (watching) return;

      // Closed night: deliver last results and send clients to /results.
      const closed = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { players: { select: { userId: true } } },
      });
      if (
        closed?.status === "FINISHED" &&
        closed.players.some((p) => p.userId === user.userId)
      ) {
        await socket.join(`tournament:${tournamentId}`);
        await socket.join(`tournament-watch:${tournamentId}`);
        await emitLastFinishedGame(socket, tournamentId);
        socket.emit(ServerEvents.TOURNAMENT_FINISHED, {
          tournamentId,
        });
        return;
      }

      socket.emit(ServerEvents.ERROR, {
        message:
          "No game in progress. Return to the lobby to wait for the next game.",
      });
      return;
    }

    if (!room.seatByUserId.has(user.userId)) {
      const member = await prisma.tournamentPlayer.findUnique({
        where: {
          tournamentId_userId: {
            tournamentId,
            userId: user.userId,
          },
        },
        include: { user: { select: { displayName: true, avatarUrl: true } } },
      });
      if (!member) {
        socket.emit(ServerEvents.ERROR, {
          message: "Not registered for this tournament",
        });
        return;
      }
      const seated = await seatLateJoiner({
        tournamentId,
        room,
        userId: user.userId,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
      });
      if (seated === null) {
        socket.emit(ServerEvents.ERROR, {
          message: "Not registered for this tournament",
        });
        return;
      }
    }

    await socket.join(`tournament:${tournamentId}`);
    await socket.join(`tournament-watch:${tournamentId}`);
    room.playerSockets.set(user.userId, socket.id);
    room.seenPlayers.add(user.userId);
    socket.data.tournamentId = tournamentId;
    socket.data.watchingOnly = false;

    await redis.set(
      `player:${user.userId}:tournament`,
      tournamentId,
      "EX",
      86400
    );

    clearDisconnectTimer(room, user.userId);
    const seatId = room.seatByUserId.get(user.userId);
    if (
      seatId !== undefined &&
      room.table.isSkipped(seatId) &&
      shouldResumeOnReconnect(room.table.getSkipReason(seatId))
    ) {
      room.table.setSkipped(seatId, false);
      await afterAction(tournamentId, room);
    } else {
      // Broadcast away=false so the rest of the table sees the seat return.
      syncPlayerState(room, tournamentId);
    }

    await resyncSocket(socket, room, user.userId);
  });

  socket.on(ClientEvents.WATCH_TOURNAMENT, async (tournamentId: string) => {
    await socket.join(`tournament-watch:${tournamentId}`);
    await socket.join(`tournament:${tournamentId}`);
    socket.data.watchingTournamentId = tournamentId;
  });

  socket.on(ClientEvents.ACTION, async (data: unknown) => {
    const parsed = PlayerActionSchema.safeParse(data);
    if (!parsed.success) return;

    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    const seatId = room.seatByUserId.get(user.userId);
    if (seatId === undefined) return;

    const applied = room.table.applyAction(seatId, parsed.data);
    if (!applied) {
      sendPrivateStateToSocket(socket, room, user.userId);
      socket.emit(ServerEvents.ERROR, { message: "Invalid action" });
      return;
    }

    await afterAction(tournamentId, room);
  });

  socket.on(ClientEvents.READY_SEATING, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) {
      socket.emit(ServerEvents.ERROR, { message: "No active game" });
      return;
    }
    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can start seating",
      });
      return;
    }

    const ok = await readySeating(tournamentId);
    if (!ok) {
      socket.emit(ServerEvents.ERROR, {
        message: "Need at least 2 seated players to start",
      });
    }
  });

  socket.on(ClientEvents.START_NEXT_HAND, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) {
      socket.emit(ServerEvents.ERROR, { message: "No active game" });
      return;
    }

    const seatId = room.seatByUserId.get(user.userId);
    if (seatId === undefined) return;

    const state = room.table.getPublicState();
    const firstDeal =
      state.phase === "waiting" &&
      state.handNumber === 0 &&
      room.table.isSeatingReady();
    if (state.phase !== "hand-complete" && !firstDeal) {
      socket.emit(ServerEvents.ERROR, {
        message: firstDeal
          ? "Hand is still in progress"
          : state.phase === "waiting" && !room.table.isSeatingReady()
            ? "Host must start (randomize seats) before the first deal"
            : "Hand is still in progress",
      });
      return;
    }

    const dealSeat = firstDeal
      ? state.dealerSeat
      : state.nextDealerSeat;
    if (dealSeat !== seatId) {
      const nextDealer = dealSeat;
      const nextDealerUserId =
        nextDealer != null
          ? [...room.seatByUserId.entries()].find(
              ([, seat]) => seat === nextDealer
            )?.[0]
          : undefined;
      const nextDealerAway =
        nextDealerUserId != null && !room.playerSockets.has(nextDealerUserId);
      const nextDealerSkipped =
        nextDealer != null && room.table.isSkipped(nextDealer);
      const hostCanDeal =
        room.hostUserId === user.userId &&
        (nextDealerSkipped || nextDealerAway);
      if (!hostCanDeal) {
        socket.emit(ServerEvents.ERROR, {
          message: "Only the next dealer can deal the next hand",
        });
        return;
      }
    }

    const started = await startNextHand(tournamentId, room);
    if (!started) {
      socket.emit(ServerEvents.ERROR, { message: "Could not start next hand" });
    }
  });

  socket.on(ClientEvents.SKIP_PLAYER, async (data: unknown) => {
    const parsed = SeatIdPayloadSchema.safeParse(data);
    if (!parsed.success) return;

    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can mark a player away",
      });
      return;
    }

    const { seatId } = parsed.data;
    if (!room.table.setSkipped(seatId, true, "host")) {
      socket.emit(ServerEvents.ERROR, {
        message: "Could not mark that player away",
      });
      return;
    }

    await afterAction(tournamentId, room);
  });

  socket.on(ClientEvents.UNSKIP_PLAYER, async (data: unknown) => {
    const parsed = SeatIdPayloadSchema.safeParse(data);
    if (!parsed.success) return;

    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    const { seatId } = parsed.data;
    const mySeatId = room.seatByUserId.get(user.userId);
    const isHost = room.hostUserId === user.userId;
    const isSelf = mySeatId === seatId;

    // Host can mark anyone back; a sat-out player can return themselves.
    if (!isHost && !isSelf) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can mark another player back",
      });
      return;
    }

    if (!room.table.setSkipped(seatId, false)) {
      socket.emit(ServerEvents.ERROR, {
        message: "Could not mark that player back",
      });
      return;
    }

    const seatedUserId = [...room.seatByUserId.entries()].find(
      ([, seat]) => seat === seatId
    )?.[0];
    // Self-return always clears sit-out (socket is live). Host unsitting an
    // offline seat falls back to disconnect sit-out.
    if (
      !isSelf &&
      seatedUserId &&
      !room.playerSockets.has(seatedUserId)
    ) {
      room.table.setSkipped(seatId, true, "disconnect");
    }

    await afterAction(tournamentId, room);
  });

  socket.on(ClientEvents.CHOP_TOURNAMENT, async (data: unknown) => {
    const parsed = ChopTournamentSchema.safeParse(data);
    if (!parsed.success) {
      socket.emit(ServerEvents.ERROR, { message: "Could not read that chop" });
      return;
    }

    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) {
      socket.emit(ServerEvents.ERROR, { message: "No game in progress" });
      return;
    }

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the game night owner can chop",
      });
      return;
    }

    const phase = room.table.getPublicState().phase;
    if (phase !== "waiting" && phase !== "hand-complete") {
      socket.emit(ServerEvents.ERROR, {
        message: "Finish this hand before chopping",
      });
      return;
    }

    const remainingUserIds = room.table
      .getPublicState()
      .seats.filter((seat) => seat.chipCount > 0)
      .map((seat) => seat.userId);
    const roster = await prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      select: { userId: true },
    });
    const prizePoolCents = room.buyInCents * roster.length;
    const check = validateChopShares({
      prizePoolCents,
      remainingUserIds,
      shares: parsed.data.shares,
    });
    if (!check.ok) {
      socket.emit(ServerEvents.ERROR, { message: check.error });
      return;
    }

    const shares = new Map(
      parsed.data.shares.map((share) => [share.userId, share.payoutCents] as const)
    );
    await finishGame(tournamentId, room, shares);
  });

  socket.on(ClientEvents.PAUSE_BLIND_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, { message: "Only the host can pause blinds" });
      return;
    }

    room.blindTimer.pause();
    await persistRoom(tournamentId, room);
    broadcastBlindTimer(tournamentId, room);
  });

  socket.on(ClientEvents.RESUME_BLIND_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, { message: "Only the host can resume blinds" });
      return;
    }

    room.blindTimer.resume();
    await persistRoom(tournamentId, room);
    broadcastBlindTimer(tournamentId, room);
  });

  socket.on(ClientEvents.PAUSE_ACTION_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can pause the action timer",
      });
      return;
    }

    if (room.actionTimerSeconds <= 0 || room.actionTimerPaused) return;
    if (room.actionDeadlineAt === null) return;

    const remaining = Math.max(0, room.actionDeadlineAt - Date.now());
    if (room.actionTimer) {
      clearTimeout(room.actionTimer);
      room.actionTimer = null;
    }
    room.actionTimerGeneration += 1;
    room.actionDeadlineAt = null;
    room.actionTimerPaused = true;
    room.actionTimerPausedRemainingMs = remaining;
    io.to(`tournament:${tournamentId}`).emit(
      ServerEvents.TABLE_STATE,
      publicTableState(room)
    );
  });

  socket.on(ClientEvents.RESUME_ACTION_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can resume the action timer",
      });
      return;
    }

    if (!room.actionTimerPaused) return;
    const remaining = room.actionTimerPausedRemainingMs ?? 0;
    room.actionTimerPaused = false;
    room.actionTimerPausedRemainingMs = null;
    if (room.actionTimerSeconds <= 0) {
      io.to(`tournament:${tournamentId}`).emit(
        ServerEvents.TABLE_STATE,
        publicTableState(room)
      );
      return;
    }
    armActionTimer(tournamentId, room, Math.max(1_000, remaining));
    io.to(`tournament:${tournamentId}`).emit(
      ServerEvents.TABLE_STATE,
      publicTableState(room)
    );
  });

  socket.on(ClientEvents.RESET_ACTION_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can reset the action timer",
      });
      return;
    }

    if (room.actionTimerSeconds <= 0) {
      room.actionTimerSeconds =
        room.actionTimerConfiguredSeconds > 0
          ? room.actionTimerConfiguredSeconds
          : 60;
    }
    armActionTimer(tournamentId, room);
    io.to(`tournament:${tournamentId}`).emit(
      ServerEvents.TABLE_STATE,
      publicTableState(room)
    );
  });

  socket.on(ClientEvents.DISABLE_ACTION_TIMER, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can turn off the action timer",
      });
      return;
    }

    room.actionTimerSeconds = 0;
    clearActionTimer(room);
    io.to(`tournament:${tournamentId}`).emit(
      ServerEvents.TABLE_STATE,
      publicTableState(room)
    );
  });

  socket.on(ClientEvents.ADVANCE_BLIND_LEVEL, async () => {
    const tournamentId = await redis.get(`player:${user.userId}:tournament`);
    if (!tournamentId) return;

    const room = rooms.get(tournamentId);
    if (!room) return;

    if (room.hostUserId !== user.userId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the host can advance blinds",
      });
      return;
    }

    if (!room.blindTimer.forceNextLevel()) {
      socket.emit(ServerEvents.ERROR, {
        message: room.blindTimer.getIncreasePending()
          ? "Next blinds already scheduled for the next hand"
          : "Already at the final blind level",
      });
      return;
    }

    await persistRoom(tournamentId, room);
    broadcastBlindTimer(tournamentId, room);
  });

  socket.on("disconnect", () => {
    const tournamentId = socket.data.tournamentId as string | undefined;
    if (!tournamentId) return;
    const room = rooms.get(tournamentId);
    if (!room) return;
    if (room.playerSockets.get(user.userId) !== socket.id) return;

    room.playerSockets.delete(user.userId);
    io.to(`tournament:${tournamentId}`).emit(
      ServerEvents.TABLE_STATE,
      publicTableState(room)
    );

    if (socket.data.watchingOnly) return;

    clearDisconnectTimer(room, user.userId);
    const seatId = room.seatByUserId.get(user.userId);
    const isActor =
      seatId !== undefined &&
      room.table.getPublicState().currentActorSeat === seatId;
    const graceMs = isActor ? DISCONNECT_ACTOR_GRACE_MS : DISCONNECT_GRACE_MS;
    const timer = setTimeout(() => {
      room.disconnectTimers.delete(user.userId);
      void sitOutDisconnectedPlayer(tournamentId, room, user.userId);
    }, graceMs);
    room.disconnectTimers.set(user.userId, timer);
  });
});

setInterval(() => {
  for (const [tournamentId, room] of rooms) {
    const changed = room.blindTimer.tick();
    if (changed) {
      void persistRoom(tournamentId, room).then(() => {
        broadcastBlindTimer(tournamentId, room);
      });
    }
  }
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`Game server listening on port ${PORT}`);
});

export { io, app, beginGame, openTable, readySeating };
