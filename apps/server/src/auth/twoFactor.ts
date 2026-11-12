import { createHash, randomBytes, randomInt } from "node:crypto";
import { base32, matchTotp, newTotpSecret, otpauthUri } from "./totp";
import type { TwoFactorKey, SecretBox } from "./twoFactorKey";
import { TWO_FACTOR_SETUP_MS, type UserStore } from "./users";

const ISSUER = "Hamac";
const RECOVERY_COUNT = 10;
/** Sans 0/O, 1/I/L : ces codes se recopient depuis une feuille de papier. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type CodeCheck = "ok" | "invalid" | "unavailable";

/** Majuscules, sans espaces ni tirets : « abcd-2345 » et « ABCD 2345 » désignent le même code. */
export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}

export function newRecoveryCode(): string {
  const pick = () => Array.from({ length: 4 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

/** Tout ce qui demande la clé : chiffrement du secret, vérification des codes, codes de secours. */
export class TwoFactor {
  constructor(
    private store: UserStore,
    private key: TwoFactorKey,
    private now: () => number = Date.now,
  ) {}

  get available(): boolean {
    return this.key.ok;
  }

  private get box(): SecretBox | null {
    return this.key.ok ? this.key.box : null;
  }

  private async status(userId: string): Promise<{ enabled: boolean; recoveryCodesLeft: number }> {
    const row = await this.store.twoFactorRow(userId);
    return { enabled: !!row?.confirmed, recoveryCodesLeft: row?.confirmed ? await this.store.recoveryCodesLeft(userId) : 0 };
  }

  /** Ce dont l'interface a besoin, sans aucun secret. */
  async publicStatus(userId: string): Promise<{ enabled: boolean; available: boolean; recoveryCodesLeft: number }> {
    return { ...(await this.status(userId)), available: this.available };
  }

  async isEnabled(userId: string): Promise<boolean> {
    return !!(await this.store.twoFactorRow(userId))?.confirmed;
  }

  /** Le code pourra-t-il être vérifié ? Faux si la clé est absente ou n'est pas celle qui a chiffré ce secret. */
  async canVerify(userId: string): Promise<boolean> {
    const row = await this.store.twoFactorRow(userId);
    return !!(row && this.box?.open(userId, row.secret));
  }

  /** Comptes protégés dont le secret est illisible avec la clé actuelle : à signaler au démarrage. */
  async unreadableSecrets(): Promise<number> {
    const rows = await this.store.confirmedTwoFactorSecrets();
    return rows.filter((r) => !this.box?.open(r.userId, r.secret)).length;
  }

  /** Démarre une activation : rien n'est actif tant qu'un code n'a pas été confirmé. */
  async begin(user: { id: string; email: string }): Promise<{ secret: string; uri: string } | "already" | "unavailable"> {
    const box = this.box;
    if (!box) return "unavailable";
    const secret = newTotpSecret();
    if (!(await this.store.savePendingTwoFactor(user.id, box.seal(user.id, secret)))) return "already";
    return { secret: base32(secret), uri: otpauthUri(secret, user.email, ISSUER) };
  }

  /** Vérifie le premier code et active ; renvoie les codes de secours, en clair pour cette seule fois. */
  async confirm(userId: string, code: string): Promise<{ recoveryCodes: string[] } | "invalid" | "expired" | "unavailable"> {
    const box = this.box;
    if (!box) return "unavailable";
    const row = await this.store.twoFactorRow(userId);
    if (!row || row.confirmed || this.now() - Date.parse(row.createdAt) > TWO_FACTOR_SETUP_MS) return "expired";
    const secret = box.open(userId, row.secret);
    if (!secret) return "expired";
    const step = matchTotp(secret, code, this.now(), row.lastStep);
    if (step === null) return "invalid";
    const recoveryCodes = this.newCodes();
    if (!(await this.store.confirmTwoFactor(userId, row.secret, step, this.hashes(box, userId, recoveryCodes)))) return "expired";
    return { recoveryCodes };
  }

  async verifyTotp(userId: string, code: string): Promise<CodeCheck> {
    const box = this.box;
    if (!box) return "unavailable";
    const row = await this.store.twoFactorRow(userId);
    if (!row?.confirmed) return "invalid";
    const secret = box.open(userId, row.secret);
    if (!secret) return "unavailable";
    const step = matchTotp(secret, code, this.now(), row.lastStep);
    return step !== null && (await this.store.acceptTotpStep(userId, step)) ? "ok" : "invalid";
  }

  async verifyRecovery(userId: string, code: string): Promise<CodeCheck> {
    const box = this.box;
    if (!box) return "unavailable";
    const normalized = normalizeRecoveryCode(code);
    if (normalized.length !== 8) return "invalid";
    return (await this.store.consumeRecoveryCode(userId, box.recoveryHash(userId, normalized))) ? "ok" : "invalid";
  }

  /** Six chiffres : le code de l'application ; sinon un code de secours. */
  verifyAny(userId: string, code: string): Promise<CodeCheck> {
    return /^\d{6}$/.test(code.trim()) ? this.verifyTotp(userId, code.trim()) : this.verifyRecovery(userId, code);
  }

  async regenerate(userId: string): Promise<string[] | null> {
    const box = this.box;
    if (!box) return null;
    const codes = this.newCodes();
    return (await this.store.replaceRecoveryCodes(userId, this.hashes(box, userId, codes))) ? codes : null;
  }

  private newCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_COUNT) codes.add(newRecoveryCode());
    return [...codes];
  }

  private hashes(box: SecretBox, userId: string, codes: string[]): string[] {
    return codes.map((c) => box.recoveryHash(userId, normalizeRecoveryCode(c)));
  }
}

export const CHALLENGE_TTL_MS = 5 * 60_000;
export const CHALLENGE_MAX_TRIES = 5;

interface Challenge {
  userId: string;
  /** Empreinte du mot de passe au moment du défi : le changer l'annule. */
  passwordHash: string;
  expiresAt: number;
  tries: number;
}

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

/**
 * Étape entre le mot de passe et le code : aucune session n'existe encore.
 * En mémoire seulement : un redémarrage demande simplement de ressaisir le mot de passe.
 */
export class ChallengeStore {
  private items = new Map<string, Challenge>();
  private byUser = new Map<string, string>();

  constructor(
    private now: () => number = Date.now,
    private max = 10_000,
  ) {}

  get size(): number {
    return this.items.size;
  }

  /** Un seul défi par compte : se reconnecter n'ajoute pas cinq essais de plus. */
  create(userId: string, passwordHash: string): string {
    const previous = this.byUser.get(userId);
    if (previous) this.delete(previous);
    if (this.items.size >= this.max) this.evict();
    const token = randomBytes(32).toString("base64url");
    const key = tokenHash(token);
    this.items.set(key, { userId, passwordHash, expiresAt: this.now() + CHALLENGE_TTL_MS, tries: 0 });
    this.byUser.set(userId, key);
    return token;
  }

  /**
   * Compte un essai et renvoie le défi s'il est encore valable. Le décompte précède toute attente :
   * des envois simultanés ne peuvent pas dépasser la limite, et le dernier essai retire aussitôt le défi.
   */
  attempt(token: string): (Challenge & { last: boolean }) | null {
    const key = tokenHash(token);
    const item = this.items.get(key);
    if (!item) return null;
    if (item.expiresAt <= this.now()) {
      this.delete(key);
      return null;
    }
    item.tries++;
    const last = item.tries >= CHALLENGE_MAX_TRIES;
    if (last) this.delete(key);
    return { ...item, last };
  }

  remove(token: string): void {
    this.delete(tokenHash(token));
  }

  private delete(key: string): void {
    const item = this.items.get(key);
    if (!item) return;
    this.items.delete(key);
    if (this.byUser.get(item.userId) === key) this.byUser.delete(item.userId);
  }

  /** Les expirés d'abord, puis les plus anciens (une Map conserve l'ordre d'insertion). */
  private evict(): void {
    const now = this.now();
    for (const [key, item] of this.items) if (item.expiresAt <= now) this.delete(key);
    while (this.items.size >= this.max) this.delete(this.items.keys().next().value!);
  }
}
