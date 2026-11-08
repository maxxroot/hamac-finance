import { ASSET_BUCKET, BUCKET_LABELS, CASH_BUCKET, type Account, type Asset, type Bucket } from "./domain";
import type { CrowdProject } from "./crowdlending";
import type { PlanParams } from "./params";
import type { Property } from "./realestate";

/** Vue de « Ma répartition cible » : seules apparaissent les classes qui concernent l'utilisateur. */

export interface TargetRow {
  key: string;
  custom: boolean;
  label: string;
  color: string | null;
  inAllocation: boolean;
  target: number;
  expectedReturn: number | null;
  /** Hypothèse de base associée à la classe ; null = rendement propre, facultatif. */
  returnField: "livrets" | "fondsEuros" | "obligations" | "actions" | null;
  /** Éléments inclus un par un alors que la classe est hors allocation. */
  included: number;
  /** La ligne compte dans le total. */
  active: boolean;
}

const RETURN_FIELDS: Partial<Record<Bucket, TargetRow["returnField"]>> = { precaution: "livrets", garanti: "fondsEuros", obligations: "obligations", croissance: "actions" };

export interface TargetData {
  accounts: readonly Account[];
  assets: readonly Asset[];
  crowdProjects?: readonly CrowdProject[];
  properties?: readonly Property[];
}

export function targetRows(p: PlanParams, data: TargetData): TargetRow[] {
  const held = new Set<string>();
  const included = new Map<string, number>();
  const seen = (key: string, choice: boolean | null) => {
    held.add(key);
    if (choice === true) included.set(key, (included.get(key) ?? 0) + 1);
  };
  const customIds = new Set(p.customClasses.map((c) => c.id));
  for (const a of data.accounts.filter((x) => !x.archived)) seen(CASH_BUCKET[a.kind], a.inAllocation);
  for (const a of data.assets.filter((x) => !x.archived)) seen(a.classId && customIds.has(a.classId) ? a.classId : ASSET_BUCKET[a.kind], a.inAllocation);
  for (const c of data.crowdProjects ?? []) seen("crowdlending", c.inAllocation);
  for (const x of (data.properties ?? []).filter((y) => !y.archived)) seen(x.classId && customIds.has(x.classId) ? x.classId : "immobilier", x.inAllocation);
  const rows: TargetRow[] = [];
  for (const line of p.targets) {
    const cls = p.customClasses.find((c) => c.id === line.key);
    if (!cls && !(line.key in BUCKET_LABELS)) continue;
    // Une ligne cochée reste affichée même à 0 % : sinon, vider le champ pour retaper une valeur la ferait disparaître.
    if (!cls && !held.has(line.key) && !line.inAllocation) continue;
    const count = line.inAllocation ? 0 : (included.get(line.key) ?? 0);
    rows.push({ key: line.key, custom: !!cls, label: cls?.label ?? BUCKET_LABELS[line.key as Bucket], color: cls?.color ?? null, inAllocation: line.inAllocation, target: line.target, expectedReturn: line.expectedReturn, returnField: cls ? null : (RETURN_FIELDS[line.key as Bucket] ?? null), included: count, active: line.inAllocation || count > 0 });
  }
  return rows;
}

export const targetsTotal = (rows: readonly TargetRow[]) => rows.filter((r) => r.active).reduce((s, r) => s + r.target, 0);
