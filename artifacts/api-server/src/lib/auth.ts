import { createHash, randomBytes } from "crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + password).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const checkHash = createHash("sha256").update(salt + password).digest("hex");
  return checkHash === hash;
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}
