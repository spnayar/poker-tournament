const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker/db", "@poker/protocol"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

module.exports = nextConfig;
