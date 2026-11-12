import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CompositionAdmin } from "@hamac/api";
import { TextInput } from "./form";
import { EmptyRow, Table, Td, Th, Tr } from "./table";
import { Button, Card, CardTitle } from "./ui";
import { EXPOSURE_KEY } from "@/lib/exposure";
import { formatDate } from "@/lib/numbers";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/transport";

const KEY = [EXPOSURE_KEY, "admin"] as const;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

/**
 * Paramètres › Cours, pour l'administrateur : compositions d'ETF en échec, et liens communs
 * « ETF synthétique ou non géré → ETF physique équivalent », à corriger ou supprimer.
 */
export function CompositionAdminCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => call("exposure.admin") });
  const [editing, setEditing] = useState<string | null>(null);
  const [isin, setIsin] = useState("");
  const save = useMutation({
    mutationFn: (input: { isin: string; proxyIsin: string | null }) => call("exposure.adminLink", input),
    onSuccess: (r: CompositionAdmin, input) => {
      qc.setQueryData(KEY, r);
      void qc.invalidateQueries({ queryKey: [EXPOSURE_KEY] });
      setEditing(null);
      toast("success", input.proxyIsin ? "Lien corrigé" : "Lien supprimé");
    },
    onError: (e: Error) => toast("error", e.message),
  });
  if (!data?.canEdit) return null;

  return (
    <>
      <Card>
        <CardTitle hint={data.failures.length ? `${data.failures.length} en échec` : "aucun échec"}>Compositions des ETF</CardTitle>
        {data.failures.length === 0 ? (
          <p className="text-sm text-fg-muted">Toutes les compositions demandées ont été téléchargées. Elles sont mises à jour chaque trimestre.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.failures.map((f) => (
              <li key={f.isin}>
                <span className="font-mono text-xs">{f.isin}</span> {f.fundName && <span>· {f.fundName}</span>}
                <div className="text-xs text-warning">
                  {f.message} · essai du {formatDate(f.checkedAt?.slice(0, 10))}
                  {f.fetchedAt ? ` · composition du ${formatDate(f.asOf)} gardée` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-fg-faint">Nouvel essai automatique toutes les six heures. Un échec durable peut venir d'un changement de format chez Amundi ou iShares.</p>
      </Card>

      <Card>
        <CardTitle hint="commun à toute l'instance">ETF équivalents</CardTitle>
        <p className="mb-3 text-xs text-fg-muted">
          Pour un ETF synthétique ou d'un émetteur non géré, le premier ETF physique choisi et vérifié sert à tous les utilisateurs, qui peuvent en choisir un autre pour eux seuls. Corrigez ici un lien qui
          ne suit pas le même indice.
        </p>
        <Table>
          <thead>
            <tr>
              <Th>ETF</Th>
              <Th>Composition reprise de</Th>
              <Th>Depuis</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.links.length === 0 && <EmptyRow cols={4}>Aucun lien pour l'instant.</EmptyRow>}
            {data.links.map((l) => (
              <Tr key={l.isin}>
                <Td>
                  <div>{l.name ?? l.isin}</div>
                  <div className="font-mono text-xs text-fg-faint">{l.isin}</div>
                </Td>
                <Td>
                  {editing === l.isin ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (ISIN_RE.test(isin)) save.mutate({ isin: l.isin, proxyIsin: isin });
                      }}
                    >
                      <TextInput value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase().trim())} className="h-8 font-mono" placeholder="IE00B4L5Y983" aria-label={`Nouvel équivalent de ${l.isin}`} autoFocus />
                      <Button type="submit" className="h-8" disabled={!ISIN_RE.test(isin) || save.isPending}>
                        {save.isPending ? "…" : "Vérifier"}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div>{l.proxyName ?? l.proxyIsin}</div>
                      <div className="font-mono text-xs text-fg-faint">{l.proxyIsin}</div>
                    </>
                  )}
                </Td>
                <Td className="text-xs text-fg-muted">{formatDate(l.createdAt.slice(0, 10))}</Td>
                <Td align="right" className="whitespace-nowrap">
                  {editing === l.isin ? (
                    <Button variant="ghost" className="h-7" onClick={() => setEditing(null)}>
                      Annuler
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        className="h-7 text-accent"
                        onClick={() => {
                          setEditing(l.isin);
                          setIsin("");
                        }}
                      >
                        Corriger
                      </Button>
                      <Button variant="ghost" className="h-7 text-negative" onClick={() => save.mutate({ isin: l.isin, proxyIsin: null })} disabled={save.isPending}>
                        Supprimer
                      </Button>
                    </>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
