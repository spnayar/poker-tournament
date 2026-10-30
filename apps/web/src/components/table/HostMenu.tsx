"use client";

import { useEffect, useRef, useState } from "react";

export function HostMenu({
  disabledReason,
  onChop,
}: {
  disabledReason: string | null;
  onChop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950/70 px-2 py-1.5 text-[11px] text-slate-500 hover:text-slate-300 hover:border-slate-700"
      >
        Host
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={disabledReason !== null}
            title={disabledReason ?? undefined}
            onClick={() => {
              setOpen(false);
              onChop();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:text-slate-500 disabled:hover:bg-transparent"
          >
            Chop tournament…
            {disabledReason && (
              <span className="block text-[11px] text-slate-500 mt-0.5">
                {disabledReason}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
