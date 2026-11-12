import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLUB_CONTACT_EMAIL, CLUB_INSTAGRAM_URL } from "@/lib/clubContact";
import { EmailLoginForm } from "@/components/EmailLoginForm";
import RegisterPage from "../register/page";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

function text(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, " ");
}

describe("login access paths", () => {
  it("leads with email magic link and a light contact path", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    const visible = text(html);

    expect(visible).toContain("Poker Night");
    expect(visible).toContain("No password");
    expect(html).toContain("Email me a login link");
    expect(visible).not.toContain("1. Already signed up");
    expect(visible).not.toContain("2. You were invited");
    expect(visible).not.toContain("3. Neither of those");
    expect(html).not.toContain('href="/register"');
    expect(visible).toContain("club invite code");
    expect(html).toContain(`href="mailto:${CLUB_CONTACT_EMAIL}"`);
    expect(html).toContain(CLUB_CONTACT_EMAIL);
    expect(html).toContain(CLUB_INSTAGRAM_URL);
    expect(visible).toContain("@pokertableclub");
  });

  it("tells an unknown email they need an invite code or the admin", () => {
    const html = renderToStaticMarkup(
      <EmailLoginForm callbackUrl="/dashboard" initialNeedsInvite />
    );
    const visible = text(html);

    expect(visible).toContain("No account for this email yet");
    expect(visible).toContain("club invite code");
    expect(visible).toContain("not a game night code");
    expect(html).toContain(`href="mailto:${CLUB_CONTACT_EMAIL}"`);
    expect(html).toContain("Create account and send link");
  });

  it("points registration without a code at the admin inbox", () => {
    const html = renderToStaticMarkup(<RegisterPage />);
    const visible = text(html);

    expect(visible).toContain("can't access the site yet");
    expect(visible).toContain("game night code does not create an account");
    expect(html).toContain(`href="mailto:${CLUB_CONTACT_EMAIL}"`);
    expect(html).toContain('href="/login"');
  });
});
