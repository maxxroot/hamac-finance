import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { TX_LABELS, crowdTaxOf, formatPct, parseBricksSheet, planBricksImport, type Account, type BricksRow, type PlanAction } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, Modal, Select } from "@/shared/components/form";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button } from "@/shared/components/ui";
import { pickBinaryFile } from "@/shared/lib/files";
import { formatDate } from "@/shared/lib/numbers";
import { readXlsx } from "@/features/investments/lib/xlsx";
import { useToast } from "@/shared/lib/toast";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";

const ACTIONS: Record<PlanAction, { label: string; tone: "neutral" | "accent" | "positive" | "negative" }> = {
  nouveau: { label: "Nouveau", tone: "positive" },
  modifie: { label: "Modifié", tone: "accent" },
  retire: { label: "À retirer", tone: "negative" },
  conflit: { label: "Conflit", tone: "negative" },
};

/** Compare un export Bricks à Hamac : seules les nouveautés et les changements sont proposés. */
export function BricksImportDialog({ platforms, onClose }: { platforms: readonly Account[]; onClose: () => void }) {
  const idx = useWorkspaceIndex();
  const toast = useToast();
  const apply = useMutate("crowdProjects.applyImport");
  const [accountId, setAccountId] = useState(platforms[0]?.id ?? "");
  const [rows, setRows] = useState<BricksRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [on, setOn] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<number | null>(null);

  const load = async () => {
    const f = await pickBinaryFile(".xlsx");
    if (!f) return;
    try {
      setRows(parseBricksSheet(await readXlsx(f.bytes)));
      setFileName(f.name);
      setOff(new Set());
      setOn(new Set());
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const plan = useMemo(() => (rows && idx ? planBricksImport(rows, accountId, idx.ws.transactions, idx.ws.crowdProjects) : null), [rows, idx, accountId]);
  const account = platforms.find((a) => a.id === accountId);
  const tax = idx && account ? crowdTaxOf(idx.ws, account) : null;
  const txOn = (t: { action: PlanAction; externalId: string }) => (t.action === "conflit" ? on.has(t.externalId) : !off.has(t.externalId));
  const projectOn = (p: { externalId: string }) => !off.has(p.externalId);
  const toggle = (id: string, conflict: boolean, value: boolean) => {
    const update = (s: Set<string>, add: boolean) => {
      const next = new Set(s);
      if (add) next.add(id);
      else next.delete(id);
      return next;
    };
    if (conflict) setOn((s) => update(s, value));
    else setOff((s) => update(s, !value));
  };

  const selectedTx = plan?.transactions.filter(txOn) ?? [];
  const selectedProjects = plan?.projects.filter(projectOn) ?? [];
  const count = selectedTx.length + selectedProjects.length;
  const submit = () =>
    apply.mutate(
      {
        accountId,
        // Un conflit accepté devient une opération nouvelle.
        transactions: selectedTx.map((t) => ({ action: t.action === "conflit" ? ("nouveau" as const) : t.action, id: t.id, externalId: t.externalId, date: t.date, type: t.type, amount: t.amount, comment: t.comment })),
        projects: selectedProjects.map(({ changes: _c, ...p }) => p),
      },
      { onSuccess: () => setDone(count) },
    );

  return (
    <Modal
      open
      onClose={onClose}
      title="Importer un fichier Bricks"
      width="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          {plan && done == null && (
            <Button variant="primary" disabled={!count || apply.isPending} onClick={submit}>
              Appliquer {count} changement{count > 1 ? "s" : ""}
            </Button>
          )}
        </>
      }
    >
      {done != null ? (
        <p className="py-10 text-center text-lg font-medium">{done} changement(s) appliqué(s).</p>
      ) : !plan ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <FileUp size={28} className="text-fg-faint" />
          <p className="max-w-lg text-sm text-fg-muted">Exportez vos transactions depuis Bricks au format .xlsx. Hamac compare le fichier à ce qu'il connaît déjà et ne propose que ce qui est nouveau ou a changé.</p>
          <Button variant="primary" onClick={load}>
            Choisir le fichier
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid items-end gap-3 sm:grid-cols-2">
            <Field label="Fichier">{() => <div className="truncate pt-2 text-sm">{fileName}</div>}</Field>
            <Field label="Plateforme">
              {(id) => (
                <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {platforms.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <p className="text-sm text-fg-muted">
            <b className="text-fg">{plan.projects.length + plan.transactions.length}</b> à examiner · {plan.unchanged} déjà à jour · {plan.skipped} ligne(s) annulée(s) ou refusée(s) ignorée(s).
          </p>
          {plan.unknownTypes.length > 0 && <p className="text-sm text-warning">Types d'opérations inconnus, non importés : {plan.unknownTypes.join(", ")}.</p>}
          {plan.withheldRate != null && tax && !tax.withheld && (
            <p className="text-sm text-warning">Le fichier contient des prélèvements à la source ({formatPct(plan.withheldRate)} des revenus). Cochez « La plateforme prélève les impôts » sur l'établissement, sinon ces impôts seront comptés une seconde fois.</p>
          )}
          {plan.withheldRate != null && tax?.withheld && Math.abs(plan.withheldRate - tax.rate) > 0.01 && <p className="text-sm text-warning">Taux prélevé d'après le fichier : {formatPct(plan.withheldRate)}, contre {formatPct(tax.rate)} réglé sur l'établissement.</p>}

          <div className="max-h-96 space-y-4 overflow-y-auto">
            {plan.projects.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th />
                    <Th>Projet</Th>
                    <Th align="right">Investi</Th>
                    <Th align="right">Remboursé</Th>
                    <Th>Changement</Th>
                  </tr>
                </thead>
                <tbody>
                  {plan.projects.map((p) => (
                    <Tr key={p.externalId} className={projectOn(p) ? undefined : "opacity-60"}>
                      <Td><input type="checkbox" aria-label={`Importer ${p.name}`} className="size-4 accent-[var(--color-accent)]" checked={projectOn(p)} onChange={(e) => toggle(p.externalId, false, e.target.checked)} /></Td>
                      <Td className="font-medium">{p.name}</Td>
                      <Td align="right"><Amount value={p.amount} /></Td>
                      <Td align="right"><Amount value={p.repaidCapital} /></Td>
                      <Td><Badge tone={ACTIONS[p.action].tone}>{ACTIONS[p.action].label}</Badge> <span className="text-xs text-fg-muted">{p.changes.join(", ")}</span></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {plan.transactions.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <Th />
                    <Th>Date</Th>
                    <Th>Opération</Th>
                    <Th align="right">Montant</Th>
                    <Th>Détail</Th>
                    <Th>État</Th>
                  </tr>
                </thead>
                <tbody>
                  {plan.transactions.map((t) => (
                    <Tr key={t.externalId} className={txOn(t) ? undefined : "opacity-60"}>
                      <Td><input type="checkbox" aria-label={`Importer ${t.comment}`} className="size-4 accent-[var(--color-accent)]" checked={txOn(t)} onChange={(e) => toggle(t.externalId, t.action === "conflit", e.target.checked)} /></Td>
                      <Td className="num whitespace-nowrap">{formatDate(t.date)}</Td>
                      <Td>{TX_LABELS[t.type]}</Td>
                      <Td align="right"><Amount value={t.amount} /></Td>
                      <Td className="max-w-64 truncate text-xs text-fg-muted" title={t.note ?? t.comment}>{t.note ?? t.comment}</Td>
                      <Td><Badge tone={ACTIONS[t.action].tone}>{ACTIONS[t.action].label}</Badge></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            {!plan.projects.length && !plan.transactions.length && <p className="py-6 text-center text-sm text-fg-muted">Tout est déjà à jour.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
