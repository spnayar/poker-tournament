const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker/db", "@poker/protocol", "next-auth"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

module.exports = nextConfig;
