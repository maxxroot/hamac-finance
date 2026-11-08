import { Archive, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DataDump } from "@hamac/api";
import { Modal } from "@/components/form";
import { downloadText, pickTextFile } from "@/lib/files";
import { call } from "@/lib/transport";
import { useToast } from "@/lib/toast";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { MarketSources } from "@/components/MarketSources";
import { RowActions } from "@/components/RowActions";
import {
  ACCOUNT_KIND_LABELS,
  ASSET_BUCKET,
  ASSET_KIND_LABELS,
  BUCKET_LABELS,
  MODULES,
  MODULE_LABELS,
  PlanParams,
  classTargets,
  etfTarget,
  formatPct,
  incomeTaxRate,
  retirementYear,
  ruleName,
  targetLabel,
  taxRegimeLabel,
  type Account,
  type AllocationRule,
  type AssetClass,
  type Asset,
} from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { AccountDialog } from "@/dialogs/AccountDialog";
import { AllocationDialog } from "@/dialogs/AllocationDialog";
import { AssetDialog } from "@/dialogs/AssetDialog";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { useSystemInfo } from "@/lib/queries";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { usePortfolio } from "@/lib/portfolio";
import { SortTh, useSortable } from "@/lib/sort";
import { SETTINGS_ITEM } from "@/nav";

const TABS = ["Plan", "Comptes", "Actifs", "Cours", "Application"] as const;
type Tab = (typeof TABS)[number];

export function Parametres() {
  const [search] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => TABS.find((t) => t === search.get("onglet")) ?? "Plan");
  return (
    <>
      <PageHeader title="Paramètres" description={SETTINGS_ITEM.description} />
      <div className="mb-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors", tab === t ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Plan" && <PlanTab />}
      {tab === "Comptes" && <AccountsTab />}
      {tab === "Actifs" && <AssetsTab />}
      {tab === "Cours" && <MarketSources />}
      {tab === "Application" && <AppTab />}
    </>
  );
}

// ——— Plan ———

type Path = [keyof PlanParams, string];

function PlanTab() {
  const idx = useWorkspaceIndex();
  const pf = usePortfolio();
  const save = useMutate("params.update", { success: "Paramètres enregistrés" });
  const [p, setP] = useState<PlanParams | null>(null);
  useEffect(() => {
    if (idx && !p) setP(idx.ws.params);
  }, [idx, p]);

  const issues = useMemo(() => {
    if (!p) return new Map<string, string>();
    const r = PlanParams.safeParse(p);
    return new Map(r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]));
  }, [p]);

  if (!p || !idx) return null;
  // Taux moyen des livrets, pondéré par leur solde : repère pour l'hypothèse de rendement.
  const livrets = pf?.state.accounts.filter((a) => a.account.kind === "livret" && a.value > 0) ?? [];
  const livretTotal = livrets.reduce((t, a) => t + a.value, 0);
  const livretRate = livretTotal > 0 ? livrets.reduce((t, a) => t + a.value * (a.account.rate ?? 0), 0) / livretTotal : null;
  const dirty = JSON.stringify(p) !== JSON.stringify(idx.ws.params);
  const set = (path: Path, value: unknown) => setP((x) => (x ? { ...x, [path[0]]: { ...(x[path[0]] as object), [path[1]]: value } } : x));
  const err = (path: Path) => issues.get(path.join(".")) ?? null;
  const year = new Date().getFullYear();
  const age = year - p.profile.birthYear;
  const retraite = p.profile.goal === "retraite";

  const pctField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <PercentInput id={id} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v ?? 0)} />}
    </Field>
  );
  const eurField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <MoneyInput id={id} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v ?? 0)} />}
    </Field>
  );
  const intField = (label: string, path: Path, help?: ReactNode) => (
    <Field label={label} help={help} error={err(path)}>
      {(id) => <NumberInput id={id} decimals={0} grouping={false} value={(p[path[0]] as Record<string, number>)[path[1]]} onChange={(v) => set(path, v == null ? 0 : Math.round(v))} />}
    </Field>
  );

  return (
    <div className="space-y-5 pb-20">
      <Section title="Usage" hint="Ce que Hamac doit faire pour vous. Vous pouvez changer à tout moment : vos données ne bougent pas.">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
          {(
            [
              ["retraite", "Préparer ma retraite", "Projection jusqu'au départ, revenu mensuel possible, part actions qui baisse à l'approche de la retraite."],
              ["patrimoine", "Gérer mon patrimoine", "Suivi, allocation cible fixe, versements et alertes, sans projection de retraite."],
            ] as const
          ).map(([goal, label, text]) => (
            <button
              key={goal}
              type="button"
              role="radio"
              aria-checked={p.profile.goal === goal}
              onClick={() => set(["profile", "goal"], goal)}
              className={cn(
                "rounded-lg border px-4 py-3 text-left transition-colors",
                p.profile.goal === goal ? "border-accent bg-accent/10" : "border-line hover:border-fg-faint hover:bg-surface-2",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-3.5 rounded-full border-2", p.profile.goal === goal ? "border-accent bg-accent" : "border-fg-faint")} />
                {label}
              </div>
              <p className="mt-1 pl-5.5 text-xs text-fg-muted">{text}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Modules" hint="Les pages affichées dans le menu. Masquer un module ne supprime rien et ne change aucun calcul.">
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-3">
          {MODULES.map((m) => (
            <Checkbox key={m} checked={p.modules[m]} onChange={(v) => set(["modules", m], v)} label={MODULE_LABELS[m]} />
          ))}
        </div>
      </Section>

      <Section title={retraite ? "Profil et calendrier" : "Profil et versements"}>
        <FormGrid cols={3}>
          {intField("Année de naissance", ["profile", "birthYear"], `Âge cette année : ${age} ans.`)}
          {retraite && intField("Âge de départ visé", ["profile", "retirementAge"], `Départ en ${retirementYear(p)}.`)}
          {retraite && intField("Âge de début de sécurisation", ["profile", "securisationAge"], "À partir de cet âge, la part actions baisse progressivement.")}
          {retraite && intField("Âge horizon (fin des retraits)", ["profile", "horizonAge"], "Sert au calcul du revenu mensuel possible.")}
          <Field label="Premier mois des versements" help="Début du calendrier des versements mensuels." error={err(["profile", "startMonth"])}>
            {(id) => <TextInput id={id} type="month" value={p.profile.startMonth} onChange={(e) => set(["profile", "startMonth"], e.target.value)} />}
          </Field>
          {intField("Jour des versements", ["profile", "contributionDay"], "Jour du mois où les versements programmés sont prélevés (dernier jour du mois s'il est plus court).")}
          <div className="self-end pb-2">
            <Checkbox checked={p.profile.couple} onChange={(v) => set(["profile", "couple"], v)} label="Imposition en couple" />
          </div>
        </FormGrid>
      </Section>

      <Section title="Hypothèses de rendement" hint="Par an, avant impôts. Prudentes et modifiables : rien n'est garanti hors livrets, fonds euros et obligations gardées jusqu'à l'échéance.">
        <FormGrid cols={3}>
          {pctField("Livrets", ["returns", "livrets"], livretRate != null ? `Taux moyen actuel de vos livrets : ${(livretRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %.` : undefined)}
          {pctField("Fonds euros", ["returns", "fondsEuros"], "Bon fonds euros en ligne : 3 à 4 % brut ces dernières années.")}
          {pctField("Obligations (taux moyen de l'échelle)", ["returns", "obligations"])}
          {pctField("Actions (ETF monde)", ["returns", "actions"], "Moyenne de long terme, avec des années à −30 % ou −50 %.")}
          {pctField("Inflation", ["returns", "inflation"])}
          {retraite && pctField("Rendement réel pendant la retraite", ["returns", "realReturnRetirement"], "Rendement après inflation du capital pendant les retraits.")}
        </FormGrid>
      </Section>

      <Section title="Allocation cible de la partie investie" hint="Par défaut hors livrets et crypto. Classes personnalisées et choix par titre : onglet Actifs.">
        <FormGrid cols={3}>
          {pctField(retraite ? "Part actions avant sécurisation" : "Part actions", ["allocation", "etfBefore"])}
          {retraite && pctField("Part actions à l'âge de départ", ["allocation", "etfAtRetirement"], "Baisse linéaire entre l'âge de sécurisation et l'âge de départ.")}
          {pctField("Part obligations", ["allocation", "obligations"])}
        </FormGrid>
        <p className="mt-3 text-sm text-fg-muted">
          Cette année : actions <b className="text-fg">{formatPct(etfTarget(p, age))}</b> · obligations <b className="text-fg">{formatPct(p.allocation.obligations)}</b> · fonds euros{" "}
          <b className="text-fg">{formatPct(Math.max(0, 1 - p.allocation.obligations - etfTarget(p, age)))}</b> (le reste).
        </p>
      </Section>

      <CustomAllocations params={p} accounts={idx.ws.accounts} onChange={(customAllocations) => setP((x) => (x ? { ...x, customAllocations } : x))} issues={issues} />

      <Section title="Règles des livrets">
        <FormGrid cols={3}>
          {eurField("Plancher (ne jamais descendre sous)", ["livrets", "floor"], "Le matelas de sécurité.")}
          {eurField("Plafond (au-delà, transférer)", ["livrets", "ceiling"], "L'excédent part vers le fonds euros.")}
          {pctField("Seuil d'alerte de rééquilibrage", ["livrets", "driftAlert"], "Alerte si la part d'une classe d'actifs s'écarte de plus de ce pourcentage de sa cible (ex. 5 % : alerte à 61 % pour une cible de 55 %).")}
        </FormGrid>
      </Section>

      <Section title="Fiscalité" hint="Taux 2026, à vérifier chaque année.">
        <FormGrid cols={3}>
          <Field label="Tranche marginale d'imposition (TMI)" help="Sur l'avis d'imposition.">
            {(id) => (
              <Select id={id} value={p.tax.tmi} onChange={(e) => set(["tax", "tmi"], Number(e.target.value))}>
                {[0, 0.11, 0.3, 0.41, 0.45].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(v * 100)} %
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="self-center">
            <Checkbox
              checked={p.tax.withholdingDispense}
              onChange={(v) => set(["tax", "withholdingDispense"], v)}
              label="Dispense d'acompte sur les intérêts (demandée avant le 30/11)"
            />
          </div>
          <div className="self-center rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <div className="text-fg-muted">Imposition retenue</div>
            <div>
              {taxRegimeLabel(p)} · {formatPct(incomeTaxRate(p))}
            </div>
          </div>
          {pctField("Prélèvements sociaux (cas général)", ["tax", "socialGeneral"], "PEA, compte-titres, coupons, dividendes, crypto.")}
          {pctField("Prélèvements sociaux assurance-vie", ["tax", "socialAv"])}
          {pctField("Impôt PEA si retrait avant 5 ans", ["tax", "peaBefore5"], "Un retrait avant 5 ans clôture aussi le plan.")}
          {pctField("Impôt assurance-vie avant 8 ans", ["tax", "avBefore8"])}
          {pctField("Impôt assurance-vie après 8 ans", ["tax", "avAfter8"], "Pour moins de 150 000 € de versements.")}
          {eurField("Abattement annuel assurance-vie (seul)", ["tax", "avAllowanceSingle"], "Après 8 ans. 9 200 € pour un couple.")}
          {eurField("Seuil d'exonération des ventes crypto", ["crypto", "exemptionThreshold"], "Total annuel des cessions en dessous duquel rien n'est dû.")}
        </FormGrid>
      </Section>

      <Section title="Seuils d'alerte">
        <FormGrid cols={3}>
          {eurField("Espèces du compte-titres à investir", ["alerts", "ctoCashThreshold"], "Alerte quand de quoi acheter une obligation attend.")}
          {eurField("Espèces du PEA à investir", ["alerts", "peaCashThreshold"])}
          {eurField("Garantie des assureurs (FGAP)", ["alerts", "fgapGuarantee"], "Par personne et par assureur.")}
        </FormGrid>
      </Section>

      <div
        className={cn(
          "fixed right-8 bottom-6 z-40 flex items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-4 py-3 shadow-2xl transition-all",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <span className="text-sm text-fg-muted">{issues.size ? `${issues.size} point(s) à corriger` : "Modifications non enregistrées"}</span>
        <Button variant="ghost" onClick={() => setP(idx.ws.params)}>
          Annuler
        </Button>
        <Button variant="primary" disabled={issues.size > 0 || save.isPending} onClick={() => save.mutate(p, { onSuccess: (saved) => setP(saved as PlanParams) })}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

function Section({ title, hint, actions, children }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          {hint && <p className="mt-1 text-sm text-fg-faint">{hint}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

const CLASS_COLORS = ["#e0a458", "#7aa2f7", "#9ece6a", "#f7768e", "#bb9af7", "#2ac3de"];

/** Classes d'actifs ajoutées à la demande (or, immobilier papier…), prises sur les cibles de base. */
function CustomClasses({ params, age, onChange, issues, save }: { params: PlanParams; age: number; onChange: (c: AssetClass[]) => void; issues: Map<string, string>; save: ReactNode }) {
  const list = params.customClasses;
  const update = (i: number, patch: Partial<AssetClass>) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const add = () => onChange([...list, { id: crypto.randomUUID(), label: "", color: CLASS_COLORS[list.length % CLASS_COLORS.length]!, behavesLike: "croissance", target: 0.05 }]);
  const baseLines = classTargets(params, age).filter((c) => c.label == null);
  return (
    <Section
      title="Classes d'actifs personnalisées"
      hint="Métaux précieux, immobilier papier, petites capitalisations… Une classe peut regrouper plusieurs actifs : rattachez-les dans le tableau ci-dessous."
      actions={
        <div className="flex shrink-0 gap-2">
          {save}
          <Button onClick={add}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>
      }
    >
      {list.length === 0 ? (
        <p className="text-sm text-fg-muted">Aucune classe personnalisée : l'allocation de base s'applique seule.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c, i) => (
            <div key={c.id} className="grid items-start gap-3 sm:grid-cols-[auto_1.4fr_1.2fr_0.8fr_auto]">
              <input type="color" aria-label={`Couleur de ${c.label || "la classe"}`} value={c.color} onChange={(e) => update(i, { color: e.target.value })} className="mt-6 size-9 cursor-pointer rounded-md border border-line bg-transparent p-1" />
              <Field label="Nom" error={issues.get(`customClasses.${i}.label`) ?? null}>{(id) => <TextInput id={id} value={c.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Métaux précieux" />}</Field>
              <Field label="Prend sa part sur" help="Cette cible est retirée de celle-ci. La projection lui applique le même rendement.">
                {(id) => (
                  <Select id={id} value={c.behavesLike} onChange={(e) => update(i, { behavesLike: e.target.value as AssetClass["behavesLike"] })}>
                    <option value="garanti">{BUCKET_LABELS.garanti}</option>
                    <option value="obligations">{BUCKET_LABELS.obligations}</option>
                    <option value="croissance">{BUCKET_LABELS.croissance}</option>
                  </Select>
                )}
              </Field>
              <Field label="Part cible" error={issues.get(`customClasses.${i}.target`) ?? null}>{(id) => <PercentInput id={id} value={c.target} onChange={(v) => update(i, { target: v ?? 0 })} />}</Field>
              <Button variant="ghost" className="mt-6 h-9 w-9 p-0" aria-label={`Supprimer ${c.label || "la classe"}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
          <p className="text-sm text-fg-muted">
            Il reste cette année : {baseLines.map((b) => `${BUCKET_LABELS[b.bucket].toLowerCase()} ${formatPct(b.target)}`).join(" · ")}.
          </p>
        </div>
      )}
    </Section>
  );
}

/** Allocations personnalisées : lignes ajoutées à la demande (cible du patrimoine et/ou part des versements). */
function CustomAllocations({
  params,
  accounts,
  onChange,
  issues,
}: {
  params: PlanParams;
  accounts: Account[];
  onChange: (rules: AllocationRule[]) => void;
  issues: Map<string, string>;
}) {
  const rules = params.customAllocations;
  const [editing, setEditing] = useState<AllocationRule | null>(null);
  const [creating, setCreating] = useState(false);
  const name = (r: AllocationRule) => ruleName(r, accounts);
  const totalOf = (pick: (r: AllocationRule) => boolean) => rules.filter(pick).reduce((t, r) => t + r.share, 0);
  const errors = [...issues].filter(([k]) => k.startsWith("customAllocations.")).map(([, m]) => m);
  const save = (r: AllocationRule) => onChange(rules.some((x) => x.id === r.id) ? rules.map((x) => (x.id === r.id ? r : x)) : [...rules, r]);
  const remove = (r: AllocationRule) => onChange(rules.filter((x) => x.id !== r.id).map((x) => (x.overflowTo === r.id ? { ...x, overflowTo: null } : x)));

  return (
    <Section
      title="Allocations personnalisées"
      hint="En plus de l'allocation ci-dessus : une part du patrimoine ou des versements pour un compte ou un type de compte, éventuellement jusqu'à une limite."
      actions={
        <Button onClick={() => setCreating(true)} className="shrink-0">
          <Plus size={16} /> Ajouter une allocation
        </Button>
      }
    >
      {rules.length === 0 ? (
        <p className="text-sm text-fg-muted">Aucune pour l'instant. Exemple : 20 % des versements sur les livrets jusqu'à 10 000 € versés, puis vers l'assurance-vie.</p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Ligne</Th>
                <Th>Sert de</Th>
                <Th align="right">Part</Th>
                <Th>Limite</Th>
                <Th>Ensuite</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const dest = r.overflowTo ? rules.find((x) => x.id === r.overflowTo) : null;
                return (
                  <Tr key={r.id} className="group cursor-pointer" onDoubleClick={() => setEditing(r)}>
                    <Td>
                      <div>{name(r)}</div>
                      {r.label.trim() && <div className="text-xs text-fg-faint">{targetLabel(r.target, accounts)}</div>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="inline-flex gap-1.5">
                        {r.asTarget && <Badge>Cible</Badge>}
                        {r.asContribution && <Badge>Versements</Badge>}
                      </span>
                    </Td>
                    <Td align="right">{formatPct(r.share)}</Td>
                    <Td className="whitespace-nowrap text-fg-muted">
                      {r.limit ? (
                        <>
                          jusqu'à <Amount value={r.limit.amount} compact className="text-fg" /> {r.limit.basis === "verse" ? "versés" : "de valeur"}
                        </>
                      ) : (
                        "sans fin"
                      )}
                    </Td>
                    <Td className="text-fg-muted">{r.limit ? (dest ? `vers « ${name(dest)} »` : "aux autres lignes") : ""}</Td>
                    <Td className="w-20">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={() => setEditing(r)} aria-label="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={() => remove(r)} aria-label="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-sm text-fg-muted">
            Cibles du patrimoine : <b className="text-fg">{formatPct(totalOf((r) => r.asTarget))}</b> · Parts des versements : <b className="text-fg">{formatPct(totalOf((r) => r.asContribution))}</b>. Le reste n'a pas de consigne.
          </p>
        </>
      )}
      {errors.length > 0 && <p className="mt-2 text-sm text-negative">{[...new Set(errors)].join(" ")}</p>}
      <AllocationDialog
        open={creating || !!editing}
        rule={editing}
        rules={rules}
        accounts={accounts}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </Section>
  );
}

// ——— Comptes ———

function AccountsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("accounts.delete", { success: "Compte supprimé" });
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const { sorted, by } = useSortable(idx?.ws.accounts ?? [], {
    nom: (a) => a.name,
    type: (a) => ACCOUNT_KIND_LABELS[a.kind],
    etab: (a) => (a.institutionId && idx?.institutionById.get(a.institutionId)?.name) || null,
    ouverture: (a) => a.openedOn,
    taux: (a) => a.rate,
    plafond: (a) => a.depositCeiling,
    role: (a) => a.role || null,
  });
  if (!idx) return null;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nouveau compte
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <SortTh {...by("nom")}>Nom</SortTh>
            <SortTh {...by("type")}>Type</SortTh>
            <SortTh {...by("etab")}>Établissement</SortTh>
            <SortTh {...by("ouverture")}>Ouvert le</SortTh>
            <SortTh {...by("taux")} align="right">Taux</SortTh>
            <SortTh {...by("plafond")} align="right">Plafond</SortTh>
            <SortTh {...by("role")}>Rôle</SortTh>
            <Th />
          </tr>
        </thead>
        <tbody>
          {idx.ws.accounts.length === 0 && <EmptyRow cols={8}>Aucun compte.</EmptyRow>}
          {sorted.map((a) => (
            <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
              <Td className="font-medium">
                {a.name} {a.archived && <Badge>archivé</Badge>}
              </Td>
              <Td>{ACCOUNT_KIND_LABELS[a.kind]}</Td>
              <Td className="text-fg-muted">{(a.institutionId && idx.institutionById.get(a.institutionId)?.name) || "—"}</Td>
              <Td className="text-fg-muted">{a.openedOn ? formatDate(a.openedOn) : "—"}</Td>
              <Td align="right">{a.rate != null ? formatPct(a.rate) : "—"}</Td>
              <Td align="right">{a.depositCeiling != null ? <Amount value={a.depositCeiling} compact /> : "—"}</Td>
              <Td className="max-w-64 truncate text-fg-muted">{a.role}</Td>
              <Td className="w-20">
                <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » ?`) && del.mutate({ id: a.id })} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <AccountDialog open={creating || !!editing} account={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}

// ——— Actifs ———

function AssetsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("assets.delete", { success: "Actif supprimé" });
  const upsert = useMutate("assets.upsert");
  const saveParams = useMutate("params.update", { success: "Classes enregistrées" });
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [classes, setClasses] = useState<AssetClass[] | null>(null);
  const saved = idx?.ws.params.customClasses;
  useEffect(() => {
    if (saved) setClasses(saved);
  }, [saved]);
  const draft = useMemo(() => (idx && classes ? { ...idx.ws.params, customClasses: classes } : null), [idx, classes]);
  const issues = useMemo(() => {
    if (!draft) return new Map<string, string>();
    const r = PlanParams.safeParse(draft);
    return new Map(r.success ? [] : r.error.issues.map((i) => [i.path.join("."), i.message]));
  }, [draft]);
  const assetSort = useSortable(idx?.ws.assets ?? [], {
    nom: (a) => a.name,
    type: (a) => ASSET_KIND_LABELS[a.kind],
    isin: (a) => a.isin,
    cours: (a) => a.priceSource,
    cible: (a) => a.targetWeight,
  });
  if (!idx || !draft) return null;
  const equityTargets = idx.activeAssets.filter((a) => a.kind !== "obligation" && a.kind !== "crypto").reduce((s, a) => s + (a.targetWeight ?? 0), 0);
  const age = new Date().getFullYear() - draft.profile.birthYear;
  const dirty = JSON.stringify(classes) !== JSON.stringify(saved);
  const patch = (a: Asset, change: Partial<Asset>) => upsert.mutate({ ...a, ...change });
  const allocValue = (a: Asset) => (a.inAllocation == null ? "" : a.inAllocation ? "in" : "out");
  const inAllocation = (a: Asset) => a.inAllocation ?? (a.kind !== "crypto" && a.kind !== "scpi");
  return (
    <div className="space-y-5 pb-20">
      <CustomClasses
        params={draft}
        age={age}
        onChange={setClasses}
        issues={issues}
        save={
          dirty && (
            <Button variant="primary" disabled={issues.size > 0 || saveParams.isPending} onClick={() => saveParams.mutate(draft)}>
              Enregistrer
            </Button>
          )
        }
      />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-fg-muted">
            Parts cibles des actions :{" "}
            <span className={cn("font-medium", Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 ? "text-warning" : "text-fg")}>{formatPct(equityTargets)}</span>
            {Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 && " (devrait faire 100 %)"}
          </p>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nouvel actif
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <SortTh {...assetSort.by("nom")}>Nom</SortTh>
              <SortTh {...assetSort.by("type")}>Type</SortTh>
              <Th>Classe</Th>
              <Th>Allocation cible</Th>
              <SortTh {...assetSort.by("cours")}>Cours</SortTh>
              <SortTh {...assetSort.by("cible")} align="right">Part cible</SortTh>
              <Th />
            </tr>
          </thead>
          <tbody>
            {idx.ws.assets.length === 0 && <EmptyRow cols={7}>Aucun actif. Ajoutez vos ETF, obligations ou cryptos.</EmptyRow>}
            {assetSort.sorted.map((a) => (
              <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
                <Td className="font-medium">
                  {a.name}
                  <div className="font-mono text-xs font-normal text-fg-faint">{a.isin}</div>
                  {a.kind === "obligation" && <div className="text-xs font-normal text-fg-muted">{`${a.couponRate != null ? formatPct(a.couponRate) : "?"} · échéance ${formatDate(a.maturityDate)}`}</div>}
                </Td>
                <Td>{ASSET_KIND_LABELS[a.kind]}</Td>
                <Td>
                  <Select aria-label={`Classe de ${a.name}`} className="h-8 min-w-36 text-xs" disabled={!inAllocation(a)} value={saved?.some((c) => c.id === a.classId) ? (a.classId ?? "") : ""} onChange={(e) => patch(a, { classId: e.target.value || null })}>
                    <option value="">{BUCKET_LABELS[ASSET_BUCKET[a.kind]]} (par défaut)</option>
                    {saved?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Select aria-label={`Allocation de ${a.name}`} className="h-8 min-w-32 text-xs" value={allocValue(a)} onChange={(e) => patch(a, { inAllocation: e.target.value === "" ? null : e.target.value === "in" })}>
                    <option value="">Par défaut</option>
                    <option value="in">Dans l'allocation</option>
                    <option value="out">Hors allocation</option>
                  </Select>
                </Td>
                <Td className="text-fg-muted">{a.priceSource === "auto" ? `auto${a.symbol ? ` · ${a.symbol}` : ""}` : a.priceSource === "modele" ? "calculé" : "manuel"}</Td>
                <Td align="right">{a.targetWeight != null ? formatPct(a.targetWeight) : "—"}</Td>
                <Td className="w-20">
                  <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » ?`) && del.mutate({ id: a.id })} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
      <AssetDialog open={creating || !!editing} asset={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </div>
  );
}

// ——— Application ———

function AppTab() {
  const info = useSystemInfo();
  return (
    <div className="max-w-3xl space-y-5">
      <BackupCard />
      <AppInfo info={info} />
    </div>
  );
}

const TABLE_LABELS: Record<string, string> = {
  accounts: "comptes",
  assets: "titres",
  transactions: "opérations",
  contribution_plans: "versements programmés",
  prices: "cours",
  checklist_items: "démarches",
};

function BackupCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ name: string; dump: DataDump } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    const dump = await call("data.export");
    downloadText(`hamac-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump), "application/json");
  };
  const choose = async () => {
    const f = await pickTextFile(".json,application/json");
    if (!f) return;
    try {
      const dump = JSON.parse(f.content) as DataDump;
      if (dump.format !== "hamac") throw new Error("format");
      setPending({ name: f.name, dump });
    } catch {
      toast("error", "Ce fichier n'est pas une sauvegarde Hamac.");
    }
  };
  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await call("data.import", { dump: pending.dump, confirm: "REMPLACER" });
      await qc.invalidateQueries();
      toast("success", "Sauvegarde restaurée.");
      setPending(null);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Sauvegarde et transfert</CardTitle>
      <p className="mb-4 text-sm text-fg-muted">
        Un fichier unique avec toutes vos données : pour une copie de sécurité, ou pour passer de l'application de bureau à une instance web (et inversement).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportAll}>
          <Download size={15} /> Exporter une sauvegarde
        </Button>
        <Button variant="ghost" onClick={choose}>
          <Upload size={15} /> Restaurer une sauvegarde…
        </Button>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restaurer une sauvegarde"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={restore} disabled={busy}>
              Remplacer toutes mes données
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm">
            <p>
              <b>{pending.name}</b>, exportée le {formatDate(pending.dump.exportedAt.slice(0, 10))} (version {pending.dump.appVersion}).
            </p>
            <p className="text-fg-muted">
              Contenu :{" "}
              {Object.entries(TABLE_LABELS)
                .map(([t, l]) => `${pending.dump.tables[t]?.length ?? 0} ${l}`)
                .join(", ")}
              .
            </p>
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
              Toutes les données actuelles seront remplacées. La sauvegarde automatique du jour permet de revenir en arrière si besoin.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
}

function AppInfo({ info }: { info: ReturnType<typeof useSystemInfo> }) {
  return (
    <Card>
      <CardTitle>
        <span className="inline-flex items-center gap-2">
          <Archive size={15} /> Données et application
        </span>
      </CardTitle>
      {info.isLoading && <p className="text-sm text-fg-muted">Chargement…</p>}
      {info.error && <p className="text-sm text-negative">Backend injoignable : {(info.error as Error).message}</p>}
      {info.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-fg-muted">Version</dt>
          <dd>{info.data.appVersion}</dd>
          <dt className="text-fg-muted">Mode</dt>
          <dd>{info.data.mode === "desktop" ? "Application de bureau" : "Serveur web"}</dd>
          <dt className="text-fg-muted">Base de données</dt>
          <dd>
            <code className="text-xs break-all">{info.data.databasePath}</code>
          </dd>
          <dt className="text-fg-muted">Sauvegardes</dt>
          <dd>{info.data.backupsDir ? <code className="text-xs break-all">{info.data.backupsDir}</code> : "désactivées"} (une par jour, 30 conservées)</dd>
          <dt className="text-fg-muted">Schéma</dt>
          <dd>{info.data.schemaVersion}</dd>
          <dt className="text-fg-muted">SQLite</dt>
          <dd>{info.data.sqliteVersion}</dd>
        </dl>
      )}
    </Card>
  );
}
