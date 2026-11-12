import type { AssetKind } from "./domain";
import type { EngineData, PortfolioState } from "./engine";
import { roundCents } from "./money";

/**
 * Concentration : la part du patrimoine financier qui dépend d'un seul titre, d'un seul émetteur d'obligations,
 * d'une seule plateforme de crowdlending ou d'un seul établissement. Montants pour la part détenue des comptes joints.
 * Les obligations d'État (OAT) sont montrées sans alerte : le risque n'est pas celui d'une entreprise.
 */

export interface ConcentrationItem {
  key: string;
  label: string;
  value: number;
  /** Part du patrimoine financier. */
  share: number;
  /** Au-delà du seuil d'alerte. */
  over: boolean;
  detail: string;
}

export interface ConcentrationReport {
  /** Patrimoine financier, part détenue des comptes joints. */
  base: number;
  threshold: number;
  /** Titres, tous comptes confondus, du plus gros au plus petit. */
  lines: Array<ConcentrationItem & { kind: AssetKind }>;
  top1: number;
  top5: number;
  issuers: Array<ConcentrationItem & { state: boolean }>;
  platforms: Array<ConcentrationItem & { troubled: number; troubledShare: number }>;
  /** Crowdlending : projets en retard ou en défaut, en valeur et en part du crowdlending. */
  crowdTroubled: { value: number; share: number } | null;
  institutions: ConcentrationItem[];
  /** Ce qui dépasse le seuil : titres, émetteurs privés, plateformes. */
  alerts: ConcentrationItem[];
}

const normalize = (s: string) => s.trim().toLocaleLowerCase("fr-FR").replace(/\s+/g, " ");

export function concentrationReport(data: Pick<EngineData, "institutions" | "params">, state: PortfolioState): ConcentrationReport {
  const threshold = data.params.alerts.concentrationMax;
  const base = state.netWorth.financial;
  const share = (v: number) => (base > 0 ? v / base : 0);
  const item = (key: string, label: string, value: number, detail: string, alertable = true): ConcentrationItem => {
    const s = share(value);
    return { key, label, value: roundCents(value), share: s, over: alertable && threshold > 0 && s > threshold, detail };
  };
  const active = state.accounts.filter((a) => !a.account.archived || a.value !== 0);
  const held = (a: (typeof active)[number]) => a.account.share ?? 1;

  // Titres, regroupés d'un compte à l'autre.
  const byAsset = new Map<string, { name: string; kind: AssetKind; value: number; accounts: Set<string>; issuer: string | null; state: boolean }>();
  for (const a of active) {
    for (const p of a.positions) {
      // Un fonds euros est garanti par l'assureur : son poids se lit dans la protection par établissement.
      if (p.asset.kind === "fonds_euros") continue;
      const e = byAsset.get(p.asset.id) ?? { name: p.asset.name, kind: p.asset.kind, value: 0, accounts: new Set<string>(), issuer: p.asset.issuer, state: p.asset.bondKind === "etat" };
      e.value += p.value * held(a);
      e.accounts.add(a.account.name);
      byAsset.set(p.asset.id, e);
    }
  }
  const lines = [...byAsset.entries()]
    .filter(([, e]) => e.value > 0)
    // Une obligation se juge par son émetteur : pas d'alerte en double sur la ligne.
    .map(([id, e]) => ({ ...item(`titre-${id}`, e.name, e.value, [...e.accounts].join(", "), e.kind !== "obligation"), kind: e.kind }))
    .sort((x, y) => y.value - x.value);
  const topShare = (n: number) => share(lines.slice(0, n).reduce((s, l) => s + l.value, 0));

  // Émetteurs d'obligations.
  const byIssuer = new Map<string, { label: string; value: number; state: boolean; count: number }>();
  for (const e of byAsset.values()) {
    if (e.kind !== "obligation" || e.value <= 0) continue;
    const label = e.issuer?.trim() || (e.state ? "État français" : e.name);
    const k = normalize(label);
    const g = byIssuer.get(k) ?? { label, value: 0, state: e.state, count: 0 };
    g.value += e.value;
    g.count += 1;
    byIssuer.set(k, g);
  }
  const issuers = [...byIssuer.entries()]
    .map(([k, g]) => ({ ...item(`emetteur-${k}`, g.label, g.value, `${g.count} obligation${g.count > 1 ? "s" : ""}${g.state ? " d'État" : ""}`, !g.state), state: g.state }))
    .sort((x, y) => y.value - x.value);

  // Plateformes de crowdlending, et projets en difficulté.
  const institutionName = new Map((data.institutions ?? []).map((i) => [i.id, i.name]));
  const byPlatform = new Map<string, { label: string; value: number; troubled: number }>();
  for (const a of active.filter((x) => x.account.kind === "crowdlending")) {
    const k = a.account.institutionId ?? a.account.id;
    const g = byPlatform.get(k) ?? { label: (a.account.institutionId && institutionName.get(a.account.institutionId)) || a.account.name, value: 0, troubled: 0 };
    g.value += a.value * held(a);
    g.troubled += a.crowdProjects.filter((c) => c.status === "retard" || c.status === "defaut").reduce((s, c) => s + c.value, 0) * held(a);
    byPlatform.set(k, g);
  }
  const platforms = [...byPlatform.entries()]
    .filter(([, g]) => g.value > 0)
    .map(([k, g]) => ({ ...item(`plateforme-${k}`, g.label, g.value, g.troubled > 0 ? "dont des projets en retard ou en défaut" : "aucun projet en difficulté"), troubled: roundCents(g.troubled), troubledShare: g.value > 0 ? g.troubled / g.value : 0 }))
    .sort((x, y) => y.value - x.value);
  const crowdTotal = platforms.reduce((s, p) => s + p.value, 0);
  const crowdTroubledValue = platforms.reduce((s, p) => s + p.troubled, 0);

  // Établissements : la part du patrimoine chez chacun (la protection en cas de faillite est dans sa propre carte).
  const byInstitution = new Map<string, { label: string; value: number }>();
  for (const a of active) {
    const k = a.account.institutionId ?? "";
    const g = byInstitution.get(k) ?? { label: k ? (institutionName.get(k) ?? "Établissement supprimé") : "Sans établissement", value: 0 };
    g.value += a.value * held(a);
    byInstitution.set(k, g);
  }
  const institutions = [...byInstitution.entries()]
    .filter(([, g]) => g.value > 0)
    .map(([k, g]) => item(`etablissement-${k}`, g.label, g.value, "", false))
    .sort((x, y) => y.value - x.value);

  return {
    base,
    threshold,
    lines,
    top1: topShare(1),
    top5: topShare(5),
    issuers,
    platforms,
    crowdTroubled: crowdTotal > 0 ? { value: roundCents(crowdTroubledValue), share: crowdTroubledValue / crowdTotal } : null,
    institutions,
    alerts: [...lines, ...issuers, ...platforms].filter((x) => x.over),
  };
}
