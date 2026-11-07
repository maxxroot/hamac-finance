import { useEffect, useState } from "react";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, allocationIssues, ruleName, targetLabel, type Account, type AccountKind, type AllocationRule, type AllocationTarget } from "@hamac/core";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, PercentInput, Select, TextInput } from "@/components/form";
import { Button } from "@/components/ui";

const blank = (): AllocationRule => ({
  id: crypto.randomUUID(),
  label: "",
  target: { kind: "type", accountKind: "livret" },
  asTarget: true,
  asContribution: true,
  share: 0.2,
  limit: null,
  overflowTo: null,
});

const targetKey = (t: AllocationTarget) => (t.kind === "type" ? `type:${t.accountKind}` : `compte:${t.accountId}`);
const parseTarget = (key: string): AllocationTarget => {
  const [kind, value] = key.split(":");
  return kind === "type" ? { kind: "type", accountKind: value as AccountKind } : { kind: "compte", accountId: value };
};

/** Création / modification d'une allocation personnalisée (modifie le brouillon des paramètres). */
export function AllocationDialog({
  open,
  rule,
  rules,
  accounts,
  onClose,
  onSave,
}: {
  open: boolean;
  /** null = nouvelle ligne. */
  rule: AllocationRule | null;
  rules: readonly AllocationRule[];
  accounts: readonly Account[];
  onClose: () => void;
  onSave: (r: AllocationRule) => void;
}) {
  const [d, setD] = useState<AllocationRule>(rule ?? blank());
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (open) {
      setD(rule ?? blank());
      setShowErrors(false);
    }
  }, [open, rule]);

  const others = rules.filter((r) => r.id !== d.id);
  const all = [...others, d];
  const issues = allocationIssues(all).filter((i) => i.index === all.length - 1);
  const shareIssue = allocationIssues(all).find((i) => i.field === "share");
  const errors = [...issues.map((i) => i.message), ...(shareIssue && !issues.includes(shareIssue) ? [shareIssue.message] : []), ...(d.share <= 0 ? ["Indiquez une part supérieure à 0 %."] : []),
    ...(d.limit && !(d.limit.amount > 0) ? ["Indiquez le montant de la limite."] : []),
  ];
  const active = accounts.filter((a) => !a.archived);

  const submit = () => {
    setShowErrors(true);
    if (errors.length) return;
    onSave(d);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? "Modifier l'allocation" : "Nouvelle allocation"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit}>
            {rule ? "Valider" : "Ajouter"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid cols={2}>
          <Field label="Vise" help="Un type de compte (tous les comptes de ce type) ou un compte précis.">
            {(id) => (
              <Select id={id} value={targetKey(d.target)} onChange={(e) => setD({ ...d, target: parseTarget(e.target.value) })}>
                <optgroup label="Type de compte">
                  {ACCOUNT_KINDS.map((k) => (
                    <option key={k} value={`type:${k}`}>
                      {k === "livret" ? "Livrets" : ACCOUNT_KIND_LABELS[k]}
                    </option>
                  ))}
                </optgroup>
                {active.length > 0 && (
                  <optgroup label="Compte précis">
                    {active.map((a) => (
                      <option key={a.id} value={`compte:${a.id}`}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            )}
          </Field>
          <Field label="Nom (facultatif)">{(id) => <TextInput id={id} value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder={targetLabel(d.target, accounts)} />}</Field>
        </FormGrid>

        <div>
          <div className="mb-2 text-xs font-medium text-fg-muted">Sert de</div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox checked={d.asTarget} onChange={(v) => setD({ ...d, asTarget: v })} label="Cible du patrimoine (part de sa valeur totale)" />
            <Checkbox checked={d.asContribution} onChange={(v) => setD({ ...d, asContribution: v })} label="Part des versements mensuels" />
          </div>
        </div>

        <FormGrid cols={2}>
          <Field label="Part" help={d.asContribution ? "Des versements mensuels programmés, tous comptes confondus." : "De la valeur totale du patrimoine."}>
            {(id) => <PercentInput id={id} value={d.share} onChange={(v) => setD({ ...d, share: v ?? 0 })} />}
          </Field>
          <Field label="Limite (facultative)">
            {(id) => (
              <Select
                id={id}
                value={d.limit?.basis ?? ""}
                onChange={(e) => {
                  const basis = e.target.value as "" | "verse" | "valeur";
                  setD({ ...d, limit: basis ? { basis, amount: d.limit?.amount ?? 10_000 } : null, overflowTo: basis ? d.overflowTo : null });
                }}
              >
                <option value="">Aucune : sans fin</option>
                <option value="verse">Jusqu'à avoir versé…</option>
                <option value="valeur">Jusqu'à une valeur de…</option>
              </Select>
            )}
          </Field>
        </FormGrid>

        {d.limit && (
          <FormGrid cols={2}>
            <Field label={d.limit.basis === "verse" ? "Montant versé à atteindre" : "Valeur à atteindre"} help={d.limit.basis === "verse" ? "Versé net : versements moins retraits." : "Valeur actuelle, intérêts et plus-values compris."}>
              {(id) => <MoneyInput id={id} value={d.limit!.amount} onChange={(v) => setD({ ...d, limit: { ...d.limit!, amount: v ?? 0 } })} />}
            </Field>
            <Field label="Ensuite, la part va" help="Une fois la limite atteinte.">
              {(id) => (
                <Select id={id} value={d.overflowTo ?? ""} onChange={(e) => setD({ ...d, overflowTo: e.target.value || null })}>
                  <option value="">Aux autres lignes, au prorata</option>
                  {others.map((r) => (
                    <option key={r.id} value={r.id}>
                      À « {ruleName(r, accounts)} »
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </FormGrid>
        )}

        {showErrors && errors.length > 0 && <p className="text-sm text-negative">{errors.join(" ")}</p>}
      </div>
    </Modal>
  );
}
