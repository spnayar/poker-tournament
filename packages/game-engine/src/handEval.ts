import { Hand } from "pokersolver";
import type { Card } from "@poker/protocol";

export function cardToPokersolver(card: Card): string {
  const rank = card[0]!;
  const suit = card[1]!;
  const suitMap: Record<string, string> = {
    c: "c",
    d: "d",
    h: "h",
    s: "s",
  };
  return `${rank}${suitMap[suit] ?? suit}`;
}

type PokersolverCard = { value: string; suit: string };

export function pokersolverToCard(card: string | PokersolverCard): Card {
  if (typeof card === "string") {
    if (card.length === 3 && card.startsWith("10")) {
      return `T${card[2]!.toLowerCase()}` as Card;
    }
    return card as Card;
  }

  const rank = card.value === "10" ? "T" : card.value;
  const suit = card.suit.toLowerCase();
  return `${rank}${suit}` as Card;
}

export interface EvaluatedHand {
  seatId: number;
  hand: ReturnType<typeof Hand.solve>;
  /** The five cards that form the evaluated hand (hole + board). */
  cards: Card[];
}

type SolvedHand = ReturnType<typeof Hand.solve> & {
  cards: Array<string | PokersolverCard>;
};

export function evaluateHand(
  seatId: number,
  holeCards: Card[],
  board: Card[]
): EvaluatedHand {
  const allCards = [...holeCards, ...board].map(cardToPokersolver);
  const hand = Hand.solve(allCards) as SolvedHand;
  const cards = hand.cards.map(pokersolverToCard);
  return { seatId, hand, cards };
}

export function findPotWinners(
  eligible: EvaluatedHand[]
): { winners: EvaluatedHand[]; handName: string } {
  if (eligible.length === 0) return { winners: [], handName: "" };
  if (eligible.length === 1) {
    return {
      winners: eligible,
      handName: eligible[0]!.hand.descr,
    };
  }
  const hands = eligible.map((e) => e.hand);
  const winningHands = Hand.winners(hands);
  const winners = eligible.filter((e) => winningHands.includes(e.hand));
  return {
    winners,
    handName: winners[0]?.hand.descr ?? "",
  };
}

export function splitPotAmount(
  amount: number,
  winnerCount: number
): number[] {
  const base = Math.floor(amount / winnerCount);
  const remainder = amount % winnerCount;
  return Array.from({ length: winnerCount }, (_, i) =>
    base + (i < remainder ? 1 : 0)
  );
}
