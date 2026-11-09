import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { argon2id } from "hash-wasm";

/** Argon2id, paramètres recommandés par l'OWASP (Password Storage Cheat Sheet) : 46 Mio, 1 passe, 1 fil. */
export interface Argon2Cost {
  memorySize: number;
  iterations: number;
  parallelism: number;
}
export const ARGON2_COST: Argon2Cost = { memorySize: 47104, iterations: 1, parallelism: 1 };

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ARGON2_FORMAT = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([^$]+)\$([^$]+)$/;
/** Paramètres des comptes créés avant Argon2id : conservés pour les vérifier, puis les convertir. */
const LEGACY_SCRYPT = { N: 16384, r: 8, p: 1 } as const;

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/=+$/, "");

async function derive(password: string, salt: Uint8Array, cost: Argon2Cost, hashLength: number): Promise<Buffer> {
  return Buffer.from(await argon2id({ password, salt, ...cost, hashLength, outputType: "binary" }));
}

function legacyScrypt(password: string, salt: Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, length, LEGACY_SCRYPT, (err, key) => (err ? reject(err) : resolve(key))));
}

export interface PasswordCheck {
  ok: boolean;
  /** Empreinte à recalculer avec les paramètres actuels. */
  outdated: boolean;
}

/** Empreintes au format PHC standard : les paramètres sont stockés avec, et peuvent donc évoluer. */
export class PasswordHasher {
  constructor(private cost: Argon2Cost = ARGON2_COST) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const { memorySize: m, iterations: t, parallelism: p } = this.cost;
    return `$argon2id$v=19$m=${m},t=${t},p=${p}$${b64(salt)}$${b64(await derive(password, salt, this.cost, HASH_BYTES))}`;
  }

  async verify(password: string, stored: string): Promise<PasswordCheck> {
    const m = ARGON2_FORMAT.exec(stored);
    if (m) {
      const cost = { memorySize: Number(m[1]), iterations: Number(m[2]), parallelism: Number(m[3]) };
      const expected = Buffer.from(m[5]!, "base64");
      const actual = await derive(password, Buffer.from(m[4]!, "base64"), cost, expected.length);
      return { ok: timingSafeEqual(actual, expected), outdated: (Object.keys(cost) as Array<keyof Argon2Cost>).some((k) => cost[k] !== this.cost[k]) };
    }
    const [algo, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt" || !saltB64 || !hashB64) return { ok: false, outdated: false };
    const expected = Buffer.from(hashB64, "base64");
    return { ok: timingSafeEqual(await legacyScrypt(password, Buffer.from(saltB64, "base64"), expected.length), expected), outdated: true };
  }
}
