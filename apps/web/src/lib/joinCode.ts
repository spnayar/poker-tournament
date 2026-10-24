import * as crypto from "node:crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** New nights. Existing 4-character codes stay valid; nothing rewrites them. */
export const NEW_JOIN_CODE_LENGTH = 8;

type IndexSource = (max: number) => number;

const cryptoIndex: IndexSource = (max) => crypto.randomInt(max);

export function generateJoinCode(
  length = NEW_JOIN_CODE_LENGTH,
  nextIndex: IndexSource = cryptoIndex
): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARSET[nextIndex(CHARSET.length)];
  }
  return code;
}

export async function generateUniqueJoinCode(
  exists: (code: string) => Promise<boolean>,
  nextIndex: IndexSource = cryptoIndex
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode(NEW_JOIN_CODE_LENGTH, nextIndex);
    if (!(await exists(code))) return code;
  }
  return generateJoinCode(NEW_JOIN_CODE_LENGTH, nextIndex);
}
