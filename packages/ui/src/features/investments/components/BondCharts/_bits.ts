import { formatEur, type BondKind } from "@hamac/core";
import type { ChartColors } from "@/shared/lib/colors";

export const money = (v: number) => formatEur(v, { compact: true });
export const pct = (r: number, digits = 2) => `${(r * 100).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

/**
 * Couleurs de la page, toujours avec le même sens d'un graphique à l'autre, prises dans la palette des classes
 * (vérifiée pour chaque thème) : État / entreprises, coupons / remboursements, valeur.
 */
export function bondColors(c: ChartColors) {
  return {
    kind: { etat: c.buckets.obligations, entreprise: c.buckets.croissance } satisfies Record<BondKind, string>,
    coupons: c.buckets.garanti,
    redemptions: c.buckets.precaution,
    value: c.buckets.obligations,
  };
}

export const KIND_LABELS: Record<BondKind, string> = { etat: "États", entreprise: "Entreprises" };

/** Ligne d'info-bulle : pastille de couleur, libellé, valeur alignée à droite. */
export function tooltipRow(color: string | null, label: string, value: string): string {
  const dot = color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:${color}"></span>` : "";
  return `<div style="display:flex;justify-content:space-between;gap:20px"><span>${dot}${label}</span><b>${value}</b></div>`;
}

export const tooltipTitle = (c: ChartColors, text: string) => `<div style="margin-bottom:4px;color:${c.ink.muted}">${text}</div>`;

/** Légende en haut à gauche, pastilles rondes : commune aux graphiques de la page. */
export const topLegend = (c: ChartColors, data: string[]) => ({ data, top: 0, left: 0, icon: "circle", itemWidth: 8, itemHeight: 8, textStyle: { color: c.ink.muted } });

/** Paramètre d'info-bulle d'ECharts : un objet pour un point, un tableau quand l'info-bulle suit l'axe. */
export interface TooltipParam {
  dataIndex: number;
  seriesIndex?: number;
}
export const firstParam = (p: TooltipParam | TooltipParam[]): TooltipParam => (Array.isArray(p) ? p[0]! : p);
