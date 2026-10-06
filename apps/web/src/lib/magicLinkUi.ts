export function magicLinkSendFailed(
  result: { error?: string | null; ok?: boolean } | undefined | null
): boolean {
  if (!result) return false;
  return Boolean(result.error) || result.ok === false;
}

export const MAGIC_LINK_SEND_ERROR =
  "Could not send a login email. Set RESEND_API_KEY in the repo-root .env, restart pnpm dev, and check the web server terminal for a console link.";

export const REGISTER_SEND_ERROR =
  "Account created, but we could not send a login email. Set RESEND_API_KEY in the repo-root .env, restart pnpm dev, then use Email me a login link — or copy the console URL from the web server terminal.";
