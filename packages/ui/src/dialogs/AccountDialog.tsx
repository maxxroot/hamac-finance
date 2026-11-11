import { useEffect, useState } from "react";
import type { AccountInput } from "@hamac/api";
import { ACCOUNT_KIND_LABELS, ACCOUNT_KINDS, LIVRET_LABELS, LIVRET_LEGAL_CEILINGS, LIVRET_TYPES, canBeJoint, uniqueAccountConflict, type Account, type AccountKind, type LivretType, offerKindOf } from "@hamac/core";
import { Button } from "@/components/ui";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, TextInput } from "@/components/form";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";
import { AllocationChoice } from "./AllocationChoice";

type Draft = Required<Omit<AccountInput, "id">> & { id?: string };

function empty(kind: AccountKind): Draft {
  return {
    kind,
    livretType: kind === "livret" ? "LEP" : null,
    name: "",
    institutionId: null,
    openedOn: null,
    depositCeiling: kind === "livret" ? LIVRET_LEGAL_CEILINGS.LEP : null,
    rate: null,
    rateFrom: null,
    role: "",
    beneficiaryClause: false,
    entryFeeRate: null,
    managementFeeRate: null,
    monthsToInvest: kind === "pea" ? 12 : null,
    inAllocation: null,
    share: 1,
    sortOrder: 0,
    archived: false,
  };
}

export function AccountDialog({
  open,
  onClose,
  account,
  defaultKind = "livret",
}: {
  open: boolean;
  onClose: () => void;
  account?: Account | null;
  defaultKind?: AccountKind;
}) {
  const [d, setD] = useState<Draft>(empty(defaultKind));
  const save = useMutate("accounts.upsert", { success: account ? "Compte mis à jour" : "Compte créé" });

  useEffect(() => {
    if (open) setD(account ? { ...account, rateFrom: null } : empty(defaultKind));
  }, [open, account, defaultKind]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const idx = useWorkspaceIndex();
  const offerKey = offerKindOf(d.kind);
  const offering = idx?.ws.institutions.filter((i) => offerKey && i.offers[offerKey]) ?? [];
  const others = idx?.ws.institutions.filter((i) => !offerKey || !i.offers[offerKey]) ?? [];

  const submit = () =>
    save.mutate(d, {
      onSuccess: () => onClose(),
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={account ? `Modifier « ${account.name} »` : "Nouveau compte"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} disabled={save.isPending || !d.name.trim()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid>
          <Field label="Type de compte">
            {(id) => (
              <Select
                id={id}
                value={d.kind}
                onChange={(e) => {
                  const kind = e.target.value as AccountKind;
                  setD((x) => ({ ...empty(kind), id: x.id, name: x.name, institutionId: x.institutionId, role: x.role }));
                }}
              >
                {ACCOUNT_KINDS.map((k) => {
                  const taken = (k === "pea" || k === "pea_pme") && !!idx && !!uniqueAccountConflict(idx.ws.accounts, { id: d.id, kind: k, livretType: null });
                  return (
                    <option key={k} value={k} disabled={taken}>
                      {ACCOUNT_KIND_LABELS[k]}
                      {taken ? " (déjà ouvert : un seul par personne)" : ""}
                    </option>
                  );
                })}
              </Select>
            )}
          </Field>
          {d.kind === "livret" ? (
            <Field label="Livret">
              {(id) => (
                <Select
                  id={id}
                  value={d.livretType ?? "AUTRE"}
                  onChange={(e) => {
                    const lt = e.target.value as LivretType;
                    setD((x) => ({
                      ...x,
                      livretType: lt,
                      depositCeiling: LIVRET_LEGAL_CEILINGS[lt],
                      name: x.name && !LIVRET_TYPES.some((t) => LIVRET_LABELS[t] === x.name) ? x.name : lt === "AUTRE" ? "" : LIVRET_LABELS[lt],
                    }));
                  }}
                >
                  {LIVRET_TYPES.map((t) => {
                    const taken = !!idx && !!uniqueAccountConflict(idx.ws.accounts, { id: d.id, kind: "livret", livretType: t });
                    return (
                      <option key={t} value={t} disabled={taken}>
                        {LIVRET_LABELS[t]}
                        {taken ? " (déjà ouvert)" : ""}
                      </option>
                    );
                  })}
                </Select>
              )}
            </Field>
          ) : (
            <div />
          )}
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="ex. PEA BoursoBank" autoFocus />}</Field>
          <Field
            label="Établissement"
            help={
              idx && offerKey && d.institutionId && !idx.institutionById.get(d.institutionId)?.offers[offerKey]
                ? "Cet établissement n'a pas d'offre de ce type : les frais par défaut s'appliquent."
                : !idx?.ws.institutions.length
                  ? "Ajoutez vos établissements et leurs frais dans Paramètres › Établissements."
                  : undefined
            }
          >
            {(id) => (
              <Select id={id} value={d.institutionId ?? ""} onChange={(e) => set("institutionId", e.target.value || null)}>
                <option value="">Aucun (frais par défaut)</option>
                {offering.length > 0 && (
                  <optgroup label={`Proposent un ${ACCOUNT_KIND_LABELS[d.kind].toLowerCase()}`}>
                    {offering.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label="Autres établissements">
                    {others.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
            )}
          </Field>
          <Field label="Date d'ouverture" help={d.kind === "pea" || d.kind === "pea_pme" ? "Sert à la règle des 5 ans." : d.kind === "assurance_vie" ? "Sert à la règle des 8 ans." : undefined}>
            {(id) => <TextInput id={id} type="date" value={d.openedOn ?? ""} onChange={(e) => set("openedOn", e.target.value || null)} />}
          </Field>
          <Field label="Rôle dans le plan">{(id) => <TextInput id={id} value={d.role} onChange={(e) => set("role", e.target.value)} placeholder="ex. Matelas de sécurité" />}</Field>
        </FormGrid>

        {d.kind === "livret" && (
          <FormGrid cols={3}>
            <Field label="Taux actuel" help="Net, tel qu'affiché par la banque.">{(id) => <PercentInput id={id} value={d.rate} onChange={(v) => set("rate", v)} />}</Field>
            <Field label="En vigueur depuis le" help={account ? "Un nouveau taux s'ajoute à l'historique sans effacer l'ancien." : "Aujourd'hui si vide."}>
              {(id) => <TextInput id={id} type="date" value={d.rateFrom ?? ""} onChange={(e) => set("rateFrom", e.target.value || null)} />}
            </Field>
            <Field label="Plafond de dépôt" help="Plafond légal pré-rempli.">
              {(id) => <MoneyInput id={id} value={d.depositCeiling} onChange={(v) => set("depositCeiling", v)} />}
            </Field>
          </FormGrid>
        )}

        {d.kind === "assurance_vie" && (
          <>
            <FormGrid>
              <Field label="Frais sur versements">{(id) => <PercentInput id={id} value={d.entryFeeRate} onChange={(v) => set("entryFeeRate", v)} />}</Field>
              <Field label="Frais de gestion du fonds euros">{(id) => <PercentInput id={id} value={d.managementFeeRate} onChange={(v) => set("managementFeeRate", v)} />}</Field>
            </FormGrid>
            <Checkbox checked={d.beneficiaryClause} onChange={(v) => set("beneficiaryClause", v)} label="Clause bénéficiaire rédigée" />
          </>
        )}

        {d.kind === "pea" && (
          <Field label="Mois pour investir l'apport de départ" help="Hamac conseille chaque mois d'investir les espèces du PEA par fractions sur cette durée.">
            {(id) => <NumberInput id={id} value={d.monthsToInvest} decimals={0} onChange={(v) => set("monthsToInvest", v == null ? null : Math.max(1, Math.round(v)))} />}
          </Field>
        )}

        {canBeJoint(d) && (
          <Field label="Part détenue" help="Compte joint : 50 % s'il est à deux. Seule votre part compte dans le patrimoine, la répartition et la protection en cas de faillite ; le compte et ses opérations restent saisis en entier.">
            {(id) => <PercentInput id={id} value={d.share} onChange={(v) => set("share", v == null ? 1 : Math.min(1, Math.max(0.01, v)))} />}
          </Field>
        )}

        <AllocationChoice value={d.inAllocation} defaultLabel="comme sa classe, dans Paramètres › Répartition" onChange={(v) => set("inAllocation", v)} />

        {account && <Checkbox checked={d.archived} onChange={(v) => set("archived", v)} label="Archivé (masqué des listes, l'historique est conservé)" />}
      </div>
    </Modal>
  );
}
