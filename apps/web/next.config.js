const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker/db", "@poker/protocol"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  serverExternalPackages: ["next-auth"],
};

module.exports = nextConfig;
