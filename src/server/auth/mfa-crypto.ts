import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = "v1";
const MFA_AAD_PREFIX = "careflow:mfa:v1:";

function readEncryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) throw new Error("Invalid MFA encryption key");
  return key;
}

export function encryptMfaSecret(secret: string, encodedKey: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readEncryptionKey(encodedKey), iv);
  cipher.setAAD(Buffer.from(`${MFA_AAD_PREFIX}${userId}`, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMfaSecret(envelope: string, encodedKey: string, userId: string): string {
  try {
    const [version, ivPart, tagPart, ciphertextPart, extra] = envelope.split(".");
    if (version !== ENVELOPE_VERSION || !ivPart || !tagPart || !ciphertextPart || extra) {
      throw new Error("Malformed envelope");
    }

    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("Malformed envelope");
    }

    const decipher = createDecipheriv("aes-256-gcm", readEncryptionKey(encodedKey), iv);
    decipher.setAAD(Buffer.from(`${MFA_AAD_PREFIX}${userId}`, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Invalid encrypted MFA secret");
  }
}

export function normalizeRecoveryCode(input: string): string {
  const code = input.normalize("NFKC").toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{10}$/.test(code)) throw new Error("Invalid recovery code");
  return code;
}

export function hashRecoveryCode(input: string, pepper: string): string {
  return createHmac("sha256", pepper).update(normalizeRecoveryCode(input), "utf8").digest("hex");
}
