import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLUB_CONTACT_EMAIL } from "@/lib/clubContact";
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
  it("lists a magic link, an invite signup, and the admin inbox", () => {
    const html = renderToStaticMarkup(<LoginPage />);
    const visible = text(html);

    expect(visible).toContain("1. Already signed up");
    expect(visible).toContain("magic link");
    expect(html).toContain("Email me a login link");
    expect(visible).toContain("2. You were invited");
    expect(visible).toContain("club invite code");
    expect(visible).toContain("game night code");
    expect(html).toContain('href="/register"');
    expect(visible).toContain("3. Neither of those");
    expect(visible).toContain("can't access the site yet");
    expect(html).toContain(`href="mailto:${CLUB_CONTACT_EMAIL}"`);
    expect(html).toContain(CLUB_CONTACT_EMAIL);
  });

  it("tells an unknown email they need an invite code or the admin", () => {
    const html = renderToStaticMarkup(
      <EmailLoginForm callbackUrl="/dashboard" initialNeedsInvite />
    );
    const visible = text(html);

    expect(visible).toContain("isn't signed up");
    expect(visible).toContain("club invite code");
    expect(visible).toContain("game night code does not create an account");
    expect(visible).toContain("login link won't get you in");
    expect(visible).toContain("can't access the site yet");
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
