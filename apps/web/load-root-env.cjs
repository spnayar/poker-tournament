const fs = require("fs");

/**
 * Fill blank process.env keys from the repo-root .env.
 * Next.js only auto-loads apps/web/.env*; prisma and the game server already
 * read the root file. Empty RESEND_API_KEY="" in apps/web/.env must not hide
 * a real key in the root .env.
 */
function parseDotEnv(contents) {
  const out = {};
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function applyBlankEnv(parsed, env = process.env) {
  for (const [key, value] of Object.entries(parsed)) {
    const current = env[key];
    if (current === undefined || String(current).trim() === "") {
      env[key] = value;
    }
  }
  return env;
}

function loadRootEnv(envPath) {
  try {
    const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
    applyBlankEnv(parsed);
    return parsed;
  } catch {
    return null;
  }
}

module.exports = { parseDotEnv, applyBlankEnv, loadRootEnv };
