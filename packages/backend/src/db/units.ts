
/** Conversions entre la base et le domaine : centimes ↔ euros, identifiants, horodatage. */

export const toCents = (euros: number) => Math.round(euros * 100);

export const fromCents = (cents: number) => cents / 100;

export const fromCentsOrNull = (c: number | null) => (c == null ? null : c / 100);

export const newId = () => crypto.randomUUID();

export const nowIso = () => new Date().toISOString();
