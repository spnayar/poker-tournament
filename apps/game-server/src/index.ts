import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../../../.env") });

import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import Redis from "ioredis";
import { prisma } from "@poker/db";
import { TableEngine, type TableSnapshot } from "@poker/game-engine";
import {
  ClientEvents,
  ServerEvents,
  computePayoutsFromPercents,
  PlayerActionSchema,
  resolveBlindLevels,
  type BlindLevel,
} from "@poker/protocol";
import { BlindTimer, type BlindTimerSnapshot } from "./blindTimer";

const PORT = parseInt(
  process.env.PORT ?? process.env.GAME_SERVER_PORT ?? "3001",
  10
);
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const SNAPSHOT_TTL_SEC = 60 * 60 * 24 * 7;

const redis = new Redis(REDIS_URL);
const app: express.Application = express();
app.use(cors({ origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000" }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

interface TournamentRoom {
  table: TableEngine;
  playerSockets: Map<string, string>;
  seatByUserId: Map<string, number>;
  buyInCents: number;
  gameId: string;
  gameNumber: number;
  payoutPercents: number[];
  hostUserId: string;
  blindLevels: BlindLevel[];
  blindTimer: BlindTimer;
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
  return {
    table,
    playerSockets: new Map(),
    seatByUserId: buildSeatMap(table),
    buyInCents: tournament.buyInCents,
    gameId: game.id,
    gameNumber: game.gameNumber,
    payoutPercents: tournament.payoutPercents as number[],
    hostUserId: tournament.hostUserId,
    blindLevels,
    blindTimer: new BlindTimer(blindLevels, levelDurationMs, blindTimerSnapshot),
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

  table.randomizeDealerButton();

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
  const state = room.table.getPublicState();
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
  if (actorSeat !== null) {
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

async function afterAction(tournamentId: string, room: TournamentRoom): Promise<void> {
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
  if (state.phase !== "hand-complete") return false;
  if (room.table.isTournamentComplete()) return false;

  await applyPendingBlindIncrease(room);
  const started = room.table.startHand();
  if (!started) return false;

  await processTableEvents(room, tournamentId);
  broadcastBlindTimer(tournamentId, room);

  if (room.table.isTournamentComplete()) {
    void finishGame(tournamentId, room);
  }

  return true;
}

async function clearGameRedis(tournamentId: string, gameNumber: number): Promise<void> {
  await redis.del(snapshotKey(tournamentId, gameNumber));
  await redis.del(begunKey(tournamentId, gameNumber));
  await redis.del(beginLockKey(tournamentId, gameNumber));
  await redis.del(blindTimerKey(tournamentId, gameNumber));
}

async function finishGame(tournamentId: string, room: TournamentRoom): Promise<void> {
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
  const payoutAmounts = computePayoutsFromPercents(
    prizePool,
    room.payoutPercents,
    playerCount
  );

  const userById = new Map(
    players.map((p) => [p.userId, p.user.displayName] as const)
  );

  const ranked = players.map((p) => {
    const seatId = room.seatByUserId.get(p.userId);
    let position =
      seatId !== undefined ? room.table.getFinishPosition(seatId) : 0;
    if (position === 0) position = players.length;
    return {
      userId: p.userId,
      position,
      displayName: userById.get(p.userId) ?? "Player",
    };
  });

  ranked.sort((a, b) => a.position - b.position);

  const finishOrder = ranked.map((row, index) => ({
    userId: row.userId,
    position: index + 1,
    payoutCents: payoutAmounts[index] ?? 0,
    displayName: row.displayName,
  }));

  for (const { userId, position, payoutCents } of finishOrder) {
    await prisma.gameResult.create({
      data: {
        gameId: room.gameId,
        userId,
        finishPosition: position,
        payoutCents,
      },
    });

    await prisma.userStats.upsert({
      where: { userId },
      create: {
        userId,
        tournamentsPlayed: 1,
        wins: position === 1 ? 1 : 0,
        itmCount: payoutCents > 0 ? 1 : 0,
        totalBuyInCents: room.buyInCents,
        totalPayoutCents: payoutCents,
      },
      update: {
        tournamentsPlayed: { increment: 1 },
        wins: position === 1 ? { increment: 1 } : undefined,
        itmCount: payoutCents > 0 ? { increment: 1 } : undefined,
        totalBuyInCents: { increment: room.buyInCents },
        totalPayoutCents: { increment: payoutCents },
      },
    });
  }

  await prisma.game.update({
    where: { id: room.gameId },
    data: {
      status: "FINISHED",
      finishedAt: new Date(),
      prizePoolCents: prizePool,
    },
  });

  io.to(`tournament:${tournamentId}`).emit(ServerEvents.GAME_FINISHED, {
    gameId: room.gameId,
    gameNumber: room.gameNumber,
    buyInCents: room.buyInCents,
    hostUserId: tournament?.hostUserId ?? "",
    finishOrder,
    prizePoolCents: prizePool,
  });

  await clearGameRedis(tournamentId, room.gameNumber);
  rooms.delete(tournamentId);
}

async function teardownTournament(tournamentId: string): Promise<void> {
  const room = rooms.get(tournamentId);
  if (room) {
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

/** Start the first hand of the current running game. */
async function beginGame(tournamentId: string): Promise<boolean> {
  let room = await loadOrCreateRoom(tournamentId);
  if (!room) {
    room = await createRoomFromDb(tournamentId);
  }
  if (!room) return false;

  const state = room.table.getPublicState();
  if (state.handNumber > 0 || state.phase !== "waiting") {
    return true;
  }

  const acquired = await redis.set(
    beginLockKey(tournamentId, room.gameNumber),
    "1",
    "EX",
    30,
    "NX"
  );
  if (!acquired) {
    rooms.delete(tournamentId);
    const reloaded = await loadOrCreateRoom(tournamentId);
    if (!reloaded) return false;
    const reloadedState = reloaded.table.getPublicState();
    return reloadedState.handNumber > 0 || reloadedState.phase !== "waiting";
  }

  try {
    await applyPendingBlindIncrease(room);
    const started = room.table.startHand();
    if (!started) return false;

    if (room.table.getPublicState().handNumber === 1) {
      room.blindTimer.startLevelTimer();
    }

    await persistRoom(tournamentId, room);
    await redis.set(
      begunKey(tournamentId, room.gameNumber),
      "1",
      "EX",
      SNAPSHOT_TTL_SEC
    );
    await processTableEvents(room, tournamentId);
    broadcastGameStarted(tournamentId, room);
    broadcastBlindTimer(tournamentId, room);
    return true;
  } finally {
    await redis.del(beginLockKey(tournamentId, room.gameNumber));
  }
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
  return true;
}

async function resyncSocket(
  socket: import("socket.io").Socket,
  room: TournamentRoom,
  userId: string
): Promise<void> {
  const state = room.table.getPublicState();
  socket.emit(ServerEvents.TABLE_STATE, state);
  sendPrivateStateToSocket(socket, room, userId);
  const snap = room.table.toSnapshot();
  socket.emit(ServerEvents.BLIND_TIMER, {
    ...room.blindTimer.getPublicState(snap.smallBlind, snap.bigBlind, snap.blindLevel),
    hostUserId: room.hostUserId,
  });
}

app.post("/tournaments/:id/begin", async (req, res) => {
  const { id } = req.params;
  const ok = await beginGame(id);
  if (!ok) {
    res.status(400).json({ error: "Could not start game" });
    return;
  }
  res.json({ ok: true });
});

app.delete("/tournaments/:id", async (req, res) => {
  const { id } = req.params;
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

      socket.emit(ServerEvents.ERROR, {
        message:
          "No game in progress. Return to the lobby to wait for the next game.",
      });
      return;
    }

    if (!room.seatByUserId.has(user.userId)) {
      socket.emit(ServerEvents.ERROR, { message: "Not registered for this tournament" });
      return;
    }

    await socket.join(`tournament:${tournamentId}`);
    await socket.join(`tournament-watch:${tournamentId}`);
    room.playerSockets.set(user.userId, socket.id);
    socket.data.tournamentId = tournamentId;
    socket.data.watchingOnly = false;

    await redis.set(
      `player:${user.userId}:tournament`,
      tournamentId,
      "EX",
      86400
    );

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
    if (state.phase !== "hand-complete") {
      socket.emit(ServerEvents.ERROR, { message: "Hand is still in progress" });
      return;
    }

    if (state.nextDealerSeat !== seatId) {
      socket.emit(ServerEvents.ERROR, {
        message: "Only the next dealer can deal the next hand",
      });
      return;
    }

    const started = await startNextHand(tournamentId, room);
    if (!started) {
      socket.emit(ServerEvents.ERROR, { message: "Could not start next hand" });
    }
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

  socket.on("disconnect", () => {
    const tournamentId = socket.data.tournamentId as string | undefined;
    if (!tournamentId) return;
    const room = rooms.get(tournamentId);
    if (room && room.playerSockets.get(user.userId) === socket.id) {
      room.playerSockets.delete(user.userId);
    }
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

export { io, app, beginGame };
