import type { AccountKind, AssetKind, PositionState } from "@hamac/core";

/** Lignes de cette page : actions, ETF et fonds, et les ETC (matières premières) détenus dans les mêmes comptes. */
export const listed = (p: PositionState): boolean => p.bucket === "croissance" || p.bucket === "matieres_premieres";

/** Titres qu'on achète depuis cette page, et comptes qui peuvent les détenir. */
export const LISTED_ASSET_KINDS: AssetKind[] = ["etf", "etc", "action", "fonds"];
export const LISTED_ACCOUNT_KINDS: AccountKind[] = ["pea", "pea_pme", "cto", "assurance_vie", "per", "epargne_salariale"];
