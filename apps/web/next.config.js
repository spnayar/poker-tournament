const path = require("path");
const { loadRootEnv } = require("./load-root-env.cjs");

loadRootEnv(path.join(__dirname, "../../.env"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker/db", "@poker/protocol", "next-auth", "@zoom/meetingsdk"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  webpack: (config) => {
    // Meeting SDK pulls optional Node canvas; keep the client bundle free of it.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      canvas: false,
    };
    return config;
  },
};

module.exports = nextConfig;
