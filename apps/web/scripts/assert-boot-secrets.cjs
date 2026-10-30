/**
 * Production boot gate for the web app. Runs before `next start`.
 * Does not run during `next build`.
 */
const path = require("path");
const { loadRootEnv } = require("../load-root-env.cjs");
const { webBootSecretError } = require("@poker/protocol/server");

loadRootEnv(path.join(__dirname, "../../../.env"));

const message = webBootSecretError({
  nodeEnv: process.env.NODE_ENV,
  jwtSecret: process.env.JWT_SECRET,
  nextAuthSecret: process.env.NEXTAUTH_SECRET,
});

if (message) {
  console.error(message);
  process.exit(1);
}
