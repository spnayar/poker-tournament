const CLUB_LOGO_PATH = "/poker-table-club-logo.png";
export const CLUB_LOGO_ALT = "Poker Table Club chip logo";
/** Public host that already serves the chip; used when NEXTAUTH_URL is local/http. */
export const CLUB_LOGO_FALLBACK_ORIGIN = "https://www.pokertableclub.com";

function publicHttpsOrigin(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Absolute HTTPS URL for the club chip in HTML email.
 * Gmail/M365 cannot load relative or localhost srcs — only a public https origin.
 * Prefer NEXTAUTH_URL when it is public HTTPS; otherwise the production site.
 */
export function clubLogoAbsoluteUrl(): string {
  return `${publicHttpsOrigin(process.env["NEXTAUTH_URL"]) ?? CLUB_LOGO_FALLBACK_ORIGIN}${CLUB_LOGO_PATH}`;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Origin for in-app links in email (localhost is OK so Cloud/dev clicks work). */
export function appOrigin(): string {
  const raw = process.env["NEXTAUTH_URL"]?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // fall through
    }
  }
  return CLUB_LOGO_FALLBACK_ORIGIN;
}

export function absoluteAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${appOrigin()}${normalized}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailCta(href: string, label: string): string {
  return `<p style="margin:28px 0;"><a href="${escapeHtml(href)}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

export function emailBody(text: string): string {
  return `<p style="color:#94a3b8;font-size:14px;line-height:1.5;">${text}</p>`;
}

export function emailFinePrint(text: string): string {
  return `<p style="color:#64748b;font-size:12px;line-height:1.4;">${text}</p>`;
}

/** Shared slate/emerald chrome used by magic-link and invite mail. */
export function clubEmailHtml(opts: {
  /** Visible title. Pass null to omit it. Defaults to "Poker Night". */
  heading?: string | null;
  innerHtml: string;
}): string {
  const logoSrc = clubLogoAbsoluteUrl();
  const heading = opts.heading === undefined ? "Poker Night" : opts.heading;
  const headingHtml =
    heading == null || heading === ""
      ? ""
      : `    <h1 style="color:#f8fafc;font-size:22px;margin:0 0 12px;">${escapeHtml(heading)}</h1>\n`;
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;">
    <p style="margin:0 0 16px;text-align:center;line-height:0;">
      <img src="${logoSrc}" alt="${CLUB_LOGO_ALT}" width="48" height="48" style="width:48px;height:48px;border:0;border-radius:50%;display:inline-block;" />
    </p>
${headingHtml}    ${opts.innerHtml}
  </div>
</div>`;
}
