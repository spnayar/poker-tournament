import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ZOOM_MEETING_SDK_VERSION,
  zoomMeetingSdkScriptUrls,
} from "./zoomMeetingSdkLoader";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("zoomMeetingSdkLoader", () => {
  it("pins CDN scripts to the installed @zoom/meetingsdk version", () => {
    const pkg = JSON.parse(
      readFileSync(join(webRoot, "package.json"), "utf8")
    ) as { dependencies: { "@zoom/meetingsdk": string } };
    const declared = pkg.dependencies["@zoom/meetingsdk"].replace(/^\^/, "");
    expect(ZOOM_MEETING_SDK_VERSION).toBe(declared);
  });

  it("loads Zoom React 18 vendors before the embedded UMD (React 19 isolation)", () => {
    const urls = zoomMeetingSdkScriptUrls();
    expect(urls).toEqual([
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/react.min.js`,
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/react-dom.min.js`,
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/redux.min.js`,
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/redux-thunk.min.js`,
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/react-redux.min.js`,
      `https://source.zoom.us/${ZOOM_MEETING_SDK_VERSION}/lib/vendor/lodash.min.js`,
      `https://source.zoom.us/zoom-meeting-embedded-${ZOOM_MEETING_SDK_VERSION}.min.js`,
    ]);
    expect(urls.indexOf(urls[0]!)).toBeLessThan(
      urls.findIndex((u) => u.includes("zoom-meeting-embedded"))
    );
  });
});
