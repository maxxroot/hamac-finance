import { RotateCcw, Trash2 } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { BUCKET_LABELS, formatEur, retirementYear, type Flows, type PlanParams, type ProjectionRow } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Chart, axisStyle, type ChartOption } from "@/components/Chart";
import { Field, MoneyInput, NumberInput, PercentInput, TextInput } from "@/components/form";
import { Notice, Pct } from "@/components/Stat";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { BUCKET_COLORS, INK } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { useProjection } from "@/lib/projection";
import { useMutate } from "@/lib/workspace";

const eurAxis = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`);

export function Projection() {
  const [scenario, setScenario] = useState<{ params: PlanParams; extraMonthly: Partial<Flows> } | null>(null);
  const proj = useProjection(scenario);
  const [showTable, setShowTable] = useState(false);

  const chart = useMemo<ChartOption | null>(() => {
    if (!proj) return null;
    const { base, bands, alt } = proj;
    const years = base.rows.map((r) => String(r.year));
    const stack = (name: string, color: string, values: number[]) => ({ name, type: "bar", stack: "plan", barMaxWidth: 18, itemStyle: { color, borderColor: INK.surface, borderWidth: 1 }, emphasis: { focus: "series" }, data: values.map((v) => Math.round(v)) });
    const series: object[] = [
      stack(BUCKET_LABELS.precaution, BUCKET_COLORS.precaution, base.rows.map((r) => r.livrets)),
      stack(BUCKET_LABELS.garanti, BUCKET_COLORS.garanti, base.rows.map((r) => r.fondsEuros)),
      stack(BUCKET_LABELS.obligations, BUCKET_COLORS.obligations, base.rows.map((r) => r.obligations)),
      stack(BUCKET_LABELS.croissance, BUCKET_COLORS.croissance, base.rows.map((r) => r.actions)),
      { name: "Fourchette basse (1 chance sur 10)", type: "line", data: bands.map((b) => Math.round(b.p10)), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, type: "dotted", color: INK.muted }, itemStyle: { color: INK.muted } },
      { name: "Fourchette haute (1 chance sur 10)", type: "line", data: bands.map((b) => Math.round(b.p90)), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, type: "dotted", color: INK.fg }, itemStyle: { color: INK.fg } },
    ];
    if (alt) series.push({ name: "Scénario", type: "line", data: base.rows.map((r) => Math.round(alt.rows.find((x) => x.year === r.year)?.total ?? NaN)), showSymbol: false, symbolSize: 8, lineStyle: { width: 2, color: INK.accent }, itemStyle: { color: INK.accent } });
    return {
      tooltip: { trigger: "axis", backgroundColor: INK.surface2, borderColor: INK.line, textStyle: { color: INK.fg }, valueFormatter: (v: unknown) => formatEur(Number(v), { compact: true }) },
      xAxis: { type: "category", data: years, ...axisStyle, splitLine: { show: false } },
      yAxis: { type: "value", ...axisStyle, axisLabel: { color: INK.faint, formatter: eurAxis } },
      legend: { bottom: 0, icon: "roundRect", itemWidth: 12, itemHeight: 4, textStyle: { color: INK.muted } },
      grid: { left: 8, right: 24, top: 16, bottom: 64, containLabel: true },
      series,
    };
  }, [proj]);

  if (!proj) return null;
  if (proj.pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { base, alt, bands, pf } = proj;
  const p = pf.data.params;
  const at = base.atRetirement;
  const band = bands.find((b) => b.year === at.year);

  return (
    <>
      <PageHeader
        title="Projection"
        description={`Jusqu'au départ en ${retirementYear(p)}, à partir du patrimoine actuel et de tous les versements programmés. Avant impôts, hors crypto.`}
        actions={<Button onClick={() => setShowTable((v) => !v)}>{showTable ? "Masquer le tableau" : "Voir le tableau"}</Button>}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Result label={`Patrimoine en ${at.year}`} value={at.total} alt={alt?.atRetirement.total} sub={<>soit <Amount value={at.real} compact /> d'aujourd'hui</>} />
        <Result label="Fourchette (8 chances sur 10)" value={null} sub="selon les marchés actions">
          <span className="text-base">
            <Amount value={band?.p10} compact /> – <Amount value={band?.p90} compact />
          </span>
        </Result>
        <Result
          label="Argent versé d'ici là"
          value={at.contributed}
          alt={alt?.atRetirement.contributed}
          sub={
            <>
              gains <Amount value={at.gains} compact /> · frais estimés <Amount value={at.fees} compact />
            </>
          }
        />
        <Result
          label={`Revenu mensuel possible de ${p.profile.retirementAge} à ${p.profile.horizonAge} ans`}
          value={base.income.monthlyToday}
          alt={alt?.income.monthlyToday}
          sub={<>en euros d'aujourd'hui · <Amount value={base.income.monthlyNominal} compact /> en {at.year}</>}
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle hint="euros courants">Projection par classe d'actifs</CardTitle>
          {chart && <Chart option={chart} height={360} />}
        </Card>
        <Simulator params={p} onChange={setScenario} active={!!scenario} />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Expenses />
        <Card>
          <CardTitle hint={`revenu revalorisé de ${Math.round(p.returns.inflation * 1000) / 10} % par an`}>Après le départ : le capital investi pendant les retraits</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Année</Th>
                <Th align="right">Âge</Th>
                <Th align="right">Retiré dans l'année</Th>
                <Th align="right">Capital restant</Th>
              </tr>
            </thead>
            <tbody>
              {base.drawdown.filter((_, i) => i % 5 === 4 || i === 0).map((d) => (
                <Tr key={d.year}>
                  <Td>{d.year}</Td>
                  <Td align="right">{d.age} ans</Td>
                  <Td align="right">
                    <Amount value={d.withdrawn} compact />
                  </Td>
                  <Td align="right">
                    <Amount value={d.capital} compact />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {showTable && <ProjectionTable rows={base.rows} highlightYear={at.year} />}
      <div className="mt-4">
        <Notice>
          Modèle annuel simplifié : les versements de l'année s'ajoutent en fin d'année ; après l'âge de sécurisation, les versements actions vont au fonds euros et la part actions est ramenée à sa cible ; les livrets
          sont plafonnés (l'excédent part au fonds euros) et le plancher est préservé. Les frais des établissements sont déduits : frais sur versements et courtage des achats mensuels, frais de gestion du fonds euros et droits de garde. La fourchette rejoue 300 fois la projection avec des marchés actions aléatoires (volatilité 16 %/an). Rien n'est garanti hors livrets,
          fonds euros et obligations gardées jusqu'à l'échéance.
        </Notice>
      </div>
    </>
  );
}

/** Tableau année par année : mémorisé, il ne se redessine pas pendant la saisie d'un scénario. */
const ProjectionTable = memo(function ProjectionTable({ rows, highlightYear }: { rows: ProjectionRow[]; highlightYear: number }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Année</Th>
          <Th align="right">Âge</Th>
          <Th align="right">Part actions cible</Th>
          <Th align="right">Dépense</Th>
          <Th align="right">Livrets</Th>
          <Th align="right">Fonds euros</Th>
          <Th align="right">Obligations</Th>
          <Th align="right">Actions</Th>
          <Th align="right">Patrimoine</Th>
          <Th align="right">€ d'aujourd'hui</Th>
          <Th align="right">Versé cumulé</Th>
          <Th align="right">Gains</Th>
          <Th align="right">Frais cumulés</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.year} className={cn(r.year === highlightYear && "bg-accent/10 font-medium")}>
            <Td>{r.year}</Td>
            <Td align="right">{r.age}</Td>
            <Td align="right">
              <Pct value={r.etfTarget} />
            </Td>
            <Td align="right">{r.expense ? <Amount value={r.expense} compact /> : ""}</Td>
            <Td align="right" className={cn(r.belowFloor && "text-warning")}>
              <Amount value={r.livrets} compact />
            </Td>
            <Td align="right">
              <Amount value={r.fondsEuros} compact />
            </Td>
            <Td align="right">
              <Amount value={r.obligations} compact />
            </Td>
            <Td align="right">
              <Amount value={r.actions} compact />
            </Td>
            <Td align="right" className="font-medium">
              <Amount value={r.total} compact />
            </Td>
            <Td align="right">
              <Amount value={r.real} compact />
            </Td>
            <Td align="right">
              <Amount value={r.contributed} compact />
            </Td>
            <Td align="right">
              <Amount value={r.gains} compact />
            </Td>
            <Td align="right" className="text-fg-muted">
              <Amount value={r.fees} compact />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
});

function Result({ label, value, alt, sub, children }: { label: string; value: number | null; alt?: number; sub?: React.ReactNode; children?: React.ReactNode }) {
  const delta = alt != null && value != null ? alt - value : null;
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-xl font-semibold tracking-tight">{children ?? <Amount value={value} compact />}</span>
      {delta != null && Math.abs(delta) >= 1 && (
        <span className="text-xs">
          <Badge tone="accent">Scénario</Badge> <Amount value={alt} compact /> (<Amount value={delta} signed compact />)
        </span>
      )}
      {sub && <span className="text-xs text-fg-faint">{sub}</span>}
    </Card>
  );
}

function Simulator({ params, onChange, active }: { params: PlanParams; onChange: (s: { params: PlanParams; extraMonthly: Partial<Flows> } | null) => void; active: boolean }) {
  const [extra, setExtra] = useState<Flows>({ livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 });
  const [retirementAge, setRetirementAge] = useState<number | null>(params.profile.retirementAge);
  const [actions, setActions] = useState<number | null>(params.returns.actions);
  const [inflation, setInflation] = useState<number | null>(params.returns.inflation);

  const apply = (next: { extra?: Flows; retirementAge?: number | null; actions?: number | null; inflation?: number | null }) => {
    const e = next.extra ?? extra;
    const ra = next.retirementAge !== undefined ? next.retirementAge : retirementAge;
    const ac = next.actions !== undefined ? next.actions : actions;
    const inf = next.inflation !== undefined ? next.inflation : inflation;
    const p: PlanParams = {
      ...params,
      profile: { ...params.profile, retirementAge: ra ?? params.profile.retirementAge, securisationAge: Math.min(params.profile.securisationAge, ra ?? params.profile.retirementAge) },
      returns: { ...params.returns, actions: ac ?? params.returns.actions, inflation: inf ?? params.returns.inflation },
    };
    const changed = JSON.stringify(p) !== JSON.stringify(params) || Object.values(e).some((v) => v !== 0);
    onChange(changed ? { params: p, extraMonthly: e } : null);
  };
  const reset = () => {
    setExtra({ livrets: 0, fondsEuros: 0, obligations: 0, actions: 0 });
    setRetirementAge(params.profile.retirementAge);
    setActions(params.returns.actions);
    setInflation(params.returns.inflation);
    onChange(null);
  };

  return (
    <Card>
      <CardTitle hint={active ? <Badge tone="accent">scénario actif</Badge> : "ne modifie pas le plan"}>Et si…</CardTitle>
      <p className="mb-3 text-xs text-fg-faint">Versement mensuel en plus, par classe d'actifs :</p>
      <div className="grid grid-cols-2 gap-3">
        {(["actions", "obligations", "fondsEuros", "livrets"] as const).map((k) => (
          <Field key={k} label={{ actions: "Actions", obligations: "Obligations", fondsEuros: "Fonds euros", livrets: "Livrets" }[k]}>
            {(id) => (
              <MoneyInput
                id={id}
                value={extra[k] || null}
                onChange={(v) => {
                  const e = { ...extra, [k]: v ?? 0 };
                  setExtra(e);
                  apply({ extra: e });
                }}
              />
            )}
          </Field>
        ))}
        <Field label="Âge de départ">
          {(id) => (
            <NumberInput
              id={id}
              decimals={0}
              grouping={false}
              value={retirementAge}
              onChange={(v) => {
                setRetirementAge(v);
                if (v != null && v >= 50 && v <= 75) apply({ retirementAge: v });
              }}
            />
          )}
        </Field>
        <Field label="Rendement actions">
          {(id) => (
            <PercentInput
              id={id}
              value={actions}
              onChange={(v) => {
                setActions(v);
                apply({ actions: v });
              }}
            />
          )}
        </Field>
        <Field label="Inflation">
          {(id) => (
            <PercentInput
              id={id}
              value={inflation}
              onChange={(v) => {
                setInflation(v);
                apply({ inflation: v });
              }}
            />
          )}
        </Field>
      </div>
      <Button variant="ghost" className="mt-4 w-full" onClick={reset} disabled={!active}>
        <RotateCcw size={14} /> Revenir au plan
      </Button>
    </Card>
  );
}

function Expenses() {
  const proj = useProjection(null);
  const add = useMutate("plannedExpenses.upsert", { success: "Dépense prévue ajoutée" });
  const del = useMutate("plannedExpenses.delete");
  const [label, setLabel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const expenses = proj?.pf.idx.ws.plannedExpenses ?? [];
  return (
    <Card>
      <CardTitle hint="payées par les livrets">Grosses dépenses prévues</CardTitle>
      {expenses.length > 0 && (
        <ul className="mb-4 space-y-1.5 text-sm">
          {expenses.map((e) => (
            <li key={e.id} className="group flex items-center justify-between gap-3">
              <span>
                <span className="text-fg-muted">{e.year}</span> · {e.label}
              </span>
              <span className="flex items-center gap-2">
                <Amount value={-e.amount} />
                <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => del.mutate({ id: e.id })} aria-label="Supprimer">
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <Field label="Quoi">{(id) => <TextInput id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Voiture, travaux…" />}</Field>
        <Field label="Année">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={year} onChange={setYear} />}</Field>
        <Field label="Montant">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
        <Button disabled={!label.trim() || !year || !amount} onClick={() => year && amount && add.mutate({ label, year, amount }, { onSuccess: () => (setLabel(""), setYear(null), setAmount(null)) })}>
          Ajouter
        </Button>
      </div>
    </Card>
  );
}
