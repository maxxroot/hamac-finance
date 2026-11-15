import { BUCKET_LABELS, BUCKETS, cashBucketOf, type AccountState, type AssetKind, type Bucket } from "@hamac/core";
import { BUCKET_COLORS } from "@/shared/lib/colors";
import { BUCKET_PAGES } from "@/shared/nav";

/** Classe d'une ligne sur la page d'un compte : celle de la répartition, sauf les actions au sens large, séparées par type. */
export interface HoldingClass {
  key: string;
  label: string;
  color: string;
  /** Page qui détaille cette classe, tous comptes confondus. */
  page: string | null;
}

/**
 * Dans la répartition du patrimoine, ETF, actions et fonds forment une seule classe « Actions ».
 * Dans un compte, on les distingue : un ETF est un ETF, une action est une action.
 */
const SPLIT: Partial<Record<AssetKind, HoldingClass>> = {
  etf: { key: "etf", label: "ETF", color: "var(--color-etf)", page: "/actions" },
  action: { key: "action", label: "Actions", color: BUCKET_COLORS.croissance, page: "/actions" },
  fonds: { key: "fonds", label: "Fonds", color: "var(--color-fonds)", page: "/actions" },
};

const ofBucket = (b: Bucket): HoldingClass => ({ key: b, label: BUCKET_LABELS[b], color: BUCKET_COLORS[b], page: BUCKET_PAGES[b] });

export function holdingClassOf(bucket: Bucket, kind: AssetKind | null): HoldingClass {
  return (bucket === "croissance" && kind && SPLIT[kind]) || ofBucket(bucket);
}

/** Ordre d'affichage : celui des classes du patrimoine, ETF, actions et fonds à la place des actions. */
const ORDER = BUCKETS.flatMap((b) => (b === "croissance" ? ["etf", "action", "fonds", b] : [b]));

/** Répartition d'un compte par classe : titres, projets de crowdlending et espèces. Seules les parts positives comptent. */
export function accountClasses(s: AccountState): Array<HoldingClass & { value: number }> {
  const sums = new Map<string, HoldingClass & { value: number }>();
  const add = (c: HoldingClass, v: number) => {
    const row = sums.get(c.key) ?? { ...c, value: 0 };
    row.value += v;
    sums.set(c.key, row);
  };
  for (const p of s.positions) add(holdingClassOf(p.bucket, p.asset.kind), p.value);
  const crowd = s.crowdProjects.reduce((t, c) => t + c.value, 0);
  if (crowd) add(ofBucket("crowdlending"), crowd);
  if (s.cash) add(ofBucket(cashBucketOf(s.account)), s.cash);
  return [...sums.values()].filter((r) => r.value > 0.005).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}
