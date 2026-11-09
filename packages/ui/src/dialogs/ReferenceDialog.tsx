import { Search } from "lucide-react";
import { useState } from "react";
import type { AssetCandidate } from "@hamac/api";
import type { Asset, AssetKind } from "@hamac/core";
import { Modal, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { call } from "@/lib/transport";
import { useMutate } from "@/lib/workspace";

const KINDS: readonly AssetKind[] = ["etf", "action", "fonds", "crypto"];

/** Ajoute un titre qu'on ne détient pas, seulement pour lui comparer ses placements. */
export function ReferenceDialog({ open, assets, onClose, onAdded }: { open: boolean; assets: readonly Asset[]; onClose: () => void; onAdded: (assetId: string) => void }) {
  const upsert = useMutate("assets.upsert");
  const refresh = useMutate("prices.refresh");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const r = await call("assets.search", { query: query.trim() });
      setResults(r.candidates.filter((c) => KINDS.includes(c.kind)));
      if (r.errors.length) setError(r.errors.join(" · "));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const add = async (c: AssetCandidate) => {
    const existing = assets.find((a) => !a.archived && ((c.isin && a.isin === c.isin) || (!c.isin && c.symbol && a.symbol === c.symbol)));
    let id = existing?.id;
    if (!id) {
      const created = (await upsert.mutateAsync({ kind: c.kind, name: c.name, isin: c.isin, symbol: c.symbol, priceSource: "auto" })) as Asset;
      id = created.id;
      refresh.mutate(undefined);
    }
    onAdded(id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajouter une référence">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) void search();
        }}
      >
        <TextInput aria-label="Nom ou ISIN" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ex. MSCI World, S&P 500, Bitcoin, ou un ISIN" autoFocus />
        <Button type="submit" disabled={searching || query.trim().length < 2}>
          <Search size={14} /> Rechercher
        </Button>
      </form>
      <p className="mt-2 text-xs text-fg-faint">Préférez un ETF qui réinvestit ses dividendes (capitalisant) : sinon la comparaison le désavantage. Ses cours sont téléchargés sur 24 mois environ.</p>
      {error && <p className="mt-3 text-sm text-negative">{error}</p>}
      {results && results.length === 0 && !error && <p className="mt-4 text-sm text-fg-muted">Aucun résultat.</p>}
      {results && results.length > 0 && (
        <ul className="mt-4 max-h-80 divide-y divide-line/60 overflow-y-auto text-sm">
          {results.map((c) => (
            <li key={`${c.source}:${c.isin ?? c.symbol ?? c.name}`} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">{c.name}</span>
                <span className="block truncate text-xs text-fg-faint">{[c.isin, c.symbol, c.detail].filter(Boolean).join(" · ")}</span>
              </span>
              <Button type="button" className="shrink-0" disabled={upsert.isPending} onClick={() => void add(c)}>
                Ajouter
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
