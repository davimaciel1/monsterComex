import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

const HASH_ITERATIONS = 120_000;
const HASH_KEY_LENGTH = 64;
const HASH_DIGEST = "sha512";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }

  const computed = pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST).toString("hex");

  const bufferStored = Buffer.from(hash, "hex");
  const bufferComputed = Buffer.from(computed, "hex");

  if (bufferStored.length !== bufferComputed.length) {
    return false;
  }

  return timingSafeEqual(bufferStored, bufferComputed);
}
