import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  ACCOUNT_KIND_LABELS,
  INSTITUTION_KIND_LABELS,
  describeOrderFees,
  formatEur,
  orderFee,
  type Institution,
  type PlanParams, type OfferKind,
} from "@hamac/core";
import { Field, MoneyInput, PercentInput } from "@/components/form";
import { Pct } from "@/components/Stat";
import { Table, Td, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { InstitutionDialog } from "@/dialogs/InstitutionDialog";
import { cn } from "@/lib/cn";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { SortTh, useSortable } from "@/lib/sort";

const yesNoSort = (v: boolean | null | undefined) => (v == null ? null : v ? 1 : 0);

const ORDER_SIZES = [100, 250, 500, 1000, 5000];
const OFFER_ORDER: OfferKind[] = ["pea", "cto", "assurance_vie", "livret", "crowdlending", "crypto"];

export function Etablissements() {
  const idx = useWorkspaceIndex();
  const del = useMutate("institutions.delete", { success: "Établissement supprimé" });
  const [editing, setEditing] = useState<Institution | null>(null);
  // Lien direct : onglet Établissements avec ?nouveau=1 ouvre la création.
  const [search, setSearch] = useSearchParams();
  const [creating, setCreating] = useState(search.has("nouveau"));
  if (!idx) return null;
  const list = idx.ws.institutions;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-3xl text-sm text-fg-muted">Banques, courtiers, assureurs et plateformes : leurs offres, leurs frais, et la comparaison. Chaque compte est rattaché à un établissement, dont la grille sert au calcul des frais.</p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Ajouter un établissement
        </Button>
      </div>

      {list.length === 0 ? (
        <Card className="mb-6 py-10 text-center">
          <p className="text-fg-muted">Aucun établissement. Ajoutez votre banque, votre courtier, votre assurance-vie…</p>
          <p className="mt-1 text-sm text-fg-faint">Vous pouvez aussi ajouter des offres que vous étudiez, pour les comparer avant d'ouvrir un compte.</p>
        </Card>
      ) : (
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {list.map((inst) => (
            <InstitutionCard key={inst.id} inst={inst} onEdit={() => setEditing(inst)} onDelete={() => confirm(`Supprimer « ${inst.name} » ? Les comptes rattachés repasseront sur les frais par défaut.`) && del.mutate({ id: inst.id })} />
          ))}
        </div>
      )}

      <BrokerComparison list={list} />
      <AvComparison list={list} />
      <CryptoComparison list={list} />
      <DefaultFees params={idx.ws.params} />

      <InstitutionDialog open={creating || !!editing} institution={editing} onClose={() => {
          setCreating(false);
          setEditing(null);
          if (search.has("nouveau"))
            setSearch(
              (p) => {
                p.delete("nouveau");
                return p;
              },
              { replace: true },
            );
        }}
      />
    </>
  );
}

function InstitutionCard({ inst, onEdit, onDelete }: { inst: Institution; onEdit: () => void; onDelete: () => void }) {
  const idx = useWorkspaceIndex()!;
  const accounts = idx.ws.accounts.filter((a) => a.institutionId === inst.id);
  const lines: Array<[string, string]> = [];
  if (inst.offers.pea) lines.push(["PEA", describeOrderFees(inst.offers.pea.orderFees)]);
  if (inst.offers.cto) lines.push(["Compte-titres", describeOrderFees(inst.offers.cto.orderFees)]);
  for (const k of ["pea", "cto"] as const) {
    const o = inst.offers[k];
    if (o && (o.custodyFixed || o.custodyRate)) lines.push([`Garde (${k === "pea" ? "PEA" : "CTO"})`, [o.custodyFixed ? `${formatEur(o.custodyFixed)}/an` : "", o.custodyRate ? `${o.custodyRate * 100} %/an` : ""].filter(Boolean).join(" + ")]);
  }
  const av = inst.offers.assurance_vie;
  if (av) lines.push(["Assurance-vie", `versements ${pct(av.entryFee)} · gestion fonds euros ${pct(av.euroFee)} · UC ${pct(av.ucFee)}`]);
  if (inst.offers.crowdlending) lines.push(["Intérêts", inst.offers.crowdlending.interestMode === "calcule" ? "calculés par projet" : "déclarés pour la plateforme"]);
  if (inst.offers.crowdlending) lines.push(["Impôts", inst.offers.crowdlending.taxWithheld ? `prélevés par la plateforme : ${pct(inst.offers.crowdlending.taxRate ?? 0)}` : "à déclarer soi-même"]);
  if (inst.offers.crypto) lines.push(["Crypto", `${pct(inst.offers.crypto.tradeFee)} par opération · spread ${pct(inst.offers.crypto.spread)}`]);

  return (
    <Card className="group flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{inst.name}</h2>
            {inst.score != null && <Badge tone="accent">{inst.score.toLocaleString("fr-FR")}/10</Badge>}
          </div>
          <div className="text-xs text-fg-faint">
            {INSTITUTION_KIND_LABELS[inst.kind]}
            {inst.website && (
              <a href={inst.website} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 hover:text-accent">
                site <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={onEdit} aria-label="Modifier">
            <Pencil size={14} />
          </button>
          <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={onDelete} aria-label="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {OFFER_ORDER.filter((k) => inst.offers[k]).map((k) => (
          <Badge key={k}>{ACCOUNT_KIND_LABELS[k]}</Badge>
        ))}
      </div>
      {lines.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {lines.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-muted">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-auto border-t border-line pt-3 text-xs text-fg-muted">
        {accounts.length ? (
          <>
            Comptes : <span className="text-fg">{accounts.map((a) => a.name).join(", ")}</span>
          </>
        ) : (
          <Badge>À l'étude</Badge>
        )}
        {inst.comment && <p className="mt-1.5 text-fg-faint">{inst.comment}</p>}
      </div>
    </Card>
  );
}

const pct = (r: number) => `${(r * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const yesNo = (v: boolean | null | undefined) => (v == null ? <span className="text-fg-faint">—</span> : v ? "Oui" : "Non");

function Compare({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="mb-6 p-0">
      <div className="px-5 pt-4 pb-3">
        <CardTitle hint={hint}>{title}</CardTitle>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

/** Met en avant la meilleure valeur d'une colonne (la plus basse ou la plus haute). */
function best(values: Array<number | null | undefined>, mode: "min" | "max"): number | null {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  return mode === "min" ? Math.min(...v) : Math.max(...v);
}

function BrokerComparison({ list }: { list: Institution[] }) {
  const rows = list.flatMap((i) => (["pea", "cto"] as const).filter((k) => i.offers[k]).map((k) => ({ inst: i, kind: k, offer: i.offers[k]! })));
  const { sorted, by } = useSortable(rows, {
    nom: (r) => r.inst.name,
    compte: (r) => r.kind,
    ...Object.fromEntries(ORDER_SIZES.map((s) => [`o${s}`, (r: (typeof rows)[number]) => orderFee(r.offer.orderFees, s)])),
    garde: (r) => r.offer.custodyFixed + r.offer.custodyRate * 10000,
    etf: (r) => yesNoSort(r.offer.etfWorld),
    oblig: (r) => yesNoSort(r.offer.directBonds),
    prog: (r) => yesNoSort(r.offer.programmed),
  });
  if (!rows.length) return null;
  const fees = (size: number) => rows.map((r) => orderFee(r.offer.orderFees, size));
  return (
    <Compare title="Comparer le courtage" hint="frais d'un ordre selon son montant">
      <Table className="rounded-none border-x-0 border-b-0">
        <thead>
          <tr>
            <SortTh {...by("nom")}>Établissement</SortTh>
            <SortTh {...by("compte")}>Compte</SortTh>
            {ORDER_SIZES.map((s) => (
              <SortTh key={s} {...by(`o${s}`)} align="right">
                Ordre de {formatEur(s, { compact: true })}
              </SortTh>
            ))}
            <SortTh {...by("garde")} align="right">Garde / an</SortTh>
            <SortTh {...by("etf")}>ETF monde (PEA)</SortTh>
            <SortTh {...by("oblig")}>Obligations en direct</SortTh>
            <SortTh {...by("prog")}>Programmé</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <Tr key={`${r.inst.id}-${r.kind}`}>
              <Td className="font-medium">{r.inst.name}</Td>
              <Td className="text-fg-muted">{r.kind === "pea" ? "PEA" : "Compte-titres"}</Td>
              {ORDER_SIZES.map((s) => {
                const all = fees(s).filter((_, j) => rows[j].kind === r.kind);
                const f = orderFee(r.offer.orderFees, s);
                const b = best(all, "min");
                return (
                  <Td key={s} align="right" className={cn(b != null && f === b && "font-semibold text-positive")}>
                    {formatEur(f)}
                    <div className="text-[11px] text-fg-faint">{pct(f / s)}</div>
                  </Td>
                );
              })}
              <Td align="right">{r.offer.custodyFixed || r.offer.custodyRate ? [r.offer.custodyFixed ? formatEur(r.offer.custodyFixed) : "", r.offer.custodyRate ? pct(r.offer.custodyRate) : ""].filter(Boolean).join(" + ") : "0 €"}</Td>
              <Td>{r.kind === "pea" ? yesNo(r.offer.etfWorld) : ""}</Td>
              <Td>{r.kind === "cto" ? yesNo(r.offer.directBonds) : ""}</Td>
              <Td>{yesNo(r.offer.programmed)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Compare>
  );
}

function AvComparison({ list }: { list: Institution[] }) {
  const rows = list.filter((i) => i.offers.assurance_vie).map((i) => ({ inst: i, o: i.offers.assurance_vie! }));
  const av = useSortable(rows, {
    nom: (r) => r.inst.name,
    entree: (r) => r.o.entryFee,
    euro: (r) => r.o.euroFee,
    uc: (r) => r.o.ucFee,
    dernier: (r) => r.o.euroRateLast,
    moyenne: (r) => r.o.euroRate5y,
    cent: (r) => yesNoSort(r.o.full100Euro),
    bonus: (r) => yesNoSort(r.o.bonusConditioned),
    etf: (r) => yesNoSort(r.o.etfWorld),
    prog: (r) => r.o.programmedFrom,
    note: (r) => r.inst.score,
  });
  if (!rows.length) return null;
  const col = <T,>(f: (o: (typeof rows)[number]["o"]) => T) => rows.map((r) => f(r.o));
  const bEntry = best(col((o) => o.entryFee), "min");
  const bEuro = best(col((o) => o.euroFee), "min");
  const bUc = best(col((o) => o.ucFee), "min");
  const bLast = best(col((o) => o.euroRateLast), "max");
  const b5 = best(col((o) => o.euroRate5y), "max");
  const hl = (v: number | null, b: number | null) => cn(b != null && v === b && "font-semibold text-positive");
  return (
    <Compare title="Comparer les assurances-vie">
      <Table className="rounded-none border-x-0 border-b-0">
        <thead>
          <tr>
            <SortTh {...av.by("nom")}>Contrat</SortTh>
            <SortTh {...av.by("entree")} align="right">Frais sur versements</SortTh>
            <SortTh {...av.by("euro")} align="right">Gestion fonds euros</SortTh>
            <SortTh {...av.by("uc")} align="right">Gestion UC</SortTh>
            <SortTh {...av.by("dernier")} align="right">Fonds euros : dernier taux</SortTh>
            <SortTh {...av.by("moyenne")} align="right">Moyenne 5 ans</SortTh>
            <SortTh {...av.by("cent")}>100 % fonds euros</SortTh>
            <SortTh {...av.by("bonus")}>Bonus conditionné</SortTh>
            <SortTh {...av.by("etf")}>ETF monde</SortTh>
            <SortTh {...av.by("prog")} align="right">Programmé dès</SortTh>
            <SortTh {...av.by("note")} align="right">Note</SortTh>
          </tr>
        </thead>
        <tbody>
          {av.sorted.map(({ inst, o }) => (
            <Tr key={inst.id}>
              <Td className="font-medium">
                {inst.name}
                {o.insurer && <div className="text-xs font-normal text-fg-faint">{o.insurer}</div>}
              </Td>
              <Td align="right" className={hl(o.entryFee, bEntry)}>
                <Pct value={o.entryFee} digits={2} />
              </Td>
              <Td align="right" className={hl(o.euroFee, bEuro)}>
                <Pct value={o.euroFee} digits={2} />
              </Td>
              <Td align="right" className={hl(o.ucFee, bUc)}>
                <Pct value={o.ucFee} digits={2} />
              </Td>
              <Td align="right" className={hl(o.euroRateLast, bLast)}>
                <Pct value={o.euroRateLast} digits={2} />
              </Td>
              <Td align="right" className={hl(o.euroRate5y, b5)}>
                <Pct value={o.euroRate5y} digits={2} />
              </Td>
              <Td>{yesNo(o.full100Euro)}</Td>
              <Td>{yesNo(o.bonusConditioned)}</Td>
              <Td>{yesNo(o.etfWorld)}</Td>
              <Td align="right">{o.programmedFrom != null ? formatEur(o.programmedFrom, { compact: true }) : "—"}</Td>
              <Td align="right">{inst.score != null ? `${inst.score}/10` : "—"}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Compare>
  );
}

function CryptoComparison({ list }: { list: Institution[] }) {
  const rows = list.filter((i) => i.offers.crypto).map((i) => ({ inst: i, o: i.offers.crypto! }));
  const cr = useSortable(rows, {
    nom: (r) => r.inst.name,
    frais: (r) => r.o.tradeFee,
    spread: (r) => r.o.spread,
    total: (r) => r.o.tradeFee + r.o.spread,
    note: (r) => r.inst.score,
  });
  if (!rows.length) return null;
  const bTotal = best(rows.map((r) => r.o.tradeFee + r.o.spread), "min");
  return (
    <Compare title="Comparer les plateformes crypto">
      <Table className="rounded-none border-x-0 border-b-0">
        <thead>
          <tr>
            <SortTh {...cr.by("nom")}>Plateforme</SortTh>
            <SortTh {...cr.by("frais")} align="right">Frais par opération</SortTh>
            <SortTh {...cr.by("spread")} align="right">Spread estimé</SortTh>
            <SortTh {...cr.by("total")} align="right">Coût total d'un achat</SortTh>
            <SortTh {...cr.by("note")} align="right">Note</SortTh>
          </tr>
        </thead>
        <tbody>
          {cr.sorted.map(({ inst, o }) => (
            <Tr key={inst.id}>
              <Td className="font-medium">{inst.name}</Td>
              <Td align="right">{pct(o.tradeFee)}</Td>
              <Td align="right">{pct(o.spread)}</Td>
              <Td align="right" className={cn(bTotal != null && o.tradeFee + o.spread === bTotal && "font-semibold text-positive")}>
                {pct(o.tradeFee + o.spread)}
              </Td>
              <Td align="right">{inst.score != null ? `${inst.score}/10` : "—"}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </Compare>
  );
}

/** Frais utilisés pour un compte qui n'est rattaché à aucun établissement. */
function DefaultFees({ params }: { params: PlanParams }) {
  const save = useMutate("params.update", { success: "Frais par défaut enregistrés" });
  const [rate, setRate] = useState<number | null>(params.broker.feeRate);
  const [min, setMin] = useState<number | null>(params.broker.minFee);
  const [crypto, setCrypto] = useState<number | null>(params.crypto.feeRate);
  useEffect(() => {
    setRate(params.broker.feeRate);
    setMin(params.broker.minFee);
    setCrypto(params.crypto.feeRate);
  }, [params]);
  const dirty = rate !== params.broker.feeRate || min !== params.broker.minFee || crypto !== params.crypto.feeRate;
  return (
    <Card className="max-w-3xl">
      <CardTitle hint="comptes sans établissement">Frais par défaut</CardTitle>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="Courtage (% par ordre)">{(id) => <PercentInput id={id} value={rate} onChange={setRate} />}</Field>
        <Field label="Courtage minimum">{(id) => <MoneyInput id={id} value={min} onChange={setMin} />}</Field>
        <Field label="Crypto (% par opération)">{(id) => <PercentInput id={id} value={crypto} onChange={setCrypto} />}</Field>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ ...params, broker: { feeRate: rate ?? 0, minFee: min ?? 0 }, crypto: { ...params.crypto, feeRate: crypto ?? 0 } })}
        >
          Enregistrer
        </Button>
      </div>
    </Card>
  );
}
