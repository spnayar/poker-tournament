"use client";

import { motion } from "framer-motion";
import {
  COMMUNITY_FLIP_DURATION_SEC,
  HOLE_CARD_DEAL_DURATION_SEC,
} from "./tableAnimation";

const SUIT_SYMBOLS: Record<string, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

const SUIT_COLORS: Record<string, string> = {
  c: "text-slate-900",
  d: "text-red-600",
  h: "text-red-600",
  s: "text-slate-900",
};

const CARD_CLASS =
  "w-11 h-[3.85rem] sm:w-14 sm:h-20 rounded-md sm:rounded-lg shadow-md sm:shadow-lg flex flex-col items-center justify-center select-none";

interface PlayingCardProps {
  card?: string;
  faceDown?: boolean;
  className?: string;
  delay?: number;
  animateDeal?: boolean;
  variant?: "hole" | "community";
}

function CardBack({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${CARD_CLASS} bg-gradient-to-br from-emerald-800 via-slate-800 to-slate-950 border-2 border-emerald-600/70 ${className}`}
    >
      <div className="w-6 h-9 sm:w-8 sm:h-12 rounded border border-amber-400/25" />
    </div>
  );
}

function CardFace({
  card,
  className = "",
}: {
  card: string;
  className?: string;
}) {
  const rank = card[0]!;
  const suit = card[1]!;
  const suitSymbol = SUIT_SYMBOLS[suit] ?? suit;
  const colorClass = SUIT_COLORS[suit] ?? "text-slate-900";

  return (
    <div
      className={`${CARD_CLASS} bg-slate-50 border border-slate-300/90 ${className}`}
    >
      <span className={`text-base sm:text-lg font-bold leading-none ${colorClass}`}>
        {rank}
      </span>
      <span className={`text-lg sm:text-xl leading-none ${colorClass}`}>
        {suitSymbol}
      </span>
    </div>
  );
}

export function PlayingCard({
  card,
  faceDown = false,
  className = "",
  delay = 0,
  animateDeal = true,
  variant = "hole",
}: PlayingCardProps) {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Hole-card deal is skipped after the first table update; board runouts always flip.
  const skipAnimation =
    reducedMotion || (variant !== "community" && !animateDeal);

  if (variant === "community" && card && !faceDown) {
    if (skipAnimation) {
      return <CardFace card={card} className={className} />;
    }

    return (
      <div
        className={`relative ${className}`}
        style={{
          width: "var(--card-w, 2.75rem)",
          height: "var(--card-h, 3.85rem)",
          perspective: "900px",
        }}
      >
        <motion.div
          key={card}
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          initial={{ rotateY: 180 }}
          animate={{ rotateY: 0 }}
          transition={{
            delay,
            duration: COMMUNITY_FLIP_DURATION_SEC,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <CardBack />
          </div>
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardFace card={card} />
          </div>
        </motion.div>
      </div>
    );
  }

  if (faceDown || !card) {
    if (variant === "community" && !card) {
      return (
        <div
          className={`w-11 h-[3.85rem] sm:w-14 sm:h-20 ${className}`}
          aria-hidden
        />
      );
    }

    return (
      <motion.div
        initial={skipAnimation ? false : { scale: 0, rotateY: 180 }}
        animate={{ scale: 1, rotateY: 0 }}
        transition={{ delay, duration: HOLE_CARD_DEAL_DURATION_SEC }}
        className={className}
      >
        <CardBack />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={skipAnimation ? false : { scale: 0, rotateY: 90 }}
      animate={{ scale: 1, rotateY: 0 }}
      transition={{ delay, duration: HOLE_CARD_DEAL_DURATION_SEC }}
      className={className}
    >
      <CardFace card={card} />
    </motion.div>
  );
}

