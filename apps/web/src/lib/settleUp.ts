import {
  SETTLE_UP_PROVIDERS,
  SettleUpMethodsSchema,
  parseSettleUpMethods,
  type SettleUpMethod,
  type SettleUpProvider,
} from "@poker/protocol";

export type { SettleUpMethod, SettleUpProvider };
export { SETTLE_UP_PROVIDERS, parseSettleUpMethods };

export const SETTLE_UP_LABELS: Record<SettleUpProvider, string> = {
  PAYPAL: "PayPal",
  VENMO: "Venmo",
  CASH_APP: "Cash App",
  APPLE_PAY: "Apple Pay",
  ZELLE: "Zelle",
};

export const SETTLE_UP_HINTS: Record<SettleUpProvider, string> = {
  PAYPAL: "Email or paypal.me link",
  VENMO: "Username, phone, or link",
  CASH_APP: "$cashtag or link",
  APPLE_PAY: "Phone or email",
  ZELLE: "Phone or email",
};

export const SETTLE_UP_DISCLAIMER =
  "Poker Table Club does not move money. Friends use these details to settle ledger balances off-site.";

export function settleUpProviderLabel(provider: SettleUpProvider): string {
  return SETTLE_UP_LABELS[provider];
}

export function formatSettleUpMethod(method: SettleUpMethod): string {
  return `${SETTLE_UP_LABELS[method.provider]}: ${method.contact}`;
}

/** Validate and normalize a PATCH body for settle-up methods. */
export function parseSettleUpMethodsInput(
  raw: unknown
): { ok: true; methods: SettleUpMethod[] } | { ok: false; error: string } {
  const parsed = SettleUpMethodsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid settle-up methods — pick a provider and add a link, email, or phone",
    };
  }
  return {
    ok: true,
    methods: parsed.data.map((m) => ({
      provider: m.provider,
      contact: m.contact.trim(),
    })),
  };
}
