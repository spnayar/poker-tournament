import type {
  ActionLogEntry,
  Card,
  HandResult,
  LegalActions,
  PlayerAction,
  PotLayer,
  SeatPublic,
  TablePhase,
  TableState,
} from "@poker/protocol";
import { getBlindsForLevel } from "./blinds";
import { newShuffledDeck } from "./deck";
import {
  evaluateHand,
  findPotWinners,
  splitPotAmount,
} from "./handEval";
import { buildSidePots, totalPotAmount, type PlayerContribution } from "./sidePots";

export interface TablePlayer {
  seatId: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  chips: number;
  holeCards: Card[];
  folded: boolean;
  allIn: boolean;
  betThisRound: number;
  totalBet: number;
  hasActed: boolean;
  eliminated: boolean;
  lastAction: string | null;
}

export interface TableConfig {
  tournamentId: string;
  startingChips: number;
  blindPreset: string;
  levelIncreaseEvery: number;
}

export interface TableEvent {
  type: "deal" | "reveal" | "chips" | "state" | "handResult" | "elimination";
  payload: unknown;
}

export class TableEngine {
  private players: Map<number, TablePlayer> = new Map();
  private deck: Card[] = [];
  private board: Card[] = [];
  private phase: TablePhase = "waiting";
  private dealerSeat = 0;
  private skipNextDealerMove = false;
  private currentActorSeat: number | null = null;
  private smallBlind = 25;
  private bigBlind = 50;
  private blindLevel = 0;
  private handNumber = 0;
  private currentBet = 0;
  private lastRaiseSize = 0;
  private lastFullRaiseTo = 0;
  private bettingComplete = false;
  private eliminationOrder: number[] = [];
  private config: TableConfig;
  private pendingEvents: TableEvent[] = [];
  private actionLog: ActionLogEntry[] = [];
  private actionLogId = 0;
  /** Blind seats posted for the current hand (stable even after folds). */
  private postedSbSeat: number | null = null;
  private postedBbSeat: number | null = null;

  constructor(config: TableConfig) {
    this.config = config;
  }

  addPlayer(
    seatId: number,
    userId: string,
    displayName: string,
    avatarUrl: string | null,
    chips: number
  ): void {
    this.players.set(seatId, {
      seatId,
      userId,
      displayName,
      avatarUrl,
      chips,
      holeCards: [],
      folded: false,
      allIn: false,
      betThisRound: 0,
      totalBet: 0,
      hasActed: false,
      eliminated: false,
      lastAction: null,
    });
  }

  /** Players still in the tournament (not busted). All-in players count until eliminated. */
  getActivePlayerCount(): number {
    return [...this.players.values()].filter((p) => !p.eliminated).length;
  }

  getSeatIds(): number[] {
    return [...this.players.keys()].sort((a, b) => a - b);
  }

  getHoleCards(seatId: number): Card[] {
    return this.players.get(seatId)?.holeCards ?? [];
  }

  toSnapshot(): import("./snapshot.js").TableSnapshot {
    return {
      config: { ...this.config },
      players: [...this.players.values()].map((p) => ({
        ...p,
        holeCards: [...p.holeCards],
      })),
      deck: [...this.deck],
      board: [...this.board],
      phase: this.phase,
      dealerSeat: this.dealerSeat,
      currentActorSeat: this.currentActorSeat,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      blindLevel: this.blindLevel,
      handNumber: this.handNumber,
      currentBet: this.currentBet,
      lastRaiseSize: this.lastRaiseSize,
      lastFullRaiseTo: this.lastFullRaiseTo,
      eliminationOrder: [...this.eliminationOrder],
      actionLog: [...this.actionLog],
      actionLogId: this.actionLogId,
      postedSbSeat: this.postedSbSeat,
      postedBbSeat: this.postedBbSeat,
    };
  }

  static fromSnapshot(snapshot: import("./snapshot.js").TableSnapshot): TableEngine {
    const table = new TableEngine(snapshot.config);
    table.restoreFromSnapshot(snapshot);
    return table;
  }

  private restoreFromSnapshot(snapshot: import("./snapshot.js").TableSnapshot): void {
    this.players = new Map(
      snapshot.players.map((p) => [p.seatId, { ...p, holeCards: [...p.holeCards] }])
    );
    this.deck = [...snapshot.deck];
    this.board = [...snapshot.board];
    this.phase = snapshot.phase;
    this.dealerSeat = snapshot.dealerSeat;
    this.currentActorSeat = snapshot.currentActorSeat;
    this.smallBlind = snapshot.smallBlind;
    this.bigBlind = snapshot.bigBlind;
    this.blindLevel = snapshot.blindLevel;
    this.handNumber = snapshot.handNumber;
    this.currentBet = snapshot.currentBet;
    this.lastRaiseSize = snapshot.lastRaiseSize;
    this.lastFullRaiseTo = snapshot.lastFullRaiseTo;
    this.eliminationOrder = [...snapshot.eliminationOrder];
    this.actionLog = [...snapshot.actionLog];
    this.actionLogId = snapshot.actionLogId;
    this.postedSbSeat = snapshot.postedSbSeat ?? null;
    this.postedBbSeat = snapshot.postedBbSeat ?? null;
    this.pendingEvents = [];
  }

  drainEvents(): TableEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    return events;
  }

  startHand(): boolean {
    const activeSeats = this.getActiveSeats();
    if (activeSeats.length < 2) return false;

    this.handNumber++;
    this.appendHandHeader();
    if (
      this.handNumber > 1 &&
      (this.handNumber - 1) % this.config.levelIncreaseEvery === 0
    ) {
      this.blindLevel++;
      const blinds = getBlindsForLevel(
        this.config.blindPreset,
        this.blindLevel
      );
      this.smallBlind = blinds.sb;
      this.bigBlind = blinds.bb;
    }

    this.deck = newShuffledDeck();
    this.board = [];
    this.phase = "dealing";
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;
    this.lastFullRaiseTo = this.bigBlind;
    this.bettingComplete = false;

    for (const p of this.players.values()) {
      if (!p.eliminated && p.chips > 0) {
        p.holeCards = [];
        p.folded = false;
        p.allIn = false;
        p.betThisRound = 0;
        p.totalBet = 0;
        p.hasActed = false;
        p.lastAction = null;
      }
    }

    if (this.skipNextDealerMove) {
      this.skipNextDealerMove = false;
    } else {
      this.moveDealerButton(activeSeats);
    }
    this.postBlinds(activeSeats);
    this.dealHoleCards(activeSeats);

    this.phase = "preflop";
    this.currentBet = this.bigBlind;
    this.startBettingRound();

    this.emitState();
    return true;
  }

  private getActiveSeats(): number[] {
    return [...this.players.values()]
      .filter((p) => !p.eliminated && p.chips > 0)
      .map((p) => p.seatId)
      .sort((a, b) => a - b);
  }

  private getHandSeats(): number[] {
    return [...this.players.values()]
      .filter((p) => !p.eliminated && !p.folded)
      .map((p) => p.seatId)
      .sort((a, b) => a - b);
  }

  /** Next active seat clockwise on the table ring (skips empty/busted seats). */
  private nextActiveSeatClockwise(
    fromSeat: number,
    activeSeats: number[]
  ): number {
    if (activeSeats.length === 0) return fromSeat;
    const ring = this.getSeatIds();
    const startIdx = ring.indexOf(fromSeat);
    const begin = startIdx === -1 ? 0 : startIdx;
    for (let i = 1; i <= ring.length; i++) {
      const candidate = ring[(begin + i) % ring.length]!;
      if (activeSeats.includes(candidate)) return candidate;
    }
    return activeSeats[0]!;
  }

  private blindSeatsForDealer(
    dealer: number,
    activeSeats: number[]
  ): { sb: number; bb: number } {
    const sb =
      activeSeats.length === 2
        ? dealer
        : this.nextActiveSeatClockwise(dealer, activeSeats);
    const bb = this.nextActiveSeatClockwise(sb, activeSeats);
    return { sb, bb };
  }

  private moveDealerButton(activeSeats: number[]): void {
    this.dealerSeat = this.nextActiveSeatClockwise(
      this.dealerSeat,
      activeSeats
    );
  }

  /** Pick a random active seat as dealer when a new tournament session begins. */
  randomizeDealerButton(activeSeats?: number[]): void {
    const seats = activeSeats ?? this.getActiveSeats();
    if (seats.length === 0) return;
    const pick = seats[Math.floor(Math.random() * seats.length)]!;
    this.dealerSeat = pick;
    this.skipNextDealerMove = true;
  }

  /** Who will have the button if the next hand is dealt now. */
  getNextDealerSeat(): number | null {
    const activeSeats = this.getActiveSeats();
    if (activeSeats.length < 2) return null;
    return this.nextActiveSeatClockwise(this.dealerSeat, activeSeats);
  }

  private seatAfter(seat: number, seatsInOrder: number[]): number {
    const idx = seatsInOrder.indexOf(seat);
    return seatsInOrder[(idx + 1) % seatsInOrder.length]!;
  }

  private postBlinds(activeSeats: number[]): void {
    const { sb: sbSeat, bb: bbSeat } = this.blindSeatsForDealer(
      this.dealerSeat,
      activeSeats
    );
    this.postedSbSeat = sbSeat;
    this.postedBbSeat = bbSeat;

    this.postBlind(sbSeat, this.smallBlind, true);
    this.postBlind(bbSeat, this.bigBlind, false);
  }

  private appendHandHeader(): void {
    this.actionLog.push({
      id: this.actionLogId++,
      seatId: -1,
      displayName: "",
      avatarUrl: null,
      action: `Hand #${this.handNumber}`,
      street: "hand",
      handNumber: this.handNumber,
    });
    if (this.actionLog.length > 400) {
      this.actionLog.splice(0, this.actionLog.length - 400);
    }
  }

  private logAction(seatId: number, action: string): void {
    const player = this.players.get(seatId);
    if (!player) return;
    player.lastAction = action;
    this.actionLog.push({
      id: this.actionLogId++,
      seatId,
      displayName: player.displayName,
      avatarUrl: player.avatarUrl,
      action,
      street: this.phase,
      handNumber: this.handNumber,
    });
    if (this.actionLog.length > 400) {
      this.actionLog.splice(0, this.actionLog.length - 400);
    }
  }

  private logCommunityCards(
    street: "flop" | "turn" | "river",
    cards: Card[]
  ): void {
    const label = street.charAt(0).toUpperCase() + street.slice(1);
    this.actionLog.push({
      id: this.actionLogId++,
      seatId: -2,
      displayName: "",
      avatarUrl: null,
      action: label,
      street,
      handNumber: this.handNumber,
      cards: [...cards],
    });
    if (this.actionLog.length > 400) {
      this.actionLog.splice(0, this.actionLog.length - 400);
    }
  }

  private postBlind(seatId: number, amount: number, isSb: boolean): void {
    const player = this.players.get(seatId);
    if (!player) return;
    const post = Math.min(amount, player.chips);
    player.chips -= post;
    player.betThisRound += post;
    player.totalBet += post;
    if (player.chips === 0) player.allIn = true;
    this.logAction(seatId, isSb ? `SB ${post}` : `BB ${post}`);
    this.pendingEvents.push({
      type: "chips",
      payload: { fromSeat: seatId, toPot: true, amount: post },
    });
  }

  private dealHoleCards(activeSeats: number[]): void {
    const seatOrder = [...activeSeats];
    for (let round = 0; round < 2; round++) {
      for (const seatId of seatOrder) {
        const player = this.players.get(seatId)!;
        const card = this.deck.pop()!;
        player.holeCards.push(card);
      }
    }
    this.pendingEvents.push({
      type: "deal",
      payload: { seatOrder, cardIndex: 1 },
    });
  }

  private startBettingRound(): void {
    const handSeats = this.getHandSeats();
    const canAct = handSeats.filter((s) => !this.players.get(s)!.allIn);

    if (canAct.length === 0) {
      this.advanceStreet();
      return;
    }

    if (this.phase === "preflop") {
      const bbSeat = this.findBigBlindSeat(handSeats);
      this.currentActorSeat = this.seatAfter(bbSeat, canAct);
    } else {
      const firstActor = this.seatAfter(this.dealerSeat, canAct);
      this.currentActorSeat = firstActor;
      this.currentBet = 0;
      for (const seatId of handSeats) {
        const p = this.players.get(seatId)!;
        p.betThisRound = 0;
        p.hasActed = false;
      }
    }

    this.emitState();
  }

  private findBigBlindSeat(_handSeats: number[]): number {
    if (this.postedBbSeat !== null) return this.postedBbSeat;
    const activeSeats = this.getActiveSeats();
    return this.blindSeatsForDealer(this.dealerSeat, activeSeats).bb;
  }

  /** True if some opponent could call or re-raise a new bet/raise. */
  private opponentsCanRespondToRaise(actorSeatId: number): boolean {
    for (const seatId of this.getHandSeats()) {
      if (seatId === actorSeatId) continue;
      const p = this.players.get(seatId)!;
      if (!p.folded && !p.allIn && p.chips > 0) return true;
    }
    return false;
  }

  getLegalActions(seatId: number): LegalActions | null {
    if (this.currentActorSeat !== seatId) return null;
    const player = this.players.get(seatId);
    if (!player || player.folded || player.allIn) return null;

    const toCall = this.currentBet - player.betThisRound;
    const canCheck = toCall === 0;
    const canCall = toCall > 0 && player.chips > 0;
    const minRaiseTo = this.getMinRaiseTo();
    const canRespond = this.opponentsCanRespondToRaise(seatId);
    const canRaise =
      canRespond &&
      player.chips > toCall &&
      minRaiseTo <= player.chips + player.betThisRound;
    const canBet =
      this.currentBet === 0 && player.chips > 0 && canRespond;

    return {
      canFold: true,
      canCheck,
      canCall,
      callAmount: Math.min(toCall, player.chips),
      canBet,
      minBet: this.bigBlind,
      canRaise,
      minRaise: canRaise ? minRaiseTo - player.betThisRound : 0,
      minRaiseTo: canRaise ? minRaiseTo : 0,
      maxRaise: player.chips + player.betThisRound,
      canAllIn: player.chips > 0,
      allInAmount: player.chips,
    };
  }

  private getMinRaiseTo(): number {
    if (this.currentBet === 0) return this.bigBlind;
    return this.lastFullRaiseTo + this.lastRaiseSize;
  }

  applyAction(seatId: number, action: PlayerAction): boolean {
    if (this.currentActorSeat !== seatId) return false;
    const player = this.players.get(seatId);
    if (!player || player.folded || player.allIn) return false;

    const handSeats = this.getHandSeats();

    switch (action.type) {
      case "fold":
        player.folded = true;
        this.logAction(seatId, "Fold");
        break;
      case "check":
        if (this.currentBet - player.betThisRound > 0) return false;
        this.logAction(seatId, "Check");
        break;
      case "call": {
        const toCall = Math.min(
          this.currentBet - player.betThisRound,
          player.chips
        );
        this.commitChips(player, toCall);
        this.logAction(
          seatId,
          player.allIn ? `Call ${toCall} (all-in)` : `Call ${toCall}`
        );
        break;
      }
      case "bet": {
        if (this.currentBet > 0) return false;
        if (!this.opponentsCanRespondToRaise(seatId)) return false;
        const betAmount = Math.min(action.amount, player.chips);
        if (betAmount < this.bigBlind && betAmount < player.chips) return false;
        this.commitChips(player, betAmount);
        this.currentBet = player.betThisRound;
        this.lastRaiseSize = betAmount;
        this.lastFullRaiseTo = this.currentBet;
        this.resetActedExcept(seatId, handSeats);
        this.reopenActionForUnmatched(handSeats);
        this.logAction(seatId, `Bet ${betAmount}`);
        break;
      }
      case "raise": {
        if (!this.opponentsCanRespondToRaise(seatId)) return false;
        const raiseTo = action.amount;
        if (raiseTo <= this.currentBet) return false;
        const chipsNeeded = raiseTo - player.betThisRound;
        if (chipsNeeded > player.chips) return false;
        const raiseSize = raiseTo - this.currentBet;
        const isFullRaise = raiseSize >= this.lastRaiseSize;
        this.commitChips(player, chipsNeeded);
        this.currentBet = player.betThisRound;
        if (isFullRaise) {
          this.lastRaiseSize = raiseSize;
          this.lastFullRaiseTo = this.currentBet;
          this.resetActedExcept(seatId, handSeats);
        }
        this.reopenActionForUnmatched(handSeats);
        this.logAction(seatId, `Raise to ${player.betThisRound}`);
        break;
      }
      case "all-in": {
        const amount = player.chips;
        const newTotal = player.betThisRound + amount;
        const betToMatch = this.currentBet;
        const raiseSize = newTotal - betToMatch;
        this.commitChips(player, amount);
        if (newTotal > betToMatch) {
          this.currentBet = Math.max(this.currentBet, player.betThisRound);
          const isFullRaise = raiseSize >= this.lastRaiseSize;
          if (isFullRaise) {
            this.lastRaiseSize = raiseSize;
            this.lastFullRaiseTo = this.currentBet;
            this.resetActedExcept(seatId, handSeats);
          }
          this.reopenActionForUnmatched(handSeats);
          this.logAction(seatId, `All-in ${amount}`);
        } else {
          this.logAction(seatId, `Call ${amount} (all-in)`);
        }
        break;
      }
    }

    player.hasActed = true;
    this.advanceAction();
    return true;
  }

  private commitChips(player: TablePlayer, amount: number): void {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.betThisRound += actual;
    player.totalBet += actual;
    if (player.chips === 0) player.allIn = true;
    this.pendingEvents.push({
      type: "chips",
      payload: {
        fromSeat: player.seatId,
        toPot: true,
        amount: actual,
      },
    });
  }

  private resetActedExcept(seatId: number, handSeats: number[]): void {
    for (const s of handSeats) {
      const p = this.players.get(s)!;
      if (s !== seatId && !p.allIn) p.hasActed = false;
    }
  }

  /** Players who have not yet matched the current bet must act again. */
  private reopenActionForUnmatched(handSeats: number[]): void {
    for (const s of handSeats) {
      const p = this.players.get(s)!;
      if (!p.allIn && !p.folded && p.betThisRound < this.currentBet) {
        p.hasActed = false;
      }
    }
  }

  private isBettingRoundComplete(): boolean {
    return this.getHandSeats().every((seatId) => {
      const p = this.players.get(seatId)!;
      if (p.allIn) return true;
      return p.hasActed && p.betThisRound === this.currentBet;
    });
  }

  /** Any non-folded, non-all-in player who still owes a decision or chips. */
  private anyoneNeedsToAct(handSeats: number[]): number | null {
    for (const seatId of handSeats) {
      const p = this.players.get(seatId)!;
      if (p.folded || p.allIn) continue;
      if (!p.hasActed || p.betThisRound < this.currentBet) {
        return seatId;
      }
    }
    return null;
  }

  private findNextActor(
    handSeats: number[],
    canAct: number[],
    lastActor: number | null
  ): number | null {
    if (canAct.length === 0) return null;

    const startSeat =
      lastActor !== null
        ? this.seatAfter(lastActor, handSeats)
        : this.seatAfter(this.dealerSeat, handSeats);

    let seat = startSeat;
    for (let i = 0; i < handSeats.length; i++) {
      if (canAct.includes(seat)) {
        const p = this.players.get(seat)!;
        if (!p.hasActed || p.betThisRound < this.currentBet) {
          return seat;
        }
      }
      seat = this.seatAfter(seat, handSeats);
    }
    return null;
  }

  private advanceAction(): void {
    const handSeats = this.getHandSeats();
    const lastActor = this.currentActorSeat;
    const canAct = handSeats.filter((s) => !this.players.get(s)!.allIn);

    if (handSeats.length === 1) {
      this.awardUncalled(handSeats[0]!);
      return;
    }

    if (canAct.length === 0) {
      if (!this.isBettingRoundComplete()) {
        const fallback = this.anyoneNeedsToAct(handSeats);
        if (fallback !== null) {
          this.currentActorSeat = fallback;
          this.emitState();
          return;
        }
      }
      this.advanceStreet();
      return;
    }

    const nextActor = this.findNextActor(handSeats, canAct, lastActor);
    if (nextActor !== null) {
      this.currentActorSeat = nextActor;
      this.emitState();
      return;
    }

    if (!this.isBettingRoundComplete()) {
      const fallback = this.anyoneNeedsToAct(handSeats);
      if (fallback !== null) {
        this.currentActorSeat = fallback;
        this.emitState();
        return;
      }
    }

    this.advanceStreet();
  }

  private advanceStreet(): void {
    const handSeats = this.getHandSeats();

    if (handSeats.length === 1) {
      this.awardUncalled(handSeats[0]!);
      return;
    }

    if (!this.isBettingRoundComplete()) {
      const canAct = handSeats.filter((s) => !this.players.get(s)!.allIn);
      const nextActor = this.findNextActor(
        handSeats,
        canAct,
        this.currentActorSeat
      );
      if (nextActor !== null) {
        this.currentActorSeat = nextActor;
        this.emitState();
        return;
      }
      const fallback = this.anyoneNeedsToAct(handSeats);
      if (fallback !== null) {
        this.currentActorSeat = fallback;
        this.emitState();
        return;
      }
    }

    if (!this.isBettingRoundComplete()) {
      return;
    }

    const canBet = handSeats.filter((s) => !this.players.get(s)!.allIn);
    if (canBet.length <= 1 && this.phase !== "river") {
      this.runout();
      return;
    }

    switch (this.phase) {
      case "preflop":
        this.dealFlop();
        this.phase = "flop";
        break;
      case "flop":
        this.dealTurn();
        this.phase = "turn";
        break;
      case "turn":
        this.dealRiver();
        this.phase = "river";
        break;
      case "river":
        this.showdown();
        return;
      default:
        return;
    }

    this.startBettingRound();
  }

  private dealFlop(): void {
    this.deck.pop();
    const dealt: Card[] = [];
    for (let i = 0; i < 3; i++) {
      const card = this.deck.pop()!;
      this.board.push(card);
      dealt.push(card);
      this.pendingEvents.push({
        type: "reveal",
        payload: { slot: i, card, street: "flop" },
      });
    }
    this.logCommunityCards("flop", dealt);
  }

  private dealTurn(): void {
    this.deck.pop();
    const card = this.deck.pop()!;
    this.board.push(card);
    this.pendingEvents.push({
      type: "reveal",
      payload: { slot: 3, card, street: "turn" },
    });
    this.logCommunityCards("turn", [card]);
  }

  private dealRiver(): void {
    this.deck.pop();
    const card = this.deck.pop()!;
    this.board.push(card);
    this.pendingEvents.push({
      type: "reveal",
      payload: { slot: 4, card, street: "river" },
    });
    this.logCommunityCards("river", [card]);
  }

  private runout(): void {
    while (this.board.length < 5) {
      if (this.board.length === 0) this.dealFlop();
      else if (this.board.length === 3) this.dealTurn();
      else if (this.board.length === 4) this.dealRiver();
    }
    this.showdown();
  }

  private showdown(): void {
    this.phase = "showdown";
    const pots = this.computePots();
    const result = this.resolvePots(pots);
    this.phase = "hand-complete";
    this.pendingEvents.push({ type: "handResult", payload: result });
    this.checkEliminations();
    this.emitState();
  }

  /** Max totalBet among players other than `excludeSeatId`. */
  private getMaxOtherContribution(excludeSeatId: number): number {
    let max = 0;
    for (const p of this.players.values()) {
      if (p.seatId === excludeSeatId) continue;
      if (p.totalBet > max) max = p.totalBet;
    }
    return max;
  }

  /** Return uncalled excess to the winner before pot resolution. */
  private returnUncalledToWinner(winnerSeat: number): number {
    const winner = this.players.get(winnerSeat)!;
    const maxOther = this.getMaxOtherContribution(winnerSeat);
    const excess = winner.totalBet - maxOther;
    if (excess <= 0) return 0;

    winner.chips += excess;
    winner.totalBet -= excess;
    winner.betThisRound = Math.min(winner.betThisRound, winner.totalBet);
    this.pendingEvents.push({
      type: "chips",
      payload: {
        fromSeat: null,
        toSeat: winnerSeat,
        toPot: false,
        amount: excess,
      },
    });
    return excess;
  }

  private awardUncalled(winnerSeat: number): void {
    const winner = this.players.get(winnerSeat)!;
    this.returnUncalledToWinner(winnerSeat);
    const pots = this.computePots();
    const total = totalPotAmount(pots);
    winner.chips += total;
    this.logAction(winnerSeat, `Wins ${total}`);
    const wonByFold = this.actionLog.some(
      (entry) => entry.handNumber === this.handNumber && entry.action === "Fold"
    );
    const result: HandResult = {
      handNumber: this.handNumber,
      winners: [
        {
          seatId: winnerSeat,
          displayName: winner.displayName,
          avatarUrl: winner.avatarUrl,
          amount: total,
          potIndex: 0,
          wonByFold,
        },
      ],
      shownCards: [],
      totalAwarded: total,
    };
    this.phase = "hand-complete";
    this.pendingEvents.push({ type: "handResult", payload: result });
    this.resetHandBets();
    this.checkEliminations();
    this.emitState();
  }

  private computePots(winnerSeat?: number): PotLayer[] {
    const soleWinner =
      winnerSeat ??
      (this.getHandSeats().length === 1 ? this.getHandSeats()[0] : undefined);
    const maxOther =
      soleWinner !== undefined
        ? this.getMaxOtherContribution(soleWinner)
        : null;

    const contributions: PlayerContribution[] = [...this.players.values()]
      .filter((p) => p.totalBet > 0)
      .map((p) => {
        let contribution = p.totalBet;
        if (soleWinner !== undefined && p.seatId === soleWinner && maxOther !== null) {
          contribution = Math.min(contribution, maxOther);
        }
        return {
          seatId: p.seatId,
          contribution,
          folded: p.folded,
        };
      });
    return buildSidePots(contributions);
  }

  private resolvePots(pots: PotLayer[]): HandResult {
    const winners: HandResult["winners"] = [];
    const shownCards: HandResult["shownCards"] = [];

    for (let potIndex = 0; potIndex < pots.length; potIndex++) {
      const pot = pots[potIndex]!;
      const eligible = pot.eligibleSeatIds
        .map((seatId) => {
          const player = this.players.get(seatId)!;
          return evaluateHand(seatId, player.holeCards, this.board);
        });

      for (const e of eligible) {
        if (!shownCards.find((s) => s.seatId === e.seatId)) {
          const player = this.players.get(e.seatId)!;
          shownCards.push({
            seatId: e.seatId,
            holeCards: [...player.holeCards],
            bestHand: e.cards,
          });
        }
      }

      const { winners: potWinners, handName } = findPotWinners(eligible);
      const splits = splitPotAmount(pot.amount, potWinners.length);

      potWinners.forEach((w, i) => {
        const player = this.players.get(w.seatId)!;
        player.chips += splits[i]!;
        winners.push({
          seatId: w.seatId,
          displayName: player.displayName,
          avatarUrl: player.avatarUrl,
          amount: splits[i]!,
          potIndex,
          handName,
          wonByFold: false,
        });
        this.pendingEvents.push({
          type: "chips",
          payload: {
            fromSeat: null,
            toSeat: w.seatId,
            toPot: false,
            amount: splits[i]!,
          },
        });
        const winLabel = handName
          ? `Wins ${splits[i]} (${handName})`
          : `Wins ${splits[i]}`;
        this.logAction(w.seatId, winLabel);
      });
    }

    this.resetHandBets();
    const totalAwarded = winners.reduce((sum, w) => sum + w.amount, 0);
    return { handNumber: this.handNumber, winners, shownCards, totalAwarded };
  }

  private resetHandBets(): void {
    for (const p of this.players.values()) {
      p.betThisRound = 0;
      p.totalBet = 0;
    }
  }

  private checkEliminations(): void {
    for (const p of this.players.values()) {
      if (!p.eliminated && p.chips === 0) {
        p.eliminated = true;
        this.eliminationOrder.push(p.seatId);
        this.pendingEvents.push({
          type: "elimination",
          payload: { seatId: p.seatId, userId: p.userId },
        });
      }
    }
  }

  isTournamentComplete(): boolean {
    return this.getActivePlayerCount() <= 1;
  }

  getWinner(): TablePlayer | null {
    const active = [...this.players.values()].filter(
      (p) => !p.eliminated && p.chips > 0
    );
    return active.length === 1 ? active[0]! : null;
  }

  getEliminationOrder(): number[] {
    return [...this.eliminationOrder];
  }

  getFinishPosition(seatId: number): number {
    const winner = this.getWinner();
    if (winner?.seatId === seatId) return 1;
    const idx = this.eliminationOrder.indexOf(seatId);
    if (idx === -1) return 0;
    return this.eliminationOrder.length - idx + 1;
  }

  updateChips(seatId: number, chips: number): void {
    const p = this.players.get(seatId);
    if (p) p.chips = chips;
  }

  getPublicState(): TableState {
    const seats = this.buildPublicSeats();
    const pots = this.computePots();
    const awaitingNextHand =
      this.phase === "hand-complete" || this.phase === "showdown";
    return {
      tournamentId: this.config.tournamentId,
      phase: this.phase,
      board: [...this.board],
      pots,
      totalPot: totalPotAmount(pots),
      seats,
      dealerSeat: this.dealerSeat,
      currentActorSeat: this.currentActorSeat,
      nextDealerSeat: awaitingNextHand ? this.getNextDealerSeat() : null,
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      blindLevel: this.blindLevel + 1,
      handNumber: this.handNumber,
      actionLog: [...this.actionLog],
    };
  }

  private getDisplayBlindRoles(): {
    dealer: number;
    sb: number;
    bb: number;
  } {
    const activeSeats = this.getActiveSeats();

    if (this.phase === "hand-complete" && activeSeats.length >= 2) {
      const nextDealer = this.getNextDealerSeat() ?? this.dealerSeat;
      const { sb, bb } = this.blindSeatsForDealer(nextDealer, activeSeats);
      return { dealer: nextDealer, sb, bb };
    }

    if (
      this.postedSbSeat !== null &&
      this.postedBbSeat !== null &&
      this.phase !== "waiting"
    ) {
      return {
        dealer: this.dealerSeat,
        sb: this.postedSbSeat,
        bb: this.postedBbSeat,
      };
    }

    const basis = activeSeats.length >= 2 ? activeSeats : this.getSeatIds();
    const { sb, bb } = this.blindSeatsForDealer(this.dealerSeat, basis);
    return { dealer: this.dealerSeat, sb, bb };
  }

  private buildPublicSeats(): SeatPublic[] {
    const reviewingHand =
      this.phase === "hand-complete" || this.phase === "showdown";
    const { dealer: dealerSeat, sb: sbSeat, bb: bbSeat } =
      this.getDisplayBlindRoles();

    return [...this.players.values()]
      .filter(
        (p) =>
          !p.eliminated ||
          (reviewingHand && p.holeCards.length > 0)
      )
      .map((p) => ({
        seatId: p.seatId,
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        chipCount: p.chips,
        betThisRound: p.betThisRound,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        isDealer: p.seatId === dealerSeat,
        isSmallBlind: p.seatId === sbSeat,
        isBigBlind: p.seatId === bbSeat,
        lastAction: p.lastAction,
      }));
  }

  private emitState(): void {
    this.pendingEvents.push({
      type: "state",
      payload: this.getPublicState(),
    });
  }
}
