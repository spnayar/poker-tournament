/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { findSdkMediaForName, stripZoomChrome } from "./zoomFaceMedia";

describe("findSdkMediaForName", () => {
  it("finds canvas inside a named gallery frame", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="gallery-video-container__video-frame">
        <canvas width="320" height="180"></canvas>
        <span class="video-avatar__avatar-name">Sanjay Nayar</span>
      </div>
      <div class="gallery-video-container__video-frame">
        <canvas width="320" height="180"></canvas>
        <span class="video-avatar__avatar-name">Alex</span>
      </div>
    `;
    const media = findSdkMediaForName(root, "Sanjay Nayar");
    expect(media).toBeInstanceOf(HTMLCanvasElement);
    expect(
      media?.closest(".gallery-video-container__video-frame")?.textContent
    ).toContain("Sanjay Nayar");
  });
});

describe("stripZoomChrome", () => {
  it("hides shield / meeting-info chrome nodes", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="suspension-header">hdr</div>
      <div class="meeting-info-encryption-icon__icon-wrap">shield</div>
      <button class="gallery-video-container__switch-button">grid</button>
    `;
    stripZoomChrome(root);
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (!(el instanceof HTMLElement)) continue;
      if (
        el.className.includes("suspension-header") ||
        el.className.includes("encryption") ||
        el.className.includes("switch-button")
      ) {
        expect(el.style.display).toBe("none");
      }
    }
  });
});
