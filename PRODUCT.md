# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friends who host and play private Texas Hold'em game nights together — typically on a phone or laptop at the table, sometimes joining remotely. Primary jobs: start or join a night quickly, play hands without fighting the UI, and settle ledger balances afterward.

Site owner (admin) manages accounts and usage; players do not need a separate admin experience.

## Product Purpose

**Poker Table Club** (in-app chrome often says **Poker Night**) runs friends-only NLHE tournaments end-to-end: lobby, live table, results, and settle-up. Success means a night runs smoothly — dealing, betting, side pots, blinds — with clear ledger buy-ins/payouts and no confusion about money handling.

## Positioning

Server-authoritative home-game poker for a private club: real NLHE rules and side pots, animated table play, and **ledger cents only** (`buyInCents` / `payoutCents`). The product never stores or transfers real money. Neighboring “poker apps” that monetize or run public cash games cannot truthfully claim this friends-only ledger model.

## Operating Context

- Domain: `pokertableclub.com`. App email via Resend (`mail.pokertableclub.com`); human inbox `info@pokertableclub.com`.
- Auth: magic link only (no customer password); invite code `friends-only` to create accounts until public launch.
- Stack: Next.js web (`apps/web`), Socket.io game server (`apps/game-server`), pure TS engine (`packages/game-engine`), shared protocol (`packages/protocol`), Prisma/Postgres (`packages/db`).
- Play is often multiplayer at one physical table with phones, plus remote seats; Grok Bot is used for QA on live tables.

### Surfaces

| Surface | Role |
|---------|------|
| Landing `/` | Redirects into the app (dashboard → login if signed out) |
| Login / register / check-email | Magic-link auth and friends-only signup |
| Dashboard | Host or join nights, stats, create tournament |
| Lobby | Pre-start tournament room, invites, seating |
| Live table | In-hand play: seats, cards, pot, actions |
| Results / night recap | Session outcomes and fun facts |
| Profile / settle-up | Avatar, ledger settle transfers |
| Admin `/admin` | Owner-only usage and users (not advertised) |
| Emails | Magic link, game-night invite, night recap |

## Capabilities and Constraints

- NLHE with side pots; all dealing, betting validation, and pot math are server-side.
- WebSocket events must never leak opponent hole cards before showdown.
- Dollar amounts are ledger cents — never real payments on-site.
- Disconnect: Away badge, short grace, autofold, same-seat rejoin.
- **Hard table UX rule:** never require page scroll to see cards or take actions. Fit the play surface (cards, seats, pot, action controls) in the viewport. Player actions live in a **single horizontal action bar**. Action Log may scroll inside its own panel.
- Game logic changes belong in `packages/game-engine` with unit tests.

## Brand Commitments

- Brand name: **Poker Table Club**; product/UI lockup often **Poker Night**.
- Logo: circular chip mark (`apps/web/public/poker-table-club-logo.png`); alt text “Poker Table Club chip logo”.
- Palette commitment: **slate / emerald / amber** (felt greens for the table). Prefer crisp, modern UI.
- Explicit anti-defaults: avoid purple-on-white / purple-indigo gradients, warm cream “AI beige”, Inter/Roboto/Arial-as-identity, and other generic AI-slop patterns (Impeccable principles).

## Evidence on Hand

- Live logo asset and `BrandMark` / `BrandLockup` components in `apps/web`.
- Incumbent Tailwind UI across auth, dashboard, lobby, table, profile, admin, and HTML email chrome.
- Do not invent testimonials, pricing tiers, or public-launch claims.

## Product Principles

1. **Home game first** — optimize for friends at a table, not casino spectacle or public matchmaking.
2. **Ledger honesty** — always communicate that amounts are tracking only; never imply real money moves through the app.
3. **Play without chrome friction** — at the table, cards and actions stay in view; one horizontal action bar.
4. **Server truth** — UI reflects authoritative engine state; never trust the client for cards or pots.
5. **Quiet club branding** — slate/emerald/amber and the chip mark; personality in craft, not loud marketing chrome.

## Accessibility & Inclusion

Touch-friendly controls at the table; respect safe-area insets on notched phones. Prefer readable contrast on dark slate surfaces (amber/emerald accents on slate-950/900). No product-specific WCAG audit target is recorded yet.
