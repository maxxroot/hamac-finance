import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACCOUNT_KIND_LABELS,
  ASSET_KIND_LABELS,
  PlanParams,
  etfTarget,
  formatPct,
  incomeTaxRate,
  retirementYear,
  taxRegimeLabel,
  type Account,
  type Asset,
} from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Checkbox, Field, FormGrid, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { EmptyRow, Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { AccountDialog } from "@/dialogs/AccountDialog";
import { AssetDialog } from "@/dialogs/AssetDialog";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { useSystemInfo } from "@/lib/queries";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { SETTINGS_ITEM } from "@/nav";

const TABS = ["Plan", "Comptes", "Titres", "Application"] as const;
type Tab = (typeof TABS)[number];

export function Parametres() {
  const [tab, setTab] = useState<Tab>("Plan");
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
      {tab === "Titres" && <AssetsTab />}
      {tab === "Application" && <AppTab />}
    </>
  );
}

// ——— Plan ———

type Path = [keyof PlanParams, string];

function PlanTab() {
  const idx = useWorkspaceIndex();
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
  const dirty = JSON.stringify(p) !== JSON.stringify(idx.ws.params);
  const set = (path: Path, value: unknown) => setP((x) => (x ? { ...x, [path[0]]: { ...(x[path[0]] as object), [path[1]]: value } } : x));
  const err = (path: Path) => issues.get(path.join(".")) ?? null;
  const year = new Date().getFullYear();
  const age = year - p.profile.birthYear;

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
      <Section title="Profil et calendrier">
        <FormGrid cols={3}>
          {intField("Année de naissance", ["profile", "birthYear"], `Âge cette année : ${age} ans.`)}
          {intField("Âge de départ visé", ["profile", "retirementAge"], `Départ en ${retirementYear(p)}.`)}
          {intField("Âge de début de sécurisation", ["profile", "securisationAge"], "À partir de cet âge, la part actions baisse progressivement.")}
          {intField("Âge horizon (fin des retraits)", ["profile", "horizonAge"], "Sert au calcul du revenu mensuel possible.")}
          <Field label="Premier mois des versements" help="Début du calendrier des versements mensuels." error={err(["profile", "startMonth"])}>
            {(id) => <TextInput id={id} type="month" value={p.profile.startMonth} onChange={(e) => set(["profile", "startMonth"], e.target.value)} />}
          </Field>
          <div className="self-end pb-2">
            <Checkbox checked={p.profile.couple} onChange={(v) => set(["profile", "couple"], v)} label="Imposition en couple" />
          </div>
        </FormGrid>
      </Section>

      <Section title="Hypothèses de rendement" hint="Par an, avant impôts. Prudentes et modifiables : rien n'est garanti hors livrets, fonds euros et obligations gardées jusqu'à l'échéance.">
        <FormGrid cols={3}>
          {pctField("Livrets", ["returns", "livrets"])}
          {pctField("Fonds euros", ["returns", "fondsEuros"], "Bon fonds euros en ligne : 3 à 4 % brut ces dernières années.")}
          {pctField("Obligations (taux moyen de l'échelle)", ["returns", "obligations"])}
          {pctField("Actions (ETF monde)", ["returns", "actions"], "Moyenne de long terme, avec des années à −30 % ou −50 %.")}
          {pctField("Inflation", ["returns", "inflation"])}
          {pctField("Rendement réel pendant la retraite", ["returns", "realReturnRetirement"], "Rendement après inflation du capital pendant les retraits.")}
        </FormGrid>
      </Section>

      <Section title="Allocation cible de la partie investie" hint="Hors livrets de précaution et hors crypto.">
        <FormGrid cols={3}>
          {pctField("Part actions avant sécurisation", ["allocation", "etfBefore"])}
          {pctField("Part actions à l'âge de départ", ["allocation", "etfAtRetirement"], "Baisse linéaire entre l'âge de sécurisation et l'âge de départ.")}
          {pctField("Part obligations", ["allocation", "obligations"])}
        </FormGrid>
        <p className="mt-3 text-sm text-fg-muted">
          Cette année : actions <b className="text-fg">{formatPct(etfTarget(p, age))}</b> · obligations <b className="text-fg">{formatPct(p.allocation.obligations)}</b> · fonds euros{" "}
          <b className="text-fg">{formatPct(Math.max(0, 1 - p.allocation.obligations - etfTarget(p, age)))}</b> (le reste).
        </p>
      </Section>

      <Section title="Règles des livrets">
        <FormGrid cols={3}>
          {eurField("Plancher (ne jamais descendre sous)", ["livrets", "floor"], "Le matelas de sécurité.")}
          {eurField("Plafond (au-delà, transférer)", ["livrets", "ceiling"], "L'excédent part vers le fonds euros.")}
          {pctField("Seuil d'alerte de rééquilibrage", ["livrets", "driftAlert"], "Alerte si une poche s'écarte de plus de ce nombre de points de sa cible.")}
        </FormGrid>
      </Section>

      <Section title="Frais" hint="À reprendre dans la grille tarifaire de votre courtier et de votre plateforme crypto.">
        <FormGrid cols={3}>
          {pctField("Courtage (% par ordre)", ["broker", "feeRate"], "Achats et ventes d'ETF, d'actions et d'obligations.")}
          {eurField("Courtage minimum par ordre", ["broker", "minFee"])}
          {pctField("Frais de la plateforme crypto", ["crypto", "feeRate"], "Souvent entre 0,1 % et 1,5 %.")}
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

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mt-1 text-sm text-fg-faint">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

// ——— Comptes ———

function AccountsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("accounts.delete", { success: "Compte supprimé" });
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
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
            <Th>Nom</Th>
            <Th>Type</Th>
            <Th>Établissement</Th>
            <Th>Ouvert le</Th>
            <Th align="right">Taux</Th>
            <Th align="right">Plafond</Th>
            <Th>Rôle</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {idx.ws.accounts.length === 0 && <EmptyRow cols={8}>Aucun compte.</EmptyRow>}
          {idx.ws.accounts.map((a) => (
            <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
              <Td className="font-medium">
                {a.name} {a.archived && <Badge>archivé</Badge>}
              </Td>
              <Td>{ACCOUNT_KIND_LABELS[a.kind]}</Td>
              <Td className="text-fg-muted">{a.institution}</Td>
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

// ——— Titres ———

function AssetsTab() {
  const idx = useWorkspaceIndex();
  const del = useMutate("assets.delete", { success: "Titre supprimé" });
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  if (!idx) return null;
  const equityTargets = idx.activeAssets.filter((a) => a.kind !== "obligation" && a.kind !== "crypto").reduce((s, a) => s + (a.targetWeight ?? 0), 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          Parts cibles de la poche actions :{" "}
          <span className={cn("font-medium", Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 ? "text-warning" : "text-fg")}>{formatPct(equityTargets)}</span>
          {Math.abs(equityTargets - 1) > 0.0001 && equityTargets > 0 && " (devrait faire 100 %)"}
        </p>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Nouveau titre
        </Button>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Nom</Th>
            <Th>Type</Th>
            <Th>ISIN</Th>
            <Th>Cours</Th>
            <Th align="right">Part cible</Th>
            <Th>Obligation</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {idx.ws.assets.length === 0 && <EmptyRow cols={7}>Aucun titre. Ajoutez vos ETF, obligations ou cryptos.</EmptyRow>}
          {idx.ws.assets.map((a) => (
            <Tr key={a.id} className={cn("group", a.archived && "opacity-50")}>
              <Td className="font-medium">{a.name}</Td>
              <Td>{ASSET_KIND_LABELS[a.kind]}</Td>
              <Td className="font-mono text-xs text-fg-muted">{a.isin ?? "—"}</Td>
              <Td className="text-fg-muted">{a.priceSource === "auto" ? `auto${a.symbol ? ` · ${a.symbol}` : ""}` : a.priceSource === "modele" ? "calculé" : "manuel"}</Td>
              <Td align="right">{a.targetWeight != null ? formatPct(a.targetWeight) : "—"}</Td>
              <Td className="text-fg-muted">
                {a.kind === "obligation" ? `${a.couponRate != null ? formatPct(a.couponRate) : "?"} · échéance ${formatDate(a.maturityDate)}` : ""}
              </Td>
              <Td className="w-20">
                <RowActions onEdit={() => setEditing(a)} onDelete={() => confirm(`Supprimer « ${a.name} » ?`) && del.mutate({ id: a.id })} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <AssetDialog open={creating || !!editing} asset={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
      <button className="rounded p-1.5 text-fg-muted hover:bg-surface-3 hover:text-fg" onClick={onEdit} aria-label="Modifier">
        <Pencil size={14} />
      </button>
      <button className="rounded p-1.5 text-fg-muted hover:bg-negative/15 hover:text-negative" onClick={onDelete} aria-label="Supprimer" title="Supprimer (ou archiver si utilisé)">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

// ——— Application ———

function AppTab() {
  const info = useSystemInfo();
  return (
    <Card className="max-w-3xl">
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
