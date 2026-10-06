const path = require("path");
const { loadRootEnv } = require("./load-root-env.cjs");

loadRootEnv(path.join(__dirname, "../../.env"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@poker/db", "@poker/protocol", "next-auth"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

module.exports = nextConfig;
