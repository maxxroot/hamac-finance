import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { AssetCandidate } from "@hamac/api";
import { Modal, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { REFERENCE_KINDS, type Reference } from "@/lib/performance";
import { call } from "@/lib/transport";

/** Cherche un titre à comparer. Il n'est pas ajouté au portefeuille. */
export function ReferenceDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (reference: Reference) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(null);
    setError(null);
  }, [open]);

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const r = await call("assets.search", { query: query.trim() });
      // Sans ISIN ni symbole, aucune source ne peut donner les cours.
      setResults(r.candidates.filter((c) => REFERENCE_KINDS.includes(c.kind) && (c.isin || c.symbol)));
      if (r.errors.length) setError(r.errors.join(" · "));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const pick = (c: AssetCandidate) => {
    onPick({ kind: c.kind as Reference["kind"], name: c.name, isin: c.isin, symbol: c.symbol });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Rechercher un titre à comparer">
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
      <p className="mt-2 text-xs text-fg-faint">Le titre sert seulement à la comparaison : il ne s'ajoute pas à vos placements.</p>
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
              <Button type="button" className="shrink-0" onClick={() => pick(c)}>
                Choisir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
