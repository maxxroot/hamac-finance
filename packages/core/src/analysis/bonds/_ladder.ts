import { roundCents, type IsoDate } from "../../base";
import type { Asset, BondKind, BondPlan } from "../../model";
import type { PositionState } from "../../portfolio";

/** Type d'une obligation : celui de sa fiche ; sans type, une OAT si l'émetteur est vide ou l'État (comme `bondName`). */
export function bondKindOf(asset: Pick<Asset, "bondKind" | "issuer">): BondKind {
  if (asset.bondKind) return asset.bondKind;
  return !asset.issuer || /r[ée]publique fran[cç]aise|france/i.test(asset.issuer) ? "etat" : "entreprise";
}

export interface LadderYear {
  year: number;
  /** Nominal détenu qui arrive à échéance cette année, par type. */
  etat: number;
  entreprise: number;
  /** Nominal des lignes prévues pour cette année. */
  planned: number;
}

/**
 * Échelle des échéances : nominal remboursé par année, de l'année en cours à la dernière échéance ou ligne prévue.
 * Les années sans rien restent dans la liste : ce sont les trous de l'échelle.
 */
export function maturityLadder(held: readonly PositionState[], plans: readonly BondPlan[], asOf: IsoDate): LadderYear[] {
  const bonds = held.filter((p) => p.bond && p.bond.terms.maturityDate > asOf);
  const years = [...bonds.map((p) => +p.bond!.terms.maturityDate.slice(0, 4)), ...plans.map((b) => b.targetYear)];
  if (!years.length) return [];
  const first = Math.min(+asOf.slice(0, 4), ...years);
  const last = Math.max(...years);
  const out: LadderYear[] = [];
  for (let y = first; y <= last; y++) out.push({ year: y, etat: 0, entreprise: 0, planned: 0 });
  for (const p of bonds) out[+p.bond!.terms.maturityDate.slice(0, 4) - first]![bondKindOf(p.asset)] += p.bond!.nominal;
  for (const b of plans) out[b.targetYear - first]!.planned += b.nominal;
  return out.map((r) => ({ ...r, etat: roundCents(r.etat), entreprise: roundCents(r.entreprise), planned: roundCents(r.planned) }));
}

export interface IssuerShare {
  issuer: string;
  kind: BondKind;
  nominal: number;
  /** Part du nominal détenu, entre 0 et 1. */
  share: number;
}

export interface BondBreakdown {
  nominal: number;
  byKind: Record<BondKind, { nominal: number; share: number }>;
  /** Émetteurs du plus gros au plus petit. */
  byIssuer: IssuerShare[];
}

/** Répartition du nominal détenu : État ou entreprises, puis par émetteur (toutes les OAT ensemble). */
export function bondBreakdown(held: readonly PositionState[]): BondBreakdown {
  const bonds = held.filter((p) => p.bond && p.bond.nominal > 0);
  const nominal = bonds.reduce((s, p) => s + p.bond!.nominal, 0);
  const share = (v: number) => (nominal > 0 ? v / nominal : 0);
  const kinds: Record<BondKind, number> = { etat: 0, entreprise: 0 };
  const issuers = new Map<string, { kind: BondKind; nominal: number }>();
  for (const p of bonds) {
    const kind = bondKindOf(p.asset);
    kinds[kind] += p.bond!.nominal;
    const issuer = kind === "etat" ? "État français" : p.asset.issuer?.trim() || p.asset.name;
    const row = issuers.get(issuer) ?? { kind, nominal: 0 };
    row.nominal += p.bond!.nominal;
    issuers.set(issuer, row);
  }
  return {
    nominal: roundCents(nominal),
    byKind: { etat: { nominal: roundCents(kinds.etat), share: share(kinds.etat) }, entreprise: { nominal: roundCents(kinds.entreprise), share: share(kinds.entreprise) } },
    byIssuer: [...issuers]
      .map(([issuer, r]) => ({ issuer, kind: r.kind, nominal: roundCents(r.nominal), share: share(r.nominal) }))
      .sort((a, b) => b.nominal - a.nominal || a.issuer.localeCompare(b.issuer)),
  };
}
