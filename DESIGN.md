---
name: Poker Table Club
description: Friends-only Poker Night — dark slate clubhouse UI with emerald actions and amber stakes.
colors:
  slate-950: "#020617"
  slate-900: "#0f172a"
  slate-800: "#1e293b"
  slate-700: "#334155"
  slate-400: "#94a3b8"
  slate-100: "#f1f5f9"
  emerald-600: "#059669"
  emerald-500: "#10b981"
  emerald-400: "#34d399"
  amber-400: "#fbbf24"
  amber-300: "#fcd34d"
  felt: "#1a5c38"
  felt-dark: "#0f3d25"
  felt-light: "#2d7a4f"
  danger: "#f87171"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 600
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  "2xl": "1rem"
  full: "9999px"
spacing:
  panel: "1.25rem"
  section: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.emerald-600}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.emerald-500}"
    textColor: "#ffffff"
  panel:
    backgroundColor: "{colors.slate-900}"
    textColor: "{colors.slate-100}"
    rounded: "{rounded.xl}"
  input:
    backgroundColor: "{colors.slate-800}"
    textColor: "{colors.slate-100}"
    rounded: "{rounded.lg}"
---

# Design System: Poker Table Club

## Overview

**Creative North Star: "Home-Game Clubhouse"**

The UI should feel like a private club night: dark slate rooms, emerald “go” controls, amber for chips/stakes/timers, and a green felt oval when you sit down to play. It is intimate and operational — not a neon casino, not a SaaS marketing template.

Density is medium-tight on operate surfaces (dashboard, lobby, admin) and viewport-locked at the live table. Brand shows up as the circular chip logo and restrained lockups (“Poker Night”), not as decorative overlays on the felt.

**Key Characteristics:**
- Dark slate canvases (`slate-950` / `slate-900`) with emerald primary actions and amber monetary/chip signals
- Chip logo as the only mandatory pictorial brand mark
- Live table: no page scroll for cards or actions; single horizontal action bar
- Crisp modern craft; reject purple/cream/Inter AI-default aesthetics

## Colors

Clubhouse dark with two accents: emerald for affirmative actions and status, amber for stakes and attention.

### Primary
- **Felt Emerald** (#059669 / emerald-600): Primary buttons, selected states, success links. Hover lifts to emerald-500.

### Secondary
- **Chip Amber** (#fbbf24 / amber-400): Chip counts, pots, timers, monetary emphasis, dealer/attention cues. Never the default page background.

### Tertiary
- **Table Felt** (#1a5c38) with dark/light stops: Only on the live oval table surface, not general chrome.

### Neutral
- **Club Void** (#020617 / slate-950): App canvas
- **Club Panel** (#0f172a / slate-900): Cards/panels
- **Club Border** (#1e293b / slate-800): Borders and field fills
- **Muted Ink** (#94a3b8 / slate-400): Supporting copy
- **Bright Ink** (#f1f5f9 / slate-100): Primary text

### Named Rules
**The Two-Accent Rule.** Emerald means act/confirm; amber means money/chips/time. Do not introduce a third accent family (especially purple or pink) for decoration.

**The No-AI-Slop Rule.** No purple-indigo gradients, warm cream “AI beige” canvases, or Inter-as-brand typography.

## Typography

**Display/Body Font:** System UI sans (current incumbent; no custom webfont locked yet)
**Mono Font:** `ui-monospace` / Menlo for chips, codes, join codes, and ledger amounts

**Character:** Practical and legible at arm’s length on phones. Hierarchy comes from weight and slate contrast, not display serifs.

### Hierarchy
- **Title** (bold, ~1.875rem): Auth and page headings (“Poker Night”)
- **Body** (regular, 16px): Instructions and panel copy
- **Label** (semibold, smaller, often uppercase tracking on section labels)
- **Mono stakes** (semibold mono): Chip stacks, pots, join codes, ledger cents

### Named Rules
**The Stakes-Are-Mono Rule.** Chip counts, pots, and money-like ledger figures use mono so they scan as numbers, not marketing copy.

## Layout

Operate surfaces: centered max-width columns (`max-w-md` on auth; wider stacks on dashboard/lobby) with `rounded-xl`/`rounded-2xl` panels and consistent gap rhythm (~16–24px).

**Live table (hard constraint):** The play surface — seats, board cards, pot, and the action bar — must fit the viewport. Never require document/page scroll to see hole/board cards or to take an action. The action controls are a **single horizontal bar**. Secondary history (Action Log) may scroll inside its own panel only.

Emails: HTML tables on `#0f172a` with the same slate/emerald/amber vocabulary (`emailLayout` chrome).

## Elevation & Depth

Mostly tonal layering on dark surfaces: panels are slate-900 on slate-950 with 1px slate-800 borders. Shadows are used sparingly (`shadow-xl` on auth panels; deeper shadow under the felt oval). Prefer border + contrast over stacked glow.

### Named Rules
**The Flat Club Rule.** No neon glows, multi-layer colorful shadows, or glassmorphism as default chrome.

## Shapes

- Panels: `rounded-xl` to `rounded-2xl`
- Controls: `rounded-lg`
- Avatars, chip logo, seat rings: `rounded-full`
- Felt: large ellipse (`rounded-[50%]`) with thick amber-tinted wood rim

## Components

### Buttons
- **Shape:** `rounded-lg`
- **Primary:** emerald-600 fill, white label, full-width common on auth
- **Hover:** emerald-500
- **Secondary:** slate-800 fill, slate-200 text; borders slate-700

### Brand
- **Chip logo:** circular mark; large on auth, small in lockups and table chrome (not stamped on the felt center as decoration)
- **Lockup:** chip + “Poker Night” in semibold slate-100

### Panels / Containers
- slate-900 fill, slate-800 border, optional light shadow; padding ~20px
- Use panels for interactive groupings (forms, invite lists), not as decorative card stacks in heroes

### Inputs
- slate-800 fill, slate-100 text, slate-700 border; focus ring emerald-500

### Live table
- Felt gradient oval; amber pot/chip mono; seat rings; **single horizontal ActionPanel bar** pinned in the play chrome
- Away / status badges stay compact; do not push cards or actions below the fold

### Emails
- Helvetica/Arial stack on slate-900 body; emerald join codes; amber settle amounts — match product chrome, not marketing templates

## Do's and Don'ts

### Do:
- **Do** keep slate/emerald/amber as the only accent system for product UI and mail.
- **Do** keep table cards and the horizontal action bar visible without page scroll.
- **Do** show the chip logo on auth and chrome lockups.
- **Do** use mono for chips, codes, and ledger amounts.

### Don't:
- **Don't** use purple, cream-paper, or Inter-as-identity defaults.
- **Don't** put real-money payment UI or imply the app moves cash.
- **Don't** reveal opponent hole cards in UI before showdown.
- **Don't** cover the felt with floating promo badges, pill clusters, or card-nested-in-card marketing chrome.
- **Don't** require vertical page scroll to fold/call/raise or to read the board.
