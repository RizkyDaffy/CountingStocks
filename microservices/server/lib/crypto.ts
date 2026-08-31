import bcrypt from "bcryptjs";
import crypto from "crypto";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export const hashPin = hashPassword;

export async function verifyHash(
  plain: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (stored.startsWith("$2")) {
    const valid = await bcrypt.compare(plain, stored);
    return { valid, needsRehash: false };
  }
  const legacyHash = crypto.createHash("sha256").update(plain).digest("hex");
  const valid = legacyHash === stored;
  return { valid, needsRehash: valid };
}
