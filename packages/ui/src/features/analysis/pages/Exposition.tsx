import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { EtfExposure } from "@hamac/api";
import { portfolioExposure, type ExposureItem } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Pct } from "@/shared/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { EquivalentDialog } from "@/features/analysis/dialogs/EquivalentDialog";
import { cn } from "@/shared/lib/cn";
import { canImportFile, CompositionImportButton, compositionStatus, countryLabel, currencyLabel, EXPOSURE_KEY, hasPending, kindLabel, sectorLabel, summariesByAsset, withOthers } from "@/features/entry";
import { usePortfolio } from "@/shared/lib/portfolio";
import { call } from "@/shared/lib/transport";

/** Les compositions attendues arrivent en tâche de fond : la page se recharge, au plus deux minutes. */
const POLL_MS = 4_000;
const POLL_MAX = 30;

/** Ce que contiennent vraiment les actions et ETF : pays, secteurs, devises et plus grosses lignes. */
export function Exposition() {
  const pf = usePortfolio();
  // Un ETF ajouté, retiré ou dont l'ISIN change relance la lecture.
  const etfKey = useMemo(() => (pf ? pf.idx.ws.assets.filter((a) => a.kind === "etf" && !a.archived).map((a) => `${a.id}:${a.isin ?? ""}`).join(",") : ""), [pf]);
  const q = useQuery({
    queryKey: [EXPOSURE_KEY, etfKey],
    queryFn: () => call("exposure.load"),
    enabled: !!pf,
    refetchInterval: (query) => (hasPending(query.state.data) && query.state.dataUpdateCount < POLL_MAX ? POLL_MS : false),
  });
  const summaries = useMemo(() => summariesByAsset(q.data), [q.data]);
  const r = useMemo(() => (pf ? portfolioExposure(pf.state, summaries) : null), [pf, summaries]);
  const [choosing, setChoosing] = useState<EtfExposure | null>(null);
  // Seul l'administrateur peut déposer un fichier de composition : il sert à toute l'instance.
  const admin = useQuery({ queryKey: [EXPOSURE_KEY, "admin"], queryFn: () => call("exposure.admin") });
  const canImport = !!admin.data?.canEdit;
  if (!pf || !r) return null;

  const etfs = new Map((q.data?.etfs ?? []).map((e) => [e.assetId, e]));
  const held = r.assets.filter((a) => a.kind === "etf");
  const missing = held.filter((a) => !a.covered).length;

  return (
    <>
      <PageHeader title="Exposition réelle" description="Ce que contiennent vraiment vos actions et ETF : pays, secteurs, devises et plus grosses lignes, d'après la composition publiée par l'émetteur." />
      {r.total <= 0 ? (
        <Card>
          <p className="text-sm text-fg-muted">Aucune action ni aucun ETF détenu pour l'instant.</p>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm @2xl:grid-cols-4">
              <Figure label="Actions et ETF" value={<Amount value={r.total} compact />} />
              <Figure label="Composition connue" value={<Pct value={r.total > 0 ? r.covered / r.total : 0} digits={0} />} />
              <Figure label="Montant analysé" value={<Amount value={r.covered} compact />} />
              <Figure label="ETF sans composition" value={missing ? <span className="text-warning">{missing}</span> : "aucun"} />
            </dl>
            {q.isError && <p className="mt-3 text-xs text-warning">Compositions indisponibles : {(q.error as Error).message}</p>}
          </Card>

          {r.covered > 0 && (
            <div className="mb-6 grid gap-5 @3xl:grid-cols-2">
              <Card>
                <CardTitle>Pays</CardTitle>
                <Bars items={withOthers(r.countries, 10)} label={(k) => (k === "__autres" ? "Autres pays" : countryLabel(k))} />
              </Card>
              <Card>
                <CardTitle>Secteurs</CardTitle>
                <Bars items={r.sectors} label={sectorLabel} />
              </Card>
              <Card>
                <CardTitle hint="devise de cotation des titres">Devises</CardTitle>
                <Bars items={withOthers(r.currencies, 8)} label={(k) => (k === "__autres" ? "Autres devises" : currencyLabel(k))} />
              </Card>
              <Card>
                <CardTitle>Types de ligne</CardTitle>
                <Bars items={r.kinds} label={kindLabel} />
              </Card>
            </div>
          )}

          {r.top.length > 0 && (
            <>
              <h2 className="mb-2 text-sm font-medium text-fg-muted">Plus grosses lignes, tous titres confondus</h2>
              <Table className="mb-6">
                <thead>
                  <tr>
                    <Th>Ligne</Th>
                    <Th align="right">Part</Th>
                    <Th align="right">Montant</Th>
                    <Th>Détenue par</Th>
                  </tr>
                </thead>
                <tbody>
                  {r.top.map((l) => (
                    <Tr key={l.key}>
                      <Td>{l.name}</Td>
                      <Td align="right">
                        <Pct value={l.share} />
                      </Td>
                      <Td align="right">
                        <Amount value={l.value} compact />
                      </Td>
                      <Td className="text-xs text-fg-muted">{l.via.join(", ")}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}

          <h2 className="mb-2 text-sm font-medium text-fg-muted">Vos ETF</h2>
          <Table className="mb-4">
            <thead>
              <tr>
                <Th>ETF</Th>
                <Th align="right">Montant</Th>
                <Th>Composition</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {held.length === 0 && <EmptyRow cols={4}>Aucun ETF détenu.</EmptyRow>}
              {held.map((a) => {
                const e = etfs.get(a.assetId);
                const status = e ? compositionStatus(e) : null;
                return (
                  <Tr key={a.assetId}>
                    <Td>{a.name}</Td>
                    <Td align="right">
                      <Amount value={a.value} compact />
                    </Td>
                    <Td className={cn("text-xs", !status ? "text-warning" : status.tone === "warning" ? "text-warning" : status.tone === "muted" ? "text-fg-faint" : "text-fg-muted")}>
                      {status ? status.text : q.isLoading ? "…" : "Sans ISIN : ajoutez-le dans la fiche du titre pour récupérer sa composition."}
                    </Td>
                    <Td align="right" className="whitespace-nowrap">
                      {e && status?.canChoose && (
                        <Button variant="ghost" className="h-7 text-accent" onClick={() => setChoosing(e)}>
                          {e.used ? "Changer" : "Choisir un équivalent"}
                        </Button>
                      )}
                      {e && canImport && canImportFile(e.own) && <CompositionImportButton isin={e.isin} name={a.name} />}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="text-xs text-fg-faint">
            Pour votre part des comptes joints. Compositions publiées par Amundi et iShares, mises à jour chaque trimestre. Un ETF synthétique publie le panier qu'il détient, pas l'exposition qu'il
            donne : sa composition est reprise d'un ETF physique qui suit le même indice, comme celle d'un ETF dont l'émetteur n'est pas géré ou ne répond pas. Quand iShares refuse le serveur,
            l'administrateur peut aussi déposer le fichier de composition téléchargé depuis son navigateur. Une action détenue en direct compte pour le pays de son ISIN, c'est-à-dire où elle est enregistrée. Les lignes
            des ETF iShares n'ont pas d'ISIN : elles ne se regroupent avec celles d'un autre émetteur que par le nom.
          </p>
        </>
      )}
      <EquivalentDialog etf={choosing} onClose={() => setChoosing(null)} />
    </>
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

function Bars({ items, label }: Readonly<{ items: readonly ExposureItem[]; label: (key: string) => string }>) {
  if (!items.length) return <p className="text-sm text-fg-muted">Rien à répartir.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate" title={label(i.key)}>
              {label(i.key)}
            </span>
            <span className="shrink-0 whitespace-nowrap">
              <Pct value={i.share} /> <span className="text-xs text-fg-faint">· <Amount value={i.value} compact /></span>
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-3" role="img" aria-label={`${Math.round(i.share * 100)} %`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, Math.round(i.share * 100)))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
