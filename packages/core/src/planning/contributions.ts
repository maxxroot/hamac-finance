import { allocationReport, classEnabled, LIVRET_LEGAL_CEILINGS, type AccountKind, type Bucket, type PlanParams } from "../model";
import { splitByTarget, type AccountState, type PortfolioState } from "../portfolio";
import { roundCents } from "../base";

/**
 * Gestion suggérée des versements : à partir de la capacité d'épargne mensuelle, propose un montant
 * par compte. Ordre de priorité :
 * 1. les allocations personnalisées « part des versements » (sans dépasser ce qui reste avant leur limite) ;
 * 2. le matelas de précaution s'il est sous le plancher (livrets les mieux rémunérés d'abord, sous leur plafond),
 *    sauf si une allocation personnalisée s'occupe déjà des livrets ;
 * 3. le reste selon l'allocation de base, vers les classes d'actifs en retard sur leur cible (sans vendre).
 */

export interface ProposalLine {
  accountId: string;
  /** Montant proposé par mois (euros entiers). */
  amount: number;
  /** Versement programmé ce mois-ci. */
  current: number;
  reasons: string[];
}

export interface ContributionProposal {
  capacity: number;
  lines: ProposalLine[];
  /** Montant qu'aucun compte ne peut recevoir. */
  unassigned: number;
  notes: string[];
}

/** Compte qui reçoit chaque classe d'actifs de l'allocation de base. */
const BUCKET_ACCOUNTS: Partial<Record<Bucket, AccountKind[]>> = { precaution: ["livret"], garanti: ["assurance_vie"], obligations: ["cto"], croissance: ["pea", "pea_pme"], matieres_premieres: ["cto"], crowdlending: ["crowdlending"], speculatif: ["crypto"] };

const pctLabel = (v: number) => `${(Math.round(v * 1000) / 10).toLocaleString("fr-FR")} %`;
const eurLabel = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;

function livretRoom(a: AccountState): number {
  const ceiling = a.account.depositCeiling ?? (a.account.livretType ? LIVRET_LEGAL_CEILINGS[a.account.livretType] : null);
  return ceiling == null ? Infinity : Math.max(0, ceiling - a.value);
}

export function proposeContributions(params: PlanParams, state: PortfolioState, capacity: number): ContributionProposal {
  const accounts = state.accounts.filter((a) => !a.account.archived);
  const amounts = new Map<string, number>();
  const reasons = new Map<string, string[]>();
  const notes: string[] = [];
  const add = (id: string, amount: number, reason: string) => {
    if (amount <= 0) return;
    amounts.set(id, (amounts.get(id) ?? 0) + amount);
    const r = reasons.get(id) ?? [];
    if (!r.includes(reason)) r.push(reason);
    reasons.set(id, r);
  };
  const livretRoomLeft = (a: AccountState) => livretRoom(a) - (amounts.get(a.account.id) ?? 0);

  /** Répartit un montant entre des comptes ; renvoie ce qui n'a pas pu être placé. */
  const place = (members: AccountState[], amount: number, reason: string): number => {
    if (amount <= 0) return 0;
    if (!members.length) return amount;
    if (members.every((m) => m.account.kind === "livret")) {
      // Livrets : le mieux rémunéré d'abord, dans la limite de son plafond de dépôt.
      let left = amount;
      for (const m of [...members].sort((a, b) => (b.account.rate ?? 0) - (a.account.rate ?? 0))) {
        const put = Math.min(left, livretRoomLeft(m));
        add(m.account.id, put, reason);
        left -= put;
        if (left <= 0.005) return 0;
      }
      return left;
    }
    // Autres comptes : au prorata des versements actuels, sinon de la valeur, sinon à parts égales.
    const weights = members.map((m) => m.currentMonthly);
    const byValue = members.map((m) => Math.max(0, m.value));
    const w = weights.some((x) => x > 0) ? weights : byValue.some((x) => x > 0) ? byValue : members.map(() => 1);
    const total = w.reduce((s, x) => s + x, 0);
    members.forEach((m, i) => add(m.account.id, (amount * w[i]) / total, reason));
    return 0;
  };

  let rest = capacity;

  // 1. Allocations personnalisées.
  const rules = params.customAllocations;
  const report = allocationReport(rules, accounts, state.totals.value, capacity);
  for (const row of report.rows) {
    if (row.advisedMonthly <= 0) continue;
    const amount = row.remaining != null ? Math.min(row.advisedMonthly, row.remaining) : row.advisedMonthly;
    const members = accounts.filter((a) => row.accountIds.includes(a.account.id));
    const received = row.contributionShare - (row.done ? 0 : row.rule.share);
    const label = received > 1e-6 ? `${pctLabel(row.contributionShare)} (dont ${pctLabel(received)} reçus de lignes à leur limite)` : pctLabel(row.contributionShare);
    const capped = amount < row.advisedMonthly ? `, limité à ${eurLabel(amount)} avant sa limite` : "";
    const left = place(members, amount, `Allocation « ${row.name} » : ${label}${capped}`);
    rest -= amount - left;
    if (!members.length) notes.push(`« ${row.name} » ne vise aucun compte ouvert : sa part suit l'allocation de base.`);
  }

  // 2. Matelas de précaution.
  const livrets = accounts.filter((a) => a.account.kind === "livret");
  const customLivrets = rules.some((r) => (r.target.kind === "type" ? r.target.accountKind === "livret" : livrets.some((l) => l.account.id === (r.target as { accountId: string }).accountId)));
  if (!customLivrets && rest > 0 && state.livrets.total < params.livrets.floor && livrets.length) {
    const gap = params.livrets.floor - state.livrets.total;
    const amount = Math.min(rest, gap);
    rest -= amount - place(livrets, amount, `Matelas de précaution sous le plancher (${eurLabel(params.livrets.floor)})`);
  }

  // 3. Allocation de base, vers les classes d'actifs en retard sur leur cible.
  if (rest > 0) {
    const enabled = (key: string) => classEnabled(params, key);
    const membersOf = (r: PortfolioState["allocation"]["rows"][number]) => {
      // Comptes qui détiennent déjà des titres de la classe (classe créée, SCPI, ETC), sinon comptes de ce type inclus dans l'allocation :
      // le choix du compte, sinon celui de la classe visée (ses espèces, des liquidités, peuvent en être exclues).
      const held = r.key === "immobilier" || r.key === "matieres_premieres";
      const holders = accounts.filter((a) => a.positions.some((p) => p.inAllocation && (p.classId === r.key || (held && p.bucket === r.key))));
      if (holders.length) return holders;
      return r.bucket ? accounts.filter((a) => BUCKET_ACCOUNTS[r.bucket!]?.includes(a.account.kind) && (a.account.inAllocation ?? enabled(r.bucket!))) : [];
    };
    const rows = state.allocation.rows.filter((r) => membersOf(r).length);
    const totalTarget = rows.reduce((s, r) => s + r.target, 0);
    if (rows.length && totalTarget > 0) {
      const split = splitByTarget(
        rest,
        rows.map((r) => ({ assetId: r.key, value: r.value, target: r.target / totalTarget })),
      );
      let placed = 0;
      for (const r of rows) {
        const amount = split.get(r.key) ?? 0;
        const name = r.bucket ? r.label.toLowerCase() : r.label;
        placed += amount - place(membersOf(r), amount, `Allocation de base : ${name} (cible ${pctLabel(r.target)}, actuel ${pctLabel(r.share)})`);
      }
      rest -= placed;
      const missing = state.allocation.rows.filter((r) => !rows.includes(r) && r.target > 0);
      if (missing.length) notes.push(`Aucun compte pour : ${missing.map((r) => r.label.toLowerCase()).join(", ")}. Leur part va aux autres classes.`);
    } else if (livrets.length) {
      rest -= rest - place(livrets, rest, "Aucun compte d'investissement : épargne de précaution");
      notes.push("Ouvrez une assurance-vie, un PEA ou un compte-titres pour suivre l'allocation de base.");
    }
  }

  // Arrondi à l'euro : on tronque, puis on rend les euros restants aux plus gros montants.
  const placedTotal = Math.round(capacity - Math.max(0, rest));
  const ids = [...amounts.keys()];
  const floors = new Map(ids.map((id) => [id, Math.floor(amounts.get(id)! + 1e-6)]));
  let leftover = placedTotal - [...floors.values()].reduce((s, x) => s + x, 0);
  for (const id of [...ids].sort((a, b) => (amounts.get(b)! % 1) - (amounts.get(a)! % 1))) {
    if (leftover <= 0) break;
    floors.set(id, floors.get(id)! + 1);
    leftover--;
  }

  const shown = accounts.filter((a) => a.account.kind !== "crypto" || floors.has(a.account.id) || a.currentMonthly > 0);
  const lines = shown
    .map((a) => ({ accountId: a.account.id, amount: floors.get(a.account.id) ?? 0, current: a.currentMonthly, reasons: reasons.get(a.account.id) ?? [] }))
    .filter((l) => l.amount > 0 || l.current > 0)
    .sort((a, b) => b.amount - a.amount || b.current - a.current);
  const unassigned = roundCents(Math.max(0, capacity - lines.reduce((s, l) => s + l.amount, 0)));
  if (unassigned >= 1) notes.push(`${eurLabel(unassigned)} par mois sans compte possible (plafonds atteints ou comptes manquants).`);
  return { capacity, lines, unassigned, notes };
}
