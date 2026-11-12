const path = require("path");
const { loadRootEnv } = require("./load-root-env.cjs");

loadRootEnv(path.join(__dirname, "../../.env"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Meeting SDK Component View is loaded at runtime from Zoom CDN UMD + React 18
  // vendors (see zoomMeetingSdkLoader.ts). Do not transpile/bundle @zoom/meetingsdk —
  // its ESM build resolves to app React 19 and crashes on ReactCurrentOwner.
  transpilePackages: ["@poker/db", "@poker/protocol", "next-auth"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  webpack: (config) => {
    // Guard if anything still pulls optional Node canvas.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
