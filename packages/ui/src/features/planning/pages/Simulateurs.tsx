import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Copy, Pencil, Plus, SlidersHorizontal, Trash2, Undo2 } from "lucide-react";
import { formatDate, todayIso } from "@/shared/lib/numbers";
import { Amount } from "@/shared/components/Amount";
import { Checkbox, Field, MoneyInput, NumberInput, Select, TextInput } from "@/shared/components/form";
import { SimForm } from "@/features/planning/components/SimForms";
import { Notice, Pct } from "@/shared/components/Stat";
import { ExpandButton, DetailRow, Table, Td, Th, Tr, useExpandedRow } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";
import { useEngineData } from "@/shared/lib/portfolio";
import {
  decodeState,
  encodeState,
  linesByYear,
  MAX_HORIZON,
  newSim,
  REGIME_LABELS,
  runSim,
  SIM_KIND_LABELS,
  SIM_KINDS,
  taxContext,
  TMI_VALUES,
  type RegimeChoice,
  type SimConfig,
  type SimOutcome,
  type SimState,
} from "@/features/planning/lib/simulateurs";
import type { SimResult } from "@hamac/core";

const pctLabel = (v: number) => `${Math.round(v * 100)} %`;
/** Impôt payé, affiché en négatif ; zéro reste zéro (pas de « -0,00 € »). Un remboursement d'impôt devient positif. */
const paid = (v: number) => (Math.abs(v) < 0.005 ? 0 : -v);

/**
 * Simulateurs : rendement brut et net d'impôts d'un placement, avant d'investir, et comparaison côte à côte.
 * Rien n'est enregistré : l'adresse de la page garde les simulations.
 */
export function Simulateurs() {
  const data = useEngineData();
  const [search, setSearch] = useSearchParams();
  const today = todayIso();
  const encoded = search.get("s");
  // L'état vit ici, mis à jour à chaque frappe ; l'adresse n'en est que la copie. Lue seule, l'adresse se met à jour
  // après la frappe : React remettrait l'ancienne valeur dans le champ (dates et nom perdaient des caractères).
  const [state, setState] = useState(() => decodeState(encoded, today));
  const written = useRef(encoded);
  useEffect(() => {
    // L'adresse a changé de l'extérieur (retour arrière, lien ouvert) : on la relit.
    if (encoded === written.current) return;
    written.current = encoded;
    setState(decodeState(encoded, today));
  }, [encoded, today]);
  const update = (next: SimState) => {
    setState(next);
    const value = encodeState(next);
    written.current = value;
    setSearch({ s: value }, { replace: true });
  };

  const params = data?.params ?? null;
  const tax = useMemo(() => (params ? taxContext(state, params) : null), [state, params]);
  const horizon = state.horizon != null ? { years: state.horizon, reinvestPct: state.reinvestPct } : null;
  const outcomes = useMemo(
    () => (tax ? state.sims.map((s) => runSim(s, state.amount, state.regime, tax, state.horizon != null ? { years: state.horizon, reinvestPct: state.reinvestPct } : null)) : []),
    [state, tax],
  );
  // Dernière simulation supprimée, pour pouvoir revenir en arrière.
  const [removed, setRemoved] = useState<{ sim: SimConfig; index: number } | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  const nameId = useRef("");

  if (!params || !tax) return null;
  const selectedIndex = state.sims.findIndex((s) => s.id === state.selected);
  const selected = selectedIndex >= 0 ? state.sims[selectedIndex]! : null;
  const outcome = selectedIndex >= 0 ? (outcomes[selectedIndex] ?? null) : null;

  const setSim = (sim: SimConfig) => update({ ...state, sims: state.sims.map((s) => (s.id === sim.id ? sim : s)) });
  const add = (kind: SimConfig["kind"]) => {
    const sim = newSim(kind, today, state.sims);
    setRemoved(null);
    update({ ...state, sims: [...state.sims, sim], selected: sim.id });
  };
  const duplicate = (sim: SimConfig) => {
    const copy = { ...newSim(sim.kind, today, state.sims), input: sim.input, name: `${sim.name} (copie)` } as SimConfig;
    setRemoved(null);
    update({ ...state, sims: [...state.sims, copy], selected: copy.id });
  };
  const remove = (sim: SimConfig) => {
    const index = state.sims.findIndex((s) => s.id === sim.id);
    const sims = state.sims.filter((s) => s.id !== sim.id);
    setRemoved({ sim, index });
    update({ ...state, sims, selected: state.selected === sim.id ? (sims[Math.max(0, index - 1)]?.id ?? "") : state.selected });
  };
  const undo = () => {
    if (!removed) return;
    const sims = [...state.sims];
    sims.splice(Math.min(removed.index, sims.length), 0, removed.sim);
    setRemoved(null);
    update({ ...state, sims, selected: removed.sim.id });
  };
  /** Ouvre une simulation dans le formulaire, et y descend ; `rename` place le curseur dans son nom. */
  const open = (id: string, rename = false) => {
    update({ ...state, selected: id });
    requestAnimationFrame(() => {
      editor.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      if (rename) (document.getElementById(nameId.current) as HTMLInputElement | null)?.select();
    });
  };

  return (
    <>
      <PageHeader
        title="Simulateurs"
        description="Ce qu'un placement rapporterait, avant et après impôts, avant d'investir. Les règles fiscales appliquées sont citées sous chaque résultat. Rien n'est enregistré : l'adresse de la page garde vos simulations, mettez-la en favori pour y revenir."
      />

      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Montant investi" help="Le même pour toutes les simulations, pour les comparer.">
            {(id) => <MoneyInput id={id} value={state.amount} decimals={0} onChange={(v) => v != null && v > 0 && update({ ...state, amount: v })} />}
          </Field>
          <Field label="Durée de comparaison" help={state.horizon == null ? "Chaque placement garde sa propre durée." : "La même pour toutes : chacune s'arrête au même jour."}>
            {(id) => (
              <Select id={id} value={state.horizon == null ? "" : "commune"} onChange={(e) => update({ ...state, horizon: e.target.value ? (state.horizon ?? 5) : null })}>
                <option value="">Celle de chaque placement</option>
                <option value="commune">La même pour toutes</option>
              </Select>
            )}
          </Field>
          {state.horizon != null && (
            <>
              <Field label="Durée commune" help="Obligations revendues à cette date (ou remboursées avant), prêts arrêtés, autres placements gardés jusque-là.">
                {(id) => <NumberInput id={id} value={state.horizon} decimals={0} suffix="ans" onChange={(v) => v != null && v >= 1 && update({ ...state, horizon: Math.min(MAX_HORIZON, Math.round(v)) })} />}
              </Field>
              <Field label="Taux de réinvestissement" help="Net, par an : ce que rapporte l'argent reçu avant la fin (coupons, remboursements). Livret A par défaut.">
                {(id) => <NumberInput id={id} value={state.reinvestPct} decimals={2} suffix="%" onChange={(v) => v != null && update({ ...state, reinvestPct: Math.min(20, v) })} />}
              </Field>
            </>
          )}
          <Field label="Imposition des revenus" help="Le prélèvement forfaitaire ou le barème, sur les revenus qui peuvent y aller.">
            {(id) => (
              <Select id={id} value={state.regime} onChange={(e) => update({ ...state, regime: e.target.value as RegimeChoice })}>
                {(Object.keys(REGIME_LABELS) as RegimeChoice[]).map((r) => (
                  <option key={r} value={r}>
                    {REGIME_LABELS[r]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tranche d'imposition (TMI)" help="Pour le barème.">
            {(id) => (
              <Select id={id} value={state.tmi ?? ""} onChange={(e) => update({ ...state, tmi: e.target.value === "" ? null : (+e.target.value as SimState["tmi"]) })}>
                <option value="">Celle des paramètres ({pctLabel(params.tax.tmi)})</option>
                {TMI_VALUES.map((t) => (
                  <option key={t} value={t}>
                    {pctLabel(t)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox checked={tax.couple} onChange={(v) => update({ ...state, couple: v })} label="Couple (imposition commune)" />
          </div>
        </div>
      </Card>

      <Comparator
        state={state}
        outcomes={outcomes}
        horizon={state.horizon}
        removed={removed?.sim.name ?? null}
        onUndo={undo}
        onOpen={open}
        onDuplicate={duplicate}
        onRemove={remove}
        onAdd={add}
      />

      {selected && (
        <div ref={editor} className="mt-5 scroll-mt-4">
        <Card>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <Field label={`Nom de la simulation (${SIM_KIND_LABELS[selected.kind]})`} className="w-full max-w-sm">
              {(id) => {
                nameId.current = id;
                return <TextInput id={id} value={selected.name} maxLength={60} onChange={(e) => setSim({ ...selected, name: e.target.value })} />;
              }}
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => duplicate(selected)} title="Dupliquer pour changer un seul réglage et comparer">
                <Copy size={15} /> Dupliquer
              </Button>
              <Button variant="ghost" onClick={() => remove(selected)}>
                <Trash2 size={15} /> Supprimer
              </Button>
            </div>
          </div>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="self-start">
              <SimForm sim={selected} onChange={setSim} horizon={horizon?.years ?? null} />
            </div>
            {outcome ? <ResultPanel outcome={outcome} tmi={tax.tmi} /> : <Notice tone="warning">Ces données ne permettent pas de calcul : vérifiez les dates (l'échéance doit suivre l'achat) et les montants.</Notice>}
          </div>
        </Card>
        </div>
      )}

      {outcome && <YearTable result={outcome.shown} />}
    </>
  );
}

// ——— Comparateur ———

const ROWS: Array<{ label: string; render: (r: SimResult, o: SimOutcome) => React.ReactNode; strong?: boolean }> = [
  { label: "Rendement brut par an", render: (r) => <Pct value={r.grossRate} digits={2} /> },
  { label: "Rendement net d'impôts par an", render: (r) => <Pct value={r.netRate} digits={2} />, strong: true },
  { label: "Gain avant impôts", render: (r) => <Amount value={r.grossGain} signed /> },
  { label: "Impôt sur le revenu", render: (r) => <Amount value={paid(r.incomeTax)} /> },
  { label: "Prélèvements sociaux", render: (r) => <Amount value={paid(r.social)} /> },
  { label: "Gain net", render: (r) => <Amount value={r.netGain} signed />, strong: true },
  { label: "Valeur nette à la fin", render: (r) => <Amount value={r.invested + r.netGain} /> },
  { label: "Durée", render: (r) => `${r.years.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} an${r.years >= 2 ? "s" : ""}` },
  { label: "Imposition retenue", render: (_r, o) => (o.shownRegime === "bareme" ? "Barème" : o.comparison.pfu.baremeEligible ? "Prélèvement forfaitaire" : "—") },
];

const iconButton = "rounded-md p-1 text-fg-faint transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent";

function Comparator({
  state,
  outcomes,
  horizon,
  removed,
  onUndo,
  onOpen,
  onDuplicate,
  onRemove,
  onAdd,
}: {
  state: SimState;
  outcomes: ReadonlyArray<SimOutcome | null>;
  horizon: number | null;
  removed: string | null;
  onUndo: () => void;
  onOpen: (id: string, rename?: boolean) => void;
  onDuplicate: (s: SimConfig) => void;
  onRemove: (s: SimConfig) => void;
  onAdd: (k: SimConfig["kind"]) => void;
}) {
  const best = outcomes.reduce<number | null>((b, o) => (o?.shown.netRate != null && (b == null || o.shown.netRate > b) ? o.shown.netRate : b), null);
  return (
    <Card>
      <CardTitle hint={horizon != null ? `toutes sur ${horizon} an${horizon > 1 ? "s" : ""}, jusqu'au même jour` : "cliquez sur une colonne pour la modifier"}>Comparer</CardTitle>
      {removed && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span>« {removed} » supprimée.</span>
          <Button variant="ghost" className="h-7 px-2" onClick={onUndo}>
            <Undo2 size={14} /> Annuler
          </Button>
        </div>
      )}
      {state.sims.length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">Aucune simulation : ajoutez un placement ci-dessous.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th />
              {state.sims.map((s) => (
                <Th key={s.id} align="right" className={cn("align-top", s.id === state.selected && "bg-surface-3")}>
                  <button type="button" onClick={() => onOpen(s.id)} className="text-right hover:text-fg" aria-pressed={s.id === state.selected} title="Modifier cette simulation">
                    <span className="block text-fg">{s.name}</span>
                    {s.name !== SIM_KIND_LABELS[s.kind] && <span className="block font-normal text-fg-faint">{SIM_KIND_LABELS[s.kind]}</span>}
                  </button>
                  <span className="mt-1 flex justify-end gap-0.5">
                    <button type="button" className={iconButton} onClick={() => onOpen(s.id)} aria-label={`Modifier « ${s.name} »`} title="Modifier">
                      <SlidersHorizontal size={14} />
                    </button>
                    <button type="button" className={iconButton} onClick={() => onOpen(s.id, true)} aria-label={`Renommer « ${s.name} »`} title="Renommer">
                      <Pencil size={14} />
                    </button>
                    <button type="button" className={iconButton} onClick={() => onDuplicate(s)} aria-label={`Dupliquer « ${s.name} »`} title="Dupliquer" disabled={state.sims.length >= 8}>
                      <Copy size={14} />
                    </button>
                    <button type="button" className={cn(iconButton, "hover:text-negative")} onClick={() => onRemove(s)} aria-label={`Supprimer « ${s.name} »`} title="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <Tr key={row.label}>
                <Td className={cn(row.strong ? "font-semibold" : "text-fg-muted")}>{row.label}</Td>
                {state.sims.map((s, i) => {
                  const o = outcomes[i];
                  const top = row.label.startsWith("Rendement net") && o?.shown.netRate != null && best != null && state.sims.length > 1 && Math.abs(o.shown.netRate - best) < 1e-9;
                  return (
                    <Td key={s.id} align="right" className={cn(row.strong && "font-semibold", s.id === state.selected && "bg-surface-2/60", "cursor-pointer")} onClick={() => onOpen(s.id)}>
                      {o ? row.render(o.shown, o) : <span className="text-fg-faint">—</span>}
                      {top && <span className="ml-2"><Badge tone="positive">meilleur</Badge></span>}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {SIM_KINDS.map((k) => (
          <Button key={k} variant="secondary" onClick={() => onAdd(k)} disabled={state.sims.length >= 8}>
            <Plus size={15} /> {SIM_KIND_LABELS[k]}
          </Button>
        ))}
      </div>
    </Card>
  );
}

// ——— Résultat d'une simulation ———

function ResultPanel({ outcome, tmi }: { outcome: SimOutcome; tmi: number }) {
  const r = outcome.shown;
  const { pfu, bareme } = outcome.comparison;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-line p-4">
          <div className="text-[0.8125rem] font-medium text-fg-muted">Rendement brut</div>
          <div className="num text-2xl font-semibold"><Pct value={r.grossRate} digits={2} /></div>
          <div className="text-xs text-fg-faint">par an, avant impôts</div>
        </div>
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <div className="text-[0.8125rem] font-medium text-fg-muted">Rendement net d'impôts</div>
          <div className="num text-2xl font-semibold text-fg"><Pct value={r.netRate} digits={2} /></div>
          <div className="text-xs text-fg-faint">par an, après impôt et prélèvements sociaux</div>
        </div>
      </div>
      <dl className="space-y-1.5 text-sm">
        <Line label="Montant investi"><Amount value={r.invested} /></Line>
        <Line label="Gain avant impôts"><Amount value={r.grossGain} signed /></Line>
        <Line label="Impôt sur le revenu"><Amount value={paid(r.incomeTax)} /></Line>
        <Line label="Prélèvements sociaux"><Amount value={paid(r.social)} /></Line>
        <Line label="Gain net" strong><Amount value={r.netGain} signed /></Line>
        <Line label="Fin du placement">{formatDate(r.endDate)}</Line>
      </dl>
      {bareme ? (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="mb-2 font-medium text-fg">Prélèvement forfaitaire ou barème ?</div>
          <RegimeLine label="Prélèvement forfaitaire" r={pfu} chosen={outcome.shownRegime === "pfu"} />
          <RegimeLine label={`Barème, tranche à ${pctLabel(tmi)}`} r={bareme} chosen={outcome.shownRegime === "bareme"} />
          <p className="mt-2 text-xs text-fg-faint">Le choix du barème vaut pour tous vos revenus de placement de l'année : il dépend aussi des autres.</p>
        </div>
      ) : null}
      {r.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-fg-muted">
          {r.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="text-xs text-fg-faint">
        <div className="mb-1 font-medium">Sources</div>
        <ul className="space-y-0.5">
          {r.sources.map((s) => (
            <li key={s.label}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Line({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", strong && "border-t border-line pt-1.5 font-semibold")}>
      <dt className={strong ? "text-fg" : "text-fg-muted"}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RegimeLine({ label, r, chosen }: { label: string; r: SimResult; chosen: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-0.5", chosen ? "text-fg" : "text-fg-muted")}>
      <span>
        {label} {chosen && <Badge tone="accent">retenu</Badge>}
      </span>
      <span className="num">
        <Pct value={r.netRate} digits={2} /> net · <Amount value={r.netGain} signed />
      </span>
    </div>
  );
}

// ——— Année par année ———

function YearTable({ result }: { result: SimResult }) {
  const years = linesByYear(result.lines);
  const { isOpen, rowProps } = useExpandedRow();
  return (
    <Card className="mt-5">
      <CardTitle hint="cliquez sur une année pour le détail">Année par année</CardTitle>
      <Table>
        <thead>
          <tr>
            <Th>Année</Th>
            <Th align="right">Argent reçu ou versé</Th>
            <Th align="right">Impôt sur le revenu</Th>
            <Th align="right">Prélèvements sociaux</Th>
            <Th align="right">Net</Th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <Fragment key={y.year}>
              <Tr {...rowProps(y.year)}>
                <Td className="font-medium">
                  <ExpandButton open={isOpen(y.year)} label={`Détail de ${y.year}`} /> {y.year}
                </Td>
                <Td align="right"><Amount value={y.gross} signed /></Td>
                <Td align="right"><Amount value={paid(y.incomeTax)} /></Td>
                <Td align="right"><Amount value={paid(y.social)} /></Td>
                <Td align="right" className="font-medium"><Amount value={y.net} signed /></Td>
              </Tr>
              {isOpen(y.year) && (
                <DetailRow cols={5}>
                  <ul className="space-y-1.5 text-sm">
                    {y.lines.map((l, k) => (
                      <li key={k} className={cn("grid grid-cols-[6rem_minmax(0,1fr)_auto] gap-3", l.kept && "text-fg-muted")}>
                        <span className="text-xs text-fg-faint num">{formatDate(l.date)}</span>
                        <span>
                          {l.label}
                          {l.note && <span className="block text-xs text-fg-faint">{l.note}</span>}
                        </span>
                        <span className="num text-right text-xs">
                          <Amount value={l.gross} signed />
                          {(l.incomeTax !== 0 || l.social !== 0) && (
                            <span className="block text-fg-faint">
                              impôt <Amount value={paid(l.incomeTax)} /> · prélèvements <Amount value={paid(l.social)} />
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </DetailRow>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-fg-faint">Les intérêts qui restent placés (fonds euros, livret) ne sont pas de l'argent reçu : ils comptent pour l'impôt de l'année, et le retrait final les comprend.</p>
    </Card>
  );
}
