import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { AssetCandidate } from "@hamac/api";
import type { AssetInput } from "@hamac/api";
import { ASSET_KIND_LABELS, ASSET_KINDS, BOND_KIND_LABELS, BOND_KINDS, OAT_MATURITY_DAY, PRICE_PROVIDER_LABELS, maturityFromMonth, type BondKind, type Asset, type AssetKind, type PriceProvider, type PriceSource } from "@hamac/core";
import { Button } from "@/components/ui";
import { CompositionNotice } from "@/components/CompositionNotice";
import { Field, FormGrid, Modal, MoneyInput, PercentInput, Select, TextInput } from "@/components/form";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { todayIso } from "@/lib/numbers";
import { call } from "@/lib/transport";
import { cn } from "@/lib/cn";
import { AllocationChoice } from "./AllocationChoice";

type Draft = Required<Omit<AssetInput, "id">> & { id?: string };

/** « AMUNDI MSCI WORLD » → « Amundi Msci World ». */
function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase()) : s;
}

function empty(kind: AssetKind): Draft {
  return {
    kind,
    name: "",
    isin: null,
    symbol: null,
    priceSource: kind === "obligation" ? "modele" : kind === "scpi" ? "manuel" : "auto",
    priceProvider: null,
    priceUrl: null,
    pricePath: null,
    classId: null,
    inAllocation: null,
    manualPrice: null,
    manualPriceDate: null,
    targetWeight: null,
    ter: null,
    couponRate: null,
    maturityDate: null,
    couponFrequency: kind === "obligation" ? 1 : null,
    nextCouponDate: null,
    issuer: null,
    bondKind: kind === "obligation" ? "etat" : null,
    archived: false,
  };
}

/** Sans objet : on n'enregistre ni source imposée hors cours automatique, ni adresse hors source « URL ». */
function cleaned(d: Draft): Draft {
  const provider = d.priceSource === "auto" ? d.priceProvider : null;
  return { ...d, isin: d.isin?.trim() || null, symbol: d.symbol?.trim() || null, priceProvider: provider, priceUrl: provider === "url" ? d.priceUrl?.trim() || null : null, pricePath: provider === "url" ? d.pricePath?.trim() || null : null };
}

function providersFor(kind: AssetKind): PriceProvider[] {
  if (kind === "crypto") return ["coingecko", "url"];
  return kind === "action" ? ["euronext", "twelvedata", "yahoo", "url"] : ["justetf", "euronext", "twelvedata", "yahoo", "url"];
}

const SOURCE_LABELS: Record<PriceSource, string> = {
  auto: "Automatique (fournisseur de cours)",
  manuel: "Saisi à la main",
  modele: "Calculé (détenue jusqu'à l'échéance)",
};

export function AssetDialog({ open, onClose, asset, defaultKind = "etf" }: { open: boolean; onClose: () => void; asset?: Asset | null; defaultKind?: AssetKind }) {
  const [d, setD] = useState<Draft>(empty(defaultKind));
  const save = useMutate("assets.upsert", { success: asset ? "Titre mis à jour" : "Titre ajouté" });
  const classes = useWorkspaceIndex()?.ws.params.customClasses ?? [];

  useEffect(() => {
    if (open) setD(asset ? { ...asset } : empty(defaultKind));
  }, [open, asset, defaultKind]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetCandidate[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setSearchError(null);
    }
  }, [open]);
  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await call("assets.search", { query });
      setResults(r.candidates);
      if (r.errors.length) setSearchError(r.errors.join(" · "));
    } catch (e) {
      setSearchError((e as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };
  const pick = (c: AssetCandidate) => {
    setD((x) => ({
      ...empty(c.kind),
      id: x.id,
      name: c.kind === "obligation" && c.couponRate != null ? c.name : titleCase(c.name),
      isin: c.isin ?? x.isin,
      symbol: c.symbol,
      couponRate: c.couponRate,
      maturityDate: c.maturityDate,
      issuer: c.kind === "obligation" ? (c.detail.split(" · ")[0] ?? null) : null,
      priceSource: c.kind === "obligation" ? "modele" : c.kind === "action" && !c.symbol ? "manuel" : "auto",
    }));
    setResults(null);
  };
  const isBond = d.kind === "obligation";
  const sources: PriceSource[] = isBond ? ["modele", "manuel"] : d.kind === "scpi" ? ["manuel"] : ["auto", "manuel"];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? `Modifier « ${asset.name} »` : "Nouveau titre"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => save.mutate(cleaned(d), { onSuccess: onClose })} disabled={save.isPending || !d.name.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!asset && (
          <div className="rounded-xl border border-line bg-surface-2/50 p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <div className="relative flex-1">
                <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-fg-faint" />
                <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher par nom ou ISIN : TotalEnergies, MSCI World, FR001400H7V7, bitcoin…" className="pl-9" autoFocus />
              </div>
              <Button type="submit" disabled={searching || query.trim().length < 2}>
                {searching ? "…" : "Rechercher"}
              </Button>
            </form>
            {searchError && <p className="mt-2 text-xs text-warning">{searchError}</p>}
            {results && (
              <ul className="mt-2 max-h-56 overflow-y-auto">
                {results.length === 0 && <li className="px-2 py-2 text-xs text-fg-muted">Aucun résultat : remplissez la fiche à la main.</li>}
                {results.map((c, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => pick(c)} className={cn("w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface-3")}>
                      <div className="text-sm">
                        {c.name} <span className="text-xs text-fg-muted">· {ASSET_KIND_LABELS[c.kind]}</span>
                      </div>
                      <div className="truncate text-xs text-fg-faint">{c.detail}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-fg-faint">Recherche via OpenFIGI (actions, ETF, obligations) et CoinGecko (crypto). Pour un ETF, l'ISIN suffit à obtenir le cours.</p>
          </div>
        )}
        <FormGrid>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => setD((x) => ({ ...empty(e.target.value as AssetKind), id: x.id, name: x.name, isin: x.isin }))}>
                {ASSET_KINDS.filter((k) => k !== "fonds_euros" || d.kind === "fonds_euros").map((k) => (
                  <option key={k} value={k}>
                    {ASSET_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="ISIN" help="Identifiant unique du titre (12 caractères).">
            {(id) => <TextInput id={id} value={d.isin ?? ""} onChange={(e) => set("isin", e.target.value.toUpperCase() || null)} placeholder="FR0011871128" className="font-mono" />}
          </Field>
          <Field label="Nom" className="sm:col-span-2">
            {(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder={isBond ? "ex. OAT 3,5 % 25/11/2033" : "ex. Amundi PEA S&P 500"} />}
          </Field>
        </FormGrid>
        <CompositionNotice kind={d.kind} isin={d.isin} />

        {isBond && (
          <Field label="Type d'obligation">
            {(id) => (
              <Select
                id={id}
                value={d.bondKind ?? "etat"}
                onChange={(e) => {
                  const bk = e.target.value as BondKind;
                  setD((x) => ({
                    ...x,
                    bondKind: bk,
                    issuer: bk === "etat" ? (x.issuer ?? "République française") : x.issuer === "République française" ? null : x.issuer,
                    maturityDate: x.maturityDate ? maturityFromMonth(x.maturityDate.slice(0, 7), bk) : x.maturityDate,
                  }));
                }}
              >
                {BOND_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {BOND_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {isBond && (
          <FormGrid cols={3}>
            <Field label="Coupon annuel">{(id) => <PercentInput id={id} value={d.couponRate} onChange={(v) => set("couponRate", v)} />}</Field>
            <Field label="Échéance" help={d.bondKind === "etat" ? `Mois et année ; une OAT est remboursée le ${OAT_MATURITY_DAY}.` : "Mois et année."}>
              {(id) => (
                <TextInput
                  id={id}
                  type="month"
                  value={d.maturityDate?.slice(0, 7) ?? ""}
                  onChange={(e) => set("maturityDate", e.target.value ? maturityFromMonth(e.target.value, d.bondKind ?? "etat") : null)}
                />
              )}
            </Field>
            <Field label="Émetteur">{(id) => <TextInput id={id} value={d.issuer ?? ""} onChange={(e) => set("issuer", e.target.value || null)} placeholder="République française" />}</Field>
          </FormGrid>
        )}
        {isBond && (
          <FormGrid>
            <Field label="Coupons">
              {(id) => (
                <Select id={id} value={d.couponFrequency ?? 1} onChange={(e) => set("couponFrequency", Number(e.target.value))}>
                  <option value={1}>Annuel</option>
                  <option value={2}>Semestriel</option>
                  <option value={4}>Trimestriel</option>
                </Select>
              )}
            </Field>
            <Field label="Prochain coupon (facultatif)" help="Vide : déduit de l'échéance. Inutile de la remettre à jour, les suivants s'en déduisent.">
              {(id) => <TextInput id={id} type="date" value={d.nextCouponDate ?? ""} onChange={(e) => set("nextCouponDate", e.target.value || null)} />}
            </Field>
          </FormGrid>
        )}

        <FormGrid>
          <Field label="Source du cours">
            {(id) => (
              <Select id={id} value={d.priceSource} onChange={(e) => set("priceSource", e.target.value as PriceSource)}>
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {d.priceSource === "auto" ? (
            <Field label="Symbole chez le fournisseur" help={d.kind === "crypto" ? "Identifiant CoinGecko, ex. bitcoin." : "Ex. PSP5.PA. Laissez vide : il sera retrouvé via l'ISIN."}>
              {(id) => <TextInput id={id} value={d.symbol ?? ""} onChange={(e) => set("symbol", e.target.value || null)} className="font-mono" />}
            </Field>
          ) : d.priceSource === "manuel" ? (
            <Field label={isBond ? "Cours (% du nominal)" : "Cours"}>
              {(id) => <MoneyInput id={id} value={d.manualPrice} onChange={(v) => setD((x) => ({ ...x, manualPrice: v, manualPriceDate: v == null ? null : todayIso() }))} />}
            </Field>
          ) : (
            <div className="self-end pb-2 text-xs text-fg-faint">Valeur calculée : prix d'achat amorti jusqu'au remboursement à 100 %, plus coupon couru.</div>
          )}
        </FormGrid>

        {d.priceSource === "auto" && (
          <FormGrid>
            <Field label="Fournisseur" help="Automatique : la chaîne de sources de Paramètres › Cours, avec repli si l'une ne répond pas.">
              {(id) => (
                <Select id={id} value={d.priceProvider ?? ""} onChange={(e) => set("priceProvider", (e.target.value || null) as PriceProvider | null)}>
                  <option value="">Automatique</option>
                  {providersFor(d.kind).map((p) => (
                    <option key={p} value={p}>
                      {PRICE_PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {d.priceProvider === "url" && (
              <Field label="Chemin du prix dans la réponse" help="Ex. data.0.close pour {data:[{close:12}]}.">
                {(id) => <TextInput id={id} value={d.pricePath ?? ""} onChange={(e) => set("pricePath", e.target.value || null)} className="font-mono" placeholder="data.0.close" />}
              </Field>
            )}
          </FormGrid>
        )}
        {d.priceSource === "auto" && d.priceProvider === "url" && (
          <Field label="Adresse (JSON)" help="{isin} et {symbol} sont remplacés par ceux du titre. Le cours renvoyé doit être en euros.">
            {(id) => <TextInput id={id} value={d.priceUrl ?? ""} onChange={(e) => set("priceUrl", e.target.value || null)} className="font-mono" placeholder="https://exemple.fr/cours/{isin}" />}
          </Field>
        )}

        <AllocationChoice value={d.inAllocation} defaultLabel="comme son compte, puis sa classe" onChange={(v) => set("inAllocation", v)} />

        {classes.length > 0 && (
          <Field label="Classe d'actifs" help="Par défaut, selon le type du titre. Les classes se créent dans Paramètres › Répartition.">
            {(id) => (
              <Select id={id} value={d.classId ?? ""} onChange={(e) => set("classId", e.target.value || null)}>
                <option value="">Par défaut</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {!isBond && d.kind !== "crypto" && d.kind !== "scpi" && (
          <FormGrid>
            <Field label="Part cible parmi les actions" help="La somme des parts cibles doit faire 100 %.">
              {(id) => <PercentInput id={id} value={d.targetWeight} onChange={(v) => set("targetWeight", v)} />}
            </Field>
            <Field label="Frais de gestion annuels (TER)">{(id) => <PercentInput id={id} value={d.ter} onChange={(v) => set("ter", v)} />}</Field>
          </FormGrid>
        )}
      </div>
    </Modal>
  );
}
