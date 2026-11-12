import { closeSync, chmodSync, fsyncSync, mkdirSync, openSync, readFileSync, statSync, writeSync } from "node:fs";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { join } from "node:path";

/**
 * Clé de la double authentification et ce qu'elle protège : le secret de chaque compte, chiffré,
 * et l'empreinte des codes de secours. La base seule, volée ou mal sauvegardée, ne permet ni l'un ni l'autre.
 */
const KEY_BYTES = 32;
export const KEY_FILE = "2fa.key";

export type TwoFactorKey = { ok: true; box: SecretBox } | { ok: false; reason: string };

/** Accepte 32 octets en hexadécimal ou en base64 (`openssl rand -base64 32`). */
export function parseKey(raw: string): Buffer | null {
  const text = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(text)) return Buffer.from(text, "hex");
  if (!/^[A-Za-z0-9+/_-]{43}=?$/.test(text)) return null;
  const key = Buffer.from(text, "base64");
  return key.length === KEY_BYTES ? key : null;
}

const invalid = (where: string): TwoFactorKey => ({ ok: false, reason: `${where} ne contient pas une clé valide : 32 octets attendus, en base64 ou en hexadécimal.` });

function fromFile(path: string): TwoFactorKey {
  const key = parseKey(readFileSync(path, "utf8"));
  if (!key) return invalid(path);
  if ((statSync(path).mode & 0o077) !== 0) {
    try {
      chmodSync(path, 0o600);
    } catch {
      console.warn(`[hamac] ${path} est lisible par d'autres utilisateurs de la machine : limitez-le avec chmod 600.`);
    }
  }
  return { ok: true, box: new SecretBox(key) };
}

/** Écrit la clé d'un trait et force son passage sur le disque : la perdre bloquerait les comptes protégés. */
function writeNewKey(path: string): void {
  const fd = openSync(path, "wx", 0o600);
  try {
    writeSync(fd, `${randomBytes(KEY_BYTES).toString("base64")}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/**
 * HAMAC_2FA_KEY, sinon le fichier du dossier de données, créé au premier lancement.
 * Jamais d'exception : une clé inutilisable ne doit pas empêcher les comptes sans double authentification de se connecter.
 * Une variable invalide n'est pas remplacée par le fichier : les secrets déjà chiffrés deviendraient illisibles sans explication.
 */
export function loadTwoFactorKey(envValue: string | undefined, dataDir: string | null): TwoFactorKey {
  if (envValue?.trim()) {
    const key = parseKey(envValue);
    return key ? { ok: true, box: new SecretBox(key) } : invalid("HAMAC_2FA_KEY");
  }
  if (!dataDir) return { ok: false, reason: "aucune clé configurée (HAMAC_2FA_KEY) et aucun dossier de données." };
  const path = join(dataDir, KEY_FILE);
  try {
    try {
      return fromFile(path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    mkdirSync(dataDir, { recursive: true });
    try {
      writeNewKey(path);
      console.log(`[hamac] Clé de double authentification créée dans ${path}. Sauvegardez-la avec la base : sans elle, les codes ne peuvent plus être vérifiés.`);
    } catch (e) {
      // Autre processus lancé au même instant : sa clé est la bonne.
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    return fromFile(path);
  } catch (e) {
    return { ok: false, reason: `lecture ou création de ${path} impossible (${(e as NodeJS.ErrnoException).code ?? "erreur inconnue"}).` };
  }
}

const derive = (master: Buffer, label: string) => Buffer.from(hkdfSync("sha256", master, Buffer.alloc(0), label, KEY_BYTES));

export class SecretBox {
  private sealKey: Buffer;
  private recoveryKey: Buffer;

  /** Une sous-clé par usage : la clé maîtresse ne sert jamais directement. */
  constructor(master: Buffer) {
    this.sealKey = derive(master, "hamac/2fa/secret/v1");
    this.recoveryKey = derive(master, "hamac/2fa/recovery/v1");
  }

  /** AES-256-GCM, lié au compte : un secret recopié sur un autre compte ne se déchiffre pas. */
  seal(userId: string, plain: Uint8Array): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.sealKey, iv).setAAD(Buffer.from(userId));
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    return ["v1", iv.toString("base64url"), data.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
  }

  /** Renvoie null si la clé n'est pas la bonne, si le compte diffère ou si la valeur a été modifiée. */
  open(userId: string, sealed: string): Buffer | null {
    const [version, iv, data, tag] = sealed.split(".");
    if (version !== "v1" || !iv || !data || !tag) return null;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.sealKey, Buffer.from(iv, "base64url")).setAAD(Buffer.from(userId)).setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
    } catch {
      return null;
    }
  }

  /**
   * Empreinte d'un code de secours, avec clé : un code n'a que 40 bits environ, un simple hachage se casserait
   * en quelques instants à partir d'une copie de la base. Déterministe pour que la base le retrouve et le consomme d'un seul coup.
   */
  recoveryHash(userId: string, code: string): string {
    return createHmac("sha256", this.recoveryKey).update(`${userId}:${code}`).digest("base64url");
  }
}
