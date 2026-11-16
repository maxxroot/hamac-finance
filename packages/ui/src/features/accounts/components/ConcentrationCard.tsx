import { useMemo, useState } from "react";
import { ASSET_KIND_LABELS, concentrationReport, countryName, type ConcentrationItem } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Flag } from "@/shared/components/Flag";
import { Pct } from "@/shared/components/Stat";
import { Badge, Card, CardTitle } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { usePortfolio } from "@/shared/lib/portfolio";

const TOP = 8;

/** Ce qui pèse le plus dans le patrimoine financier : titres, émetteurs, plateformes, établissements. */
export function ConcentrationCard() {
  const pf = usePortfolio();
  const r = useMemo(() => (pf ? concentrationReport(pf.data, pf.state) : null), [pf]);
  const [allLines, setAllLines] = useState(false);
  if (!pf || !r || r.base <= 0) return null;
  const lines = allLines ? r.lines : r.lines.slice(0, TOP);

  return (
    <Card className="mb-6">
      <CardTitle hint={r.threshold > 0 ? `alerte au-delà de ${Math.round(r.threshold * 100)} % · réglable dans Paramètres › Plan` : "alertes désactivées"}>Concentration</CardTitle>
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm @2xl:grid-cols-4">
        <Figure label="Première ligne" value={<Pct value={r.top1} />} />
        <Figure label="Cinq premières lignes" value={<Pct value={r.top5} />} />
        <Figure label="Patrimoine financier" value={<Amount value={r.base} compact />} />
        <Figure label="Au-delà du seuil" value={r.alerts.length ? <span className="text-negative">{r.alerts.length}</span> : "aucun"} />
      </dl>
      <div className="grid gap-6 @3xl:grid-cols-2">
        {r.lines.length > 0 && (
          <Block title="Titres, tous comptes confondus">
            <Bars items={lines} hint={(l) => `${ASSET_KIND_LABELS[(l as (typeof r.lines)[number]).kind]} · ${l.detail}`} />
            {r.lines.length > TOP && (
              <button type="button" className="mt-2 text-xs underline hover:text-accent" onClick={() => setAllLines(!allLines)}>
                {allLines ? "Afficher moins" : `Afficher les ${r.lines.length} titres`}
              </button>
            )}
          </Block>
        )}
        <Block title="Établissements">
          <Bars items={r.institutions} />
        </Block>
        {r.issuers.length > 0 && (
          <Block title="Émetteurs d'obligations">
            <Bars items={r.issuers} hint={(i) => (i as (typeof r.issuers)[number]).state ? `${i.detail} · sans alerte` : i.detail} country={(i) => (i as (typeof r.issuers)[number]).country} />
          </Block>
        )}
        {r.platforms.length > 0 && (
          <Block title="Plateformes de crowdlending">
            <Bars items={r.platforms} hint={(p) => {
              const x = p as (typeof r.platforms)[number];
              return x.troubled > 0 ? `${Math.round(x.troubledShare * 100)} % en retard ou en défaut` : "aucun projet en difficulté";
            }} />
            {r.crowdTroubled && r.crowdTroubled.value > 0 && (
              <p className="mt-2 text-xs text-fg-muted">
                En tout, <Amount value={r.crowdTroubled.value} compact /> de projets en retard ou en défaut, soit <Pct value={r.crowdTroubled.share} /> du crowdlending.
              </p>
            )}
          </Block>
        )}
      </div>
      <p className="mt-4 text-xs text-fg-faint">Parts du patrimoine financier, pour votre part des comptes joints. Les obligations se jugent par émetteur ; celles d'un État (OAT, OLO…) ne déclenchent pas d'alerte.</p>
    </Card>
  );
}

function Figure({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div>
      <dt className="text-fg-faint">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Block({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section>
      <div className="mb-2 text-xs font-medium text-fg-muted">{title}</div>
      {children}
    </section>
  );
}

function Bars({ items, hint, country }: Readonly<{ items: readonly ConcentrationItem[]; hint?: (i: ConcentrationItem) => string; country?: (i: ConcentrationItem) => string | null }>) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate" title={i.label}>
              {country?.(i) ? <IssuerCountry code={country(i)!} /> : i.label}
              {i.over && (
                <span className="ml-2">
                  <Badge tone="negative">au-delà du seuil</Badge>
                </span>
              )}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <Pct value={i.share} /> <span className="text-xs text-fg-faint">· <Amount value={i.value} compact /></span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-3" role="img" aria-label={`${Math.round(i.share * 100)} % du patrimoine financier`}>
            <div className={cn("h-full rounded-full", i.over ? "bg-negative" : "bg-accent")} style={{ width: `${Math.min(100, Math.round(i.share * 100))}%` }} />
          </div>
          {hint && <div className="mt-0.5 truncate text-xs text-fg-faint">{hint(i)}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Un État émetteur : son drapeau, puis le pays. */
function IssuerCountry({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <Flag code={code} label="État émetteur" />
      {countryName(code)}
    </span>
  );
}
