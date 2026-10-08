/** Visual treatment for seat last-action labels on the felt. */
export function lastActionTone(action: string): {
  text: string;
  ring: string;
} {
  const a = action.toLowerCase();
  if (a.startsWith("fold")) {
    return { text: "text-red-300", ring: "bg-red-950/70 border-red-500/40" };
  }
  if (a.startsWith("check")) {
    return { text: "text-slate-200", ring: "bg-slate-800/80 border-slate-500/40" };
  }
  if (a.startsWith("call")) {
    return { text: "text-sky-200", ring: "bg-sky-950/70 border-sky-500/40" };
  }
  if (a.startsWith("bet") || a.startsWith("raise")) {
    return {
      text: "text-emerald-200",
      ring: "bg-emerald-950/70 border-emerald-500/45",
    };
  }
  if (a.startsWith("all-in") || a.startsWith("wins")) {
    return {
      text: "text-amber-200",
      ring: "bg-amber-950/75 border-amber-500/50",
    };
  }
  if (a.startsWith("sb") || a.startsWith("bb")) {
    return { text: "text-slate-300", ring: "bg-slate-900/70 border-slate-600/40" };
  }
  return { text: "text-slate-200", ring: "bg-slate-900/70 border-slate-600/40" };
}
