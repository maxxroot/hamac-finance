import { parseDate } from "./csv";
import type { CrowdProject } from "./crowdlending";
import type { Transaction, TxType } from "./domain";
import { roundCents } from "./money";

/**
 * Import du fichier de transactions Bricks (en attendant une API). Le fichier fait foi : on en déduit
 * l'état attendu, puis on le compare à Hamac. Réimporter le même fichier ne change donc rien.
 * Une ligne de chaque opération garde l'identifiant Bricks ; les intérêts sont regroupés par mois.
 */

const COLUMNS = { id: "id", date: "date", type: "type", status: "statut", project: "propriété", contract: "type de contrat", amount: "montant (€)" } as const;

/** Un onglet de classeur, tel que lu par l'interface. */
export interface XlsxSheet {
  name: string;
  rows: Array<Array<string | number | null>>;
}

export interface BricksRow {
  id: string;
  date: string;
  type: string;
  status: string;
  project: string | null;
  contract: string | null;
  amount: number;
}

export function parseBricksSheet(sheets: readonly XlsxSheet[]): BricksRow[] {
  const sheet = sheets.find((s) => s.rows[0]?.includes(COLUMNS.id) && s.rows[0]?.includes(COLUMNS.amount));
  if (!sheet) throw new Error("Ce fichier ne ressemble pas à un export de transactions Bricks.");
  const head = sheet.rows[0]!;
  const col = (name: string) => head.indexOf(name);
  for (const c of Object.values(COLUMNS)) if (col(c) < 0) throw new Error(`Colonne « ${c} » absente du fichier Bricks.`);
  const out: BricksRow[] = [];
  for (const r of sheet.rows.slice(1)) {
    const id = r[col(COLUMNS.id)];
    if (id == null || id === "") continue;
    const date = parseDate(String(r[col(COLUMNS.date)] ?? ""));
    const amount = Number(r[col(COLUMNS.amount)]);
    if (!date || !Number.isFinite(amount)) throw new Error(`Ligne illisible dans le fichier Bricks (opération ${String(id).slice(0, 8)}).`);
    out.push({ id: String(id), date, type: String(r[col(COLUMNS.type)] ?? "").trim(), status: String(r[col(COLUMNS.status)] ?? "").trim(), project: (r[col(COLUMNS.project)] as string | null) ?? null, contract: (r[col(COLUMNS.contract)] as string | null) ?? null, amount });
  }
  return out;
}

export type PlanAction = "nouveau" | "modifie" | "retire" | "conflit";

export interface PlannedTx {
  action: PlanAction;
  /** Opération de Hamac concernée (mise à jour, retrait). */
  id: string | null;
  externalId: string;
  date: string;
  type: TxType;
  amount: number;
  comment: string;
  note: string | null;
}

export interface PlannedProject {
  action: "nouveau" | "modifie";
  id: string | null;
  externalId: string;
  name: string;
  amount: number;
  startDate: string;
  repaidCapital: number;
  status: CrowdProject["status"];
  statusDate: string | null;
  comment: string;
  changes: string[];
}

export interface BricksPlan {
  transactions: PlannedTx[];
  projects: PlannedProject[];
  /** Éléments déjà à jour. */
  unchanged: number;
  /** Lignes annulées ou refusées, ignorées. */
  skipped: number;
  unknownTypes: string[];
  /** Part des revenus prélevée à la source d'après le fichier ; null s'il n'y en a pas. */
  withheldRate: number | null;
}

interface Wanted {
  externalId: string;
  date: string;
  type: TxType;
  amount: number;
  comment: string;
}

const CONTRACT_LABELS: Record<string, string> = { loan: "Prêt", obligation: "Obligation" };

export function planBricksImport(rows: readonly BricksRow[], accountId: string, existing: readonly Transaction[], projects: readonly CrowdProject[]): BricksPlan {
  const valid = rows.filter((r) => r.status === "Validée");
  const wanted: Wanted[] = [];
  const months = new Map<string, { net: number; date: string }>();
  const unknown = new Set<string>();
  const purchases = new Map<string, { amount: number; start: string; contract: string | null }>();
  const repayments = new Map<string, { amount: number; last: string }>();
  let revenue = 0;
  let withheld = 0;
  for (const r of valid) {
    switch (r.type) {
      case "Crédit par carte":
        wanted.push({ externalId: `bricks:${r.id}`, date: r.date, type: "versement", amount: Math.abs(r.amount), comment: "Crédit par carte (Bricks)" });
        break;
      case "Prime de parrainage en tant que parrain":
      case "Solde boosté":
        wanted.push({ externalId: `bricks:${r.id}`, date: r.date, type: "correction", amount: r.amount, comment: `${r.type} (Bricks)` });
        break;
      case "Revenus reversés":
      case "Prélèvement à la source": {
        const key = r.date.slice(0, 7);
        const m = months.get(key) ?? { net: 0, date: r.date };
        m.net += r.amount;
        if (r.date > m.date) m.date = r.date;
        months.set(key, m);
        if (r.type === "Revenus reversés") revenue += r.amount;
        else withheld += -r.amount;
        break;
      }
      case "Achat de bricks": {
        if (!r.project) break;
        const p = purchases.get(r.project) ?? { amount: 0, start: r.date, contract: r.contract };
        p.amount += Math.abs(r.amount);
        if (r.date < p.start) p.start = r.date;
        purchases.set(r.project, p);
        break;
      }
      case "Remboursement de capital": {
        if (!r.project) break;
        const p = repayments.get(r.project) ?? { amount: 0, last: r.date };
        p.amount += Math.abs(r.amount);
        if (r.date > p.last) p.last = r.date;
        repayments.set(r.project, p);
        break;
      }
      default:
        unknown.add(r.type);
    }
  }
  for (const [key, m] of months) {
    const net = roundCents(m.net);
    if (net > 0) wanted.push({ externalId: `bricks:interets:${key}`, date: m.date, type: "interets", amount: net, comment: `Intérêts de ${key} (Bricks)` });
  }

  const own = existing.filter((t) => t.accountId === accountId);
  const byExternal = new Map(own.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  const manual = own.filter((t) => !t.externalId);
  const plan: PlannedTx[] = [];
  let unchanged = 0;
  for (const w of wanted) {
    const cur = byExternal.get(w.externalId);
    if (cur) {
      if (cur.date === w.date && cur.type === w.type && Math.abs(cur.amount - w.amount) < 0.005) unchanged++;
      else plan.push({ ...w, action: "modifie", id: cur.id, note: `Était ${cur.amount.toLocaleString("fr-FR")} €` });
      continue;
    }
    if (w.type === "interets") {
      // Des intérêts déjà déclarés à la main sur ce mois feraient double emploi.
      const month = manual.filter((t) => t.type === "interets" && t.date.slice(0, 7) === w.date.slice(0, 7));
      if (month.length) {
        plan.push({ ...w, action: "conflit", id: null, note: `Déjà ${month.reduce((s, t) => s + t.amount, 0).toLocaleString("fr-FR")} € déclarés à la main ce mois-là` });
        continue;
      }
    } else {
      const i = manual.findIndex((t) => t.type === w.type && t.date === w.date && Math.abs(t.amount - w.amount) < 0.005);
      if (i >= 0) {
        manual.splice(i, 1);
        unchanged++;
        continue;
      }
    }
    plan.push({ ...w, action: "nouveau", id: null, note: null });
  }
  // Opération importée qui a disparu du fichier ou n'y est plus validée.
  const seen = new Set(wanted.map((w) => w.externalId));
  for (const t of own) if (t.externalId?.startsWith("bricks:") && !seen.has(t.externalId)) plan.push({ action: "retire", id: t.id, externalId: t.externalId, date: t.date, type: t.type, amount: t.amount, comment: t.comment, note: "N'est plus validée dans le fichier" });

  const plannedProjects: PlannedProject[] = [];
  const mine = projects.filter((p) => p.accountId === accountId);
  for (const [name, p] of purchases) {
    const externalId = `bricks:${name}`;
    const amount = roundCents(p.amount);
    const rep = repayments.get(name);
    const repaidCapital = roundCents(Math.min(amount, rep?.amount ?? 0));
    const finished = amount > 0 && repaidCapital >= amount - 0.005;
    const cur = mine.find((c) => c.externalId === externalId) ?? mine.find((c) => !c.externalId && c.name === name);
    // Un statut posé à la main (retard, défaut) n'est remplacé que par un remboursement complet.
    const status = finished ? "rembourse" : (cur?.status ?? "en_cours");
    const statusDate = finished ? rep!.last : (cur?.statusDate ?? null);
    const comment = cur?.comment || (p.contract ? (CONTRACT_LABELS[p.contract] ?? p.contract) : "");
    if (!cur) {
      plannedProjects.push({ action: "nouveau", id: null, externalId, name, amount, startDate: p.start, repaidCapital, status, statusDate, comment, changes: [] });
      continue;
    }
    const changes: string[] = [];
    if (Math.abs(cur.amount - amount) >= 0.005) changes.push(`investi ${amount.toLocaleString("fr-FR")} €`);
    if (Math.abs((cur.repaidCapital ?? 0) - repaidCapital) >= 0.005) changes.push(`remboursé ${repaidCapital.toLocaleString("fr-FR")} €`);
    if (cur.startDate !== p.start) changes.push("date d'investissement");
    if (cur.status !== status) changes.push(status === "rembourse" ? "remboursé en totalité" : status);
    if (changes.length) plannedProjects.push({ action: "modifie", id: cur.id, externalId, name, amount, startDate: p.start, repaidCapital, status, statusDate, comment, changes });
    else unchanged++;
  }
  return { transactions: plan, projects: plannedProjects, unchanged, skipped: rows.length - valid.length, unknownTypes: [...unknown], withheldRate: revenue > 0 && withheld > 0 ? withheld / revenue : null };
}
