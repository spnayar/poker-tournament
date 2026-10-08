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

## Auth (magic link)

There is no customer password. Register with display name, email, and the invite code. Sign-in emails a one-time link (15 minutes). After you click it, the session cookie on that browser lasts about a year.

Set `RESEND_API_KEY` in the **repo-root** `.env` (the same file as `DATABASE_URL`) so Next.js, Prisma, and the game server all see it. `EMAIL_FROM` defaults to `Poker Night <noreply@mail.pokertableclub.com>` (overridable). Reply-To is `info@pokertableclub.com`. Restart `pnpm dev` after changing env.

Confirm the web process loaded the key: open http://localhost:3000/api/health — `env.RESEND_API_KEY` must be `true`. Then register or request a link. Resend → Emails should show subject **Your Poker Night login link**. If the key is missing, non-production prints `[auth] Magic link callback URL (non-prod):` in the **web** terminal (not the game-server terminal) and Resend is never called.

Leave Microsoft 365 on the apex domain; app mail uses the `mail.` subdomain.

## Admin

Site owner tools live at `/admin` on Sanjay’s existing magic-link user (`User.role` plus `ADMIN_EMAILS`). There is no second password. `spnayar@gmail.com` and `info@pokertableclub.com` are always treated as admins (env allowlist can add more). Non-admins get a normal 404. From admin you can list accounts, set free/paid (label only), invite a player by email, and see site-wide usage. Do not advertise the URL.

## Development

```bash
pnpm test          # Run game engine tests
pnpm db:studio     # Prisma Studio
```

## Security

- Hole cards are sent only to the owning player via WebSocket
- All dealing, betting validation, and pot math run server-side
- JWT auth required for game server connections
