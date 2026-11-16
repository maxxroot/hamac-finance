import { useMemo } from "react";
import { countryName, type BondBreakdown, type IssuerShare } from "@hamac/core";
import { Flag } from "@/shared/components/Flag";
import { Pct } from "@/shared/components/Stat";
import { Chart, axisStyle, tooltipStyle, type ChartOption } from "@/shared/components/Chart";
import { Card, CardTitle } from "@/shared/components/ui";
import { useChartColors } from "@/shared/lib/colors";
import { flagHtml, flagUrl } from "@/shared/lib/flags";
import { KIND_LABELS, bondColors, firstParam, money, pct, tooltipRow, type TooltipParam } from "./_bits";

/** Au-delà, les plus petits émetteurs sont regroupés : une barre par émetteur reste lisible. */
const MAX_ISSUERS = 8;

/** Un État se reconnaît à son drapeau : on n'écrit que le pays. */
const issuerName = (r: Pick<IssuerShare, "issuer" | "country">) => (r.country ? countryName(r.country) : r.issuer);

/** Style ECharts d'un drapeau dans un texte riche (« {fBE|} Belgique »), un par pays affiché. */
function flagStyles(rows: readonly Pick<IssuerShare, "country">[]) {
  const styles: Record<string, { width: number; height: number; backgroundColor: { image: string } }> = {};
  for (const r of rows) {
    const url = r.country ? flagUrl(r.country) : null;
    if (url) styles[`f${r.country}`] = { width: 20, height: 15, backgroundColor: { image: url } };
  }
  return styles;
}

/** Répartition du nominal : part de l'État et des entreprises, premier émetteur, puis une barre par émetteur. */
export function IssuersChart({ breakdown }: { breakdown: BondBreakdown }) {
  const c = useChartColors();
  const rows = useMemo(() => {
    const top = breakdown.byIssuer.slice(0, MAX_ISSUERS);
    const rest = breakdown.byIssuer.slice(MAX_ISSUERS);
    if (!rest.length) return top;
    const nominal = rest.reduce((s, r) => s + r.nominal, 0);
    return [...top, { issuer: `${rest.length} autres`, kind: "entreprise" as const, country: null, nominal, share: rest.reduce((s, r) => s + r.share, 0) }];
  }, [breakdown]);
  const option = useMemo<ChartOption>(() => {
    const k = bondColors(c);
    const ordered = [...rows].reverse(); // ECharts dessine la première catégorie en bas.
    return {
      tooltip: {
        trigger: "item",
        ...tooltipStyle(c),
        formatter: (p: TooltipParam | TooltipParam[]) => {
          const r = ordered[firstParam(p).dataIndex];
          if (!r) return "";
          return tooltipRow(k.kind[r.kind], `${r.country ? flagHtml(r.country) : ""}${issuerName(r)}`, `${money(r.nominal)} · ${pct(r.share, 1)}`);
        },
      },
      legend: { show: false },
      grid: { left: 8, right: 48, top: 4, bottom: 4, containLabel: true },
      xAxis: { type: "value", ...axisStyle(c), axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: {
        type: "category",
        data: ordered.map(issuerName),
        ...axisStyle(c),
        axisLabel: {
          color: c.ink.muted,
          width: 140,
          overflow: "truncate",
          // Le drapeau devant le pays : un État se repère d'un coup d'œil.
          formatter: (value: string, i: number) => {
            const country = ordered[i]?.country;
            return country && flagUrl(country) ? `{f${country}|}  ${value}` : value;
          },
          rich: flagStyles(ordered),
        },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: ordered.map((r) => ({ value: r.nominal, itemStyle: { color: k.kind[r.kind], borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: "right", color: c.ink.muted, formatter: (p: { dataIndex: number }) => pct(ordered[p.dataIndex]!.share, 0) },
        },
      ],
    };
  }, [rows, c]);

  const first = breakdown.byIssuer[0];
  const k = bondColors(c);
  return (
    <Card>
      <CardTitle hint="En % du nominal détenu">Répartition par émetteur</CardTitle>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-fg-muted">
        {(["etat", "entreprise"] as const).map((kind) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ background: k.kind[kind] }} />
            {KIND_LABELS[kind]} : <b className="text-fg"><Pct value={breakdown.byKind[kind].share} digits={0} /></b>
          </span>
        ))}
        {first && (
          <span>
            Premier émetteur :{" "}
            <b className="inline-flex items-center gap-1.5 text-fg">
              {first.country && <Flag code={first.country} />}
              {issuerName(first)}
            </b>{" "}
            (<Pct value={first.share} digits={0} />)
          </span>
        )}
      </div>
      <Chart option={option} height={Math.max(120, rows.length * 30 + 16)} />
    </Card>
  );
}
