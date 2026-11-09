import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Codes à usage limité dans le temps (TOTP, RFC 6238, fondé sur HOTP, RFC 4226).
 * Réglages compris par toutes les applications : SHA-1, 6 chiffres, 30 secondes.
 * Module pur : l'heure et le dernier pas accepté sont fournis par l'appelant.
 */
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_S = 30;
/** Un pas d'écart toléré de chaque côté, pour une horloge de téléphone un peu décalée (RFC 6238, § 5.2). */
export const TOTP_WINDOW = 1;
/** 160 bits, la taille recommandée par la RFC 4226 (§ 4, R6). */
export const TOTP_SECRET_BYTES = 20;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES);
}

/** Base32 sans remplissage (RFC 4648), le format attendu par les applications. */
export function base32(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return bits > 0 ? out + BASE32[(value << (5 - bits)) & 31] : out;
}

export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(message).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, "0");
}

export function totpStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_S);
}

export function totp(secret: Uint8Array, nowMs: number, digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(nowMs), digits);
}

/**
 * Cherche le pas auquel correspond le code, dans la tolérance et strictement après `lastStep`.
 * Renvoie ce pas (à mémoriser pour qu'il ne resserve pas), ou null.
 * Tous les pas sont comparés : la durée ne dépend pas de celui qui correspond.
 */
export function matchTotp(secret: Uint8Array, code: string, nowMs: number, lastStep: number): number | null {
  if (!new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code)) return null;
  const given = Buffer.from(code);
  const now = totpStep(nowMs);
  let found: number | null = null;
  for (let step = now - TOTP_WINDOW; step <= now + TOTP_WINDOW; step++) {
    if (step < 0) continue;
    const same = timingSafeEqual(Buffer.from(hotp(secret, step)), given);
    if (same && step > lastStep && found === null) found = step;
  }
  return found;
}

/** Adresse lue par les applications dans le QR code (format « Key Uri » de Google Authenticator). */
export function otpauthUri(secret: Uint8Array, account: string, issuer: string): string {
  const query = `secret=${base32(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_S}`;
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${query}`;
}
