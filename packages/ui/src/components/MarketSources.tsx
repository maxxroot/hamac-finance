import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import { PRICE_PROVIDER_LABELS, type PriceProvider } from "@hamac/core";
import type { MarketSettings, ProcInput } from "@hamac/api";
import { Checkbox, Field, TextInput } from "./form";
import { EmptyRow, Table, Td, Th, Tr } from "./table";
import { Badge, Button, Card, CardTitle } from "./ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/transport";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

const KEY = ["market.settings"] as const;

const DESCRIPTIONS: Partial<Record<PriceProvider, string>> = {
  justetf: "ETF en euros, par ISIN. Sans clé.",
  euronext: "Actions et ETF cotés en euros (Paris, Bruxelles, Lisbonne, Dublin, Milan), par ISIN. Sans clé, site public non documenté.",
  twelvedata: "Par symbole, avec votre clé. L'offre gratuite ne couvre que le marché américain.",
  yahoo: "Dernier recours, par symbole. Non officiel : l'accès peut être refusé selon le réseau.",
  coingecko: "Cryptomonnaies. Sans clé.",
};

const dateTime = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Paramètres › Cours : ordre des sources, clé Twelve Data et état de chaque titre. */
export function MarketSources() {
  const qc = useQueryClient();
  const toast = useToast();
  const idx = useWorkspaceIndex();
  const refresh = useMutate("prices.refresh");
  const { data } = useQuery({ queryKey: KEY, queryFn: () => call("market.settings") });
  const configure = useMutation({
    mutationFn: (input: ProcInput<"market.configure">) => call("market.configure", input),
    onSuccess: (s: MarketSettings) => qc.setQueryData(KEY, s),
    onError: (e: Error) => toast("error", e.message),
  });
  const [key, setKey] = useState("");

  if (!data || !idx) return null;
  const status = idx.ws.priceStatus;
  const td = data.twelveData;
  const move = (i: number, delta: number) => {
    const order = [...data.order];
    const [item] = order.splice(i, 1);
    order.splice(i + delta, 0, item!);
    configure.mutate({ order });
  };
  const toggle = (i: number, enabled: boolean) => configure.mutate({ order: data.order.map((o, j) => (j === i ? { ...o, enabled } : o)) });
  const saveKey = () => configure.mutate({ twelveDataKey: key.trim() }, { onSuccess: () => { setKey(""); toast("success", "Clé enregistrée"); } });

  return (
    <div className="space-y-5 pb-20">
      <Card>
        <CardTitle hint="pour chaque titre, la première source qui répond">Ordre des sources</CardTitle>
        <ol className="divide-y divide-line">
          {data.order.map((o, i) => (
            <li key={o.id} className="flex items-center gap-4 py-2.5">
              <span className="num w-5 text-center text-sm text-fg-faint">{i + 1}</span>
              <div className={cn("min-w-0 flex-1", !o.enabled && "opacity-50")}>
                <div className="text-sm font-medium">{PRICE_PROVIDER_LABELS[o.id]}</div>
                <div className="text-xs text-fg-muted">{DESCRIPTIONS[o.id]}</div>
              </div>
              <Checkbox checked={o.enabled} onChange={(v) => toggle(i, v)} label="Active" />
              <div className="flex gap-1">
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={i === 0 || configure.isPending} onClick={() => move(i, -1)} aria-label={`Monter ${PRICE_PROVIDER_LABELS[o.id]}`}>
                  <ArrowUp size={15} />
                </Button>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={i === data.order.length - 1 || configure.isPending} onClick={() => move(i, 1)} aria-label={`Descendre ${PRICE_PROVIDER_LABELS[o.id]}`}>
                  <ArrowDown size={15} />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-fg-faint">Un titre peut imposer sa propre source, ou une adresse personnalisée, depuis sa fiche (Paramètres › Titres).</p>
      </Card>

      <Card>
        <CardTitle hint={<a href="https://twelvedata.com/pricing" target="_blank" rel="noreferrer" className="text-accent hover:underline">twelvedata.com</a>}>Clé Twelve Data (facultative)</CardTitle>
        {td.configured ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-fg-muted">
              Clé enregistrée, se terminant par <span className="num text-fg">{td.hint}</span>.
            </p>
            <Button variant="ghost" onClick={() => configure.mutate({ twelveDataKey: null })}>
              Supprimer la clé
            </Button>
          </div>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Clé d'API">{(id) => <TextInput id={id} type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="font-mono" />}</Field>
            <Button disabled={key.trim().length < 8 || configure.isPending} onClick={saveKey}>
              Enregistrer
            </Button>
          </div>
        )}
        {td.configured && (
          <p className="mt-3 text-sm text-fg-muted">
            {td.assets > 0 ? (
              <>
                {td.assets} titre{td.assets > 1 ? "s" : ""} peu{td.assets > 1 ? "vent" : "t"} passer par Twelve Data : actualisation toutes les <b className="text-fg">{td.intervalMinutes} min</b>, soit{" "}
                <b className="text-fg">{Math.floor(1440 / td.intervalMinutes) * td.assets}</b> requêtes par jour au plus, même allumé en continu.
              </>
            ) : (
              "Aucun titre ne passe par Twelve Data pour l'instant : il lui faut un symbole."
            )}{" "}
            Utilisées aujourd'hui : <span className="num text-fg">{td.used}</span> / {td.limit}.
          </p>
        )}
        <p className="mt-3 text-xs text-fg-faint">
          La clé reste dans cette installation : elle n'est ni affichée en entier, ni incluse dans les sauvegardes. L'offre gratuite ne couvre que les titres américains ; les cotations européennes demandent une offre payante.
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-sm font-medium text-fg-muted">État des cours</h2>
            {status && <p className="mt-1 text-xs text-fg-faint">Dernière actualisation : {dateTime.format(new Date(status.at))}{status.nextAt ? ` · prochaine : ${dateTime.format(new Date(status.nextAt))}` : ""}</p>}
          </div>
          <Button disabled={refresh.isPending} onClick={() => refresh.mutate(undefined as never)}>
            <RefreshCw size={14} className={cn(refresh.isPending && "animate-spin")} /> Actualiser
          </Button>
        </div>
        <Table className="rounded-none border-x-0 border-b-0">
          <thead>
            <tr>
              <Th className="pl-5">Titre</Th>
              <Th>Source</Th>
              <Th>Dernier cours</Th>
              <Th className="pr-5">Détail</Th>
            </tr>
          </thead>
          <tbody>
            {!status?.assets?.length && <EmptyRow cols={4}>Le détail apparaîtra après la prochaine actualisation.</EmptyRow>}
            {status?.assets?.map((a) => (
              <Tr key={a.assetId}>
                <Td className="pl-5">{a.name}</Td>
                <Td>{a.provider ? <Badge tone="positive">{PRICE_PROVIDER_LABELS[a.provider]}</Badge> : <Badge tone="negative">Aucune</Badge>}</Td>
                <Td className="whitespace-nowrap text-fg-muted">{formatDate(a.lastDate)}</Td>
                <Td className="pr-5 text-xs text-fg-muted">
                  {a.message && <div>{a.message}</div>}
                  {a.tried.map((x) => (
                    <div key={x.provider}>
                      {PRICE_PROVIDER_LABELS[x.provider]} : {x.message}
                    </div>
                  ))}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
