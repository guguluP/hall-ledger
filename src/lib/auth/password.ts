import bcrypt from "bcryptjs";

const COMMON = [
  "password",
  "password1",
  "password12",
  "password123",
  "1234567890",
  "123456789",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "letmein123",
  "admin12345",
  "welcome123",
  "changeme123",
  "hallledger",
  "hallledger1",
  "passw0rd",
  "abc1234567",
  "1111111111",
  "0000000000",
  "trustno1",
];

export const COMMON_PASSWORDS = new Set(COMMON);

const DUMMY_HASH = bcrypt.hashSync("not-a-real-account", 12);

export function passwordIssue(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (Buffer.byteLength(password) > 72) return "Password must be at most 72 bytes.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "Choose a less common password.";
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Spend a comparable bcrypt when the email is unknown. */
export function dummyVerify(password: string): Promise<boolean> {
  return bcrypt.compare(password, DUMMY_HASH);
}
