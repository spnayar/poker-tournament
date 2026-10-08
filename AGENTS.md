# AGENTS.md — Poker Tournament

## Project layout

- `apps/web` — Next.js frontend (App Router)
- `apps/game-server` — WebSocket game server (port 3001)
- `packages/game-engine` — Pure TS poker logic (no I/O)
- `packages/protocol` — Shared types and Zod schemas
- `packages/db` — Prisma client and schema

## Conventions

- Use `@poker/*` workspace packages; do not duplicate protocol types
- All game logic changes go in `packages/game-engine` with unit tests
- Dollar amounts are ledger cents (`buyInCents`, `payoutCents`) — never real payments
- WebSocket events must never leak opponent hole cards pre-showdown
- Match existing Tailwind + slate/emerald/amber color scheme for UI

## Commands

```bash
pnpm dev          # web :3000 + game-server :3001
pnpm test         # vitest in game-engine
pnpm db:push      # sync Prisma schema
```

## Testing focus

- `packages/game-engine/src/sidePots.test.ts` — side pot math
- Verify WS payloads exclude other players' cards before showdown

## Impeccable (design skill)

Cursor skill installed under `.cursor/skills/impeccable`. Durable context: root `PRODUCT.md` + `DESIGN.md`.

```text
/impeccable polish [surface]   # final design pass
/impeccable critique [surface] # UX review
/impeccable audit [surface]    # a11y / quality
/impeccable document           # refresh DESIGN.md from code
```

Refresh skills: `npx impeccable update` (Node ≥ 22.18). Hook: `.cursor/hooks.json` runs the design detector before UI edits.
