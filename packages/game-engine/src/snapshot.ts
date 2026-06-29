import type { ActionLogEntry, Card, TablePhase } from "@poker/protocol";
import { TableEngine, type TableConfig, type TablePlayer } from "./table";

export interface TableSnapshot {
  config: TableConfig;
  players: TablePlayer[];
  deck: Card[];
  board: Card[];
  phase: TablePhase;
  dealerSeat: number;
  currentActorSeat: number | null;
  smallBlind: number;
  bigBlind: number;
  blindLevel: number;
  handNumber: number;
  currentBet: number;
  lastRaiseSize: number;
  lastFullRaiseTo: number;
  eliminationOrder: number[];
  actionLog: ActionLogEntry[];
  actionLogId: number;
  postedSbSeat: number | null;
  postedBbSeat: number | null;
}

export function tableToSnapshot(table: TableEngine): TableSnapshot {
  return table.toSnapshot();
}

export function tableFromSnapshot(snapshot: TableSnapshot): TableEngine {
  return TableEngine.fromSnapshot(snapshot);
}
