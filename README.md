# Poker Tournament

Friends-only Texas Hold'em tournament site. Server-authoritative NLHE with side pots, animated table UI, and ledger-only buy-in tracking.

**No real money is stored or transferred by this application.**

## Stack

- **apps/web** — Next.js 15, NextAuth, Tailwind, Framer Motion, Socket.io client
- **apps/game-server** — Express + Socket.io game server
- **packages/game-engine** — Pure TypeScript NLHE engine with side-pot support
- **packages/protocol** — Shared Zod schemas and event types
- **packages/db** — Prisma + PostgreSQL

## Quick Start

```bash
# Start Postgres + Redis
docker compose up -d

# Copy env and install
cp .env.example .env
pnpm install

# Database
pnpm db:push

# Run web + game server
pnpm dev
```

- Web: http://localhost:3000
- Game server: http://localhost:3001

Default invite code: `friends-only` (set `INVITE_CODE` in `.env`)

## Development

```bash
pnpm test          # Run game engine tests
pnpm db:studio     # Prisma Studio
```

## Security

- Hole cards are sent only to the owning player via WebSocket
- All dealing, betting validation, and pot math run server-side
- JWT auth required for game server connections
