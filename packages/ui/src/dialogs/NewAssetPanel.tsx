import { Search } from "lucide-react";
import { useState } from "react";
import type { AssetCandidate, AssetInput } from "@hamac/api";
import {
  ALLOWED_ASSETS,
  ASSET_KIND_LABELS,
  bondName,
  findSameBond,
  type AccountKind,
  type Asset,
  type AssetKind,
  type BondKind,
} from "@hamac/core";
import { Field, FormGrid, PercentInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { call } from "@/lib/transport";

/** Titre à créer au moment de l'achat. */
export interface NewAsset {
  kind: AssetKind;
  bondKind: BondKind | null;
  name: string;
  /** Le nom suit les champs (obligation) tant qu'on ne l'a pas modifié à la main. */
  nameAuto: boolean;
  isin: string;
  symbol: string;
  issuer: string;
  couponRate: number | null;
  maturityDate: string;
  couponFrequency: number;
}

type Choice = { kind: AssetKind; bondKind: BondKind | null; label: string };

/** Choix proposés selon le compte : les obligations se déclinent en OAT et entreprise. */
export function choicesFor(account: AccountKind): Choice[] {
  // Compte-titres : les obligations d'abord (usage principal dans le plan).
  const kinds = account === "cto" ? [...ALLOWED_ASSETS[account]].sort((a, b) => Number(b === "obligation") - Number(a === "obligation")) : ALLOWED_ASSETS[account];
  return kinds.flatMap((k): Choice[] =>
    k === "obligation"
      ? [
          { kind: k, bondKind: "etat", label: "OAT (État)" },
          { kind: k, bondKind: "entreprise", label: "Obligation d'entreprise" },
        ]
      : [{ kind: k, bondKind: null, label: ASSET_KIND_LABELS[k] }],
  );
}

export function newAssetFor(account: AccountKind): NewAsset {
  const first = choicesFor(account)[0] ?? { kind: "etf" as AssetKind, bondKind: null };
  return withChoice(
    { kind: first.kind, bondKind: first.bondKind, name: "", nameAuto: true, isin: "", symbol: "", issuer: "", couponRate: null, maturityDate: "", couponFrequency: 1 },
    first,
  );
}

function withChoice(n: NewAsset, c: { kind: AssetKind; bondKind: BondKind | null }): NewAsset {
  const issuer = c.bondKind === "etat" ? "République française" : c.bondKind === "entreprise" && n.issuer === "République française" ? "" : n.issuer;
  return rename({ ...n, kind: c.kind, bondKind: c.bondKind, issuer });
}

function rename(n: NewAsset): NewAsset {
  if (!n.nameAuto || n.kind !== "obligation") return n;
  return { ...n, name: n.couponRate != null && n.maturityDate ? bondName(n.bondKind, n.issuer || null, n.couponRate, n.maturityDate) : "" };
}

/** Champs manquants pour pouvoir créer le titre. */
export function newAssetErrors(n: NewAsset): string[] {
  const e: string[] = [];
  if (n.kind === "obligation") {
    if (n.couponRate == null) e.push("Indiquez le taux du coupon.");
    if (!n.maturityDate) e.push("Indiquez l'échéance.");
    if (n.bondKind === "entreprise" && !n.issuer.trim()) e.push("Indiquez l'émetteur.");
  }
  if (!n.name.trim()) e.push("Donnez un nom au titre.");
  if (n.isin && !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(n.isin)) e.push("ISIN invalide (12 caractères).");
  return e;
}

export function toAssetInput(n: NewAsset): AssetInput {
  const isBond = n.kind === "obligation";
  return {
    kind: n.kind,
    name: n.name.trim(),
    isin: n.isin || null,
    symbol: n.symbol || null,
    priceSource: isBond ? "modele" : n.kind === "crypto" || n.isin || n.symbol ? "auto" : "manuel",
    couponRate: isBond ? n.couponRate : null,
    maturityDate: isBond ? n.maturityDate || null : null,
    couponFrequency: isBond ? n.couponFrequency : null,
    issuer: isBond ? n.issuer.trim() || null : null,
    bondKind: isBond ? n.bondKind : null,
  };
}

/** Un titre existant identique, pour éviter les doublons. */
export function existingAsset(n: NewAsset, assets: readonly Asset[]): Asset | null {
  if (n.kind === "obligation") return findSameBond(assets, { isin: n.isin || null, couponRate: n.couponRate, maturityDate: n.maturityDate || null, issuer: n.issuer || null, bondKind: n.bondKind });
  return (n.isin && assets.find((a) => !a.archived && a.isin === n.isin)) || null;
}

export function NewAssetPanel({
  account,
  value,
  onChange,
  assets,
  onUseExisting,
  showErrors,
}: {
  account: AccountKind;
  value: NewAsset;
  onChange: (n: NewAsset) => void;
  assets: readonly Asset[];
  onUseExisting: (a: Asset) => void;
  showErrors: boolean;
}) {
  const [results, setResults] = useState<AssetCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const set = <K extends keyof NewAsset>(k: K, v: NewAsset[K]) => onChange(rename({ ...value, [k]: v }));
  const isBond = value.kind === "obligation";
  const dup = existingAsset(value, assets);
  const errors = newAssetErrors(value);

  const search = async () => {
    const q = (value.isin || value.name).trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    try {
      const r = await call("assets.search", { query: q });
      setResults(r.candidates.filter((c) => ALLOWED_ASSETS[account].includes(c.kind)));
      if (r.errors.length) setSearchError(r.errors.join(" · "));
    } catch (e) {
      setSearchError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };
  const pick = (c: AssetCandidate) => {
    const bondKind: BondKind | null = c.kind === "obligation" ? (/france|frtr/i.test(c.detail) ? "etat" : "entreprise") : null;
    const issuer = c.kind === "obligation" ? (bondKind === "etat" ? "République française" : (c.detail.split(" · ")[0] ?? "")) : "";
    onChange(
      rename({
        ...value,
        kind: c.kind,
        bondKind,
        isin: c.isin ?? value.isin,
        symbol: c.symbol ?? "",
        issuer,
        couponRate: c.couponRate ?? value.couponRate,
        maturityDate: c.maturityDate ?? value.maturityDate,
        name: c.kind === "obligation" ? value.name : c.name,
        nameAuto: c.kind === "obligation",
      }),
    );
    setResults(null);
  };

  return (
    <div className="space-y-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div>
        <div className="mb-2 text-xs font-medium text-fg-muted">Nouveau titre</div>
        <div className="flex flex-wrap gap-2">
          {choicesFor(account).map((c) => {
            const on = value.kind === c.kind && value.bondKind === c.bondKind;
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => onChange(withChoice(value, c))}
                className={cn("rounded-lg border px-3 py-1.5 text-sm", on ? "border-accent bg-accent/15 text-fg" : "border-line-strong text-fg-muted hover:text-fg")}
                aria-pressed={on}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {isBond && (
        <FormGrid cols={3}>
          <Field label="Émetteur">
            {(id) => <TextInput id={id} value={value.issuer} onChange={(e) => set("issuer", e.target.value)} placeholder={value.bondKind === "entreprise" ? "ex. TotalEnergies" : ""} />}
          </Field>
          <Field label="Taux du coupon (nominal)" help="Écrit dans le nom : « OAT 3 % 2033 ».">
            {(id) => <PercentInput id={id} value={value.couponRate} onChange={(v) => set("couponRate", v)} />}
          </Field>
          <Field label="Échéance">{(id) => <TextInput id={id} type="date" value={value.maturityDate} onChange={(e) => set("maturityDate", e.target.value)} />}</Field>
        </FormGrid>
      )}

      <FormGrid cols={isBond ? 3 : 2}>
        <Field label="Nom" help={isBond && value.nameAuto ? "Généré automatiquement." : undefined}>
          {(id) => <TextInput id={id} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value, nameAuto: false })} placeholder={isBond ? "" : "ex. Amundi PEA MSCI World"} />}
        </Field>
        <Field label="ISIN (facultatif)" help="Pour retrouver le titre et son cours.">
          {(id) => (
            <div className="flex gap-2">
              <TextInput id={id} value={value.isin} onChange={(e) => set("isin", e.target.value.toUpperCase().trim())} className="font-mono" placeholder="FR00…" />
              <Button type="button" onClick={search} disabled={searching || (value.isin || value.name).trim().length < 2} title="Rechercher et pré-remplir">
                <Search size={14} />
              </Button>
            </div>
          )}
        </Field>
        {isBond && (
          <Field label="Coupons">
            {(id) => (
              <Select id={id} value={value.couponFrequency} onChange={(e) => set("couponFrequency", Number(e.target.value))}>
                <option value={1}>Annuel</option>
                <option value={2}>Semestriel</option>
                <option value={4}>Trimestriel</option>
              </Select>
            )}
          </Field>
        )}
      </FormGrid>

      {searchError && <p className="text-xs text-warning">{searchError}</p>}
      {results && (
        <ul className="max-h-44 overflow-y-auto rounded-lg border border-line bg-surface">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-fg-muted">Aucun résultat : remplissez les champs à la main.</li>}
          {results.map((c, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(c)} className="w-full px-3 py-1.5 text-left hover:bg-surface-3">
                <div className="text-sm">
                  {c.name} <span className="text-xs text-fg-muted">· {ASSET_KIND_LABELS[c.kind]}</span>
                </div>
                <div className="truncate text-xs text-fg-faint">{c.detail}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {dup && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="text-fg-muted">
            Déjà dans vos titres : <span className="text-fg">{dup.name}</span>
          </span>
          <Button type="button" variant="ghost" className="h-7 text-accent" onClick={() => onUseExisting(dup)}>
            Utiliser ce titre
          </Button>
        </div>
      )}
      {showErrors && errors.length > 0 && <p className="text-xs text-negative">{errors.join(" ")}</p>}
    </div>
  );
}
