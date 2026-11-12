import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  COUNTER_SOURCES,
  COUNTERS_VERIFIED_ON,
  FAMILY_CASH_GIFT,
  GIFT_ALLOWANCES,
  GIFT_DIRECTION_LABELS,
  GIFT_DIRECTIONS,
  GIFT_KIND_LABELS,
  GIFT_KINDS,
  GIFT_RELATION_LABELS,
  GIFT_RELATIONS,
  ceilingCounters,
  giftCounters,
  lifeInsuranceCounters,
  seniorityCounters,
  type Gift,
  type GiftDirection,
  type GiftKind,
  type GiftRelation,
} from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, FormGrid, Modal, MoneyInput, Select, TextInput } from "@/shared/components/form";
import { RowActions } from "@/shared/components/RowActions";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { formatDate, todayIso } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

/** Anciennetés fiscales, plafonds de versement, abattements de l'assurance-vie et des donations. */
export function Compteurs() {
  const pf = usePortfolio();
  const counters = useMemo(() => {
    if (!pf) return null;
    return {
      seniority: seniorityCounters(pf.state),
      ceilings: ceilingCounters(pf.data, pf.state),
      life: lifeInsuranceCounters(pf.data, pf.state),
      gifts: giftCounters(pf.idx.ws.gifts, pf.today),
    };
  }, [pf]);
  if (!pf || !counters) return null;
  const { seniority, ceilings, life, gifts } = counters;

  return (
    <>
      <PageHeader title="Compteurs et plafonds" description="Ce qui avance avec le temps (ancienneté des contrats, abattements renouvelés) et ce qui limite vos versements." />
      <div className="grid gap-5 @4xl:grid-cols-2">
        <Card>
          <CardTitle>Ancienneté des contrats</CardTitle>
          {seniority.length === 0 ? (
            <p className="text-sm text-fg-muted">Ni PEA ni assurance-vie.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {seniority.map((s) => (
                <li key={s.account.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    {s.account.name} <span className="text-xs text-fg-faint">· {s.years} ans</span>
                  </span>
                  {s.date == null ? (
                    <span className="text-xs text-fg-faint">date d'ouverture à renseigner</span>
                  ) : s.reached ? (
                    <Badge tone="positive">Atteints le {formatDate(s.date)}</Badge>
                  ) : (
                    <span>
                      le {formatDate(s.date)} <span className="text-xs text-fg-faint">(dans {s.monthsLeft} mois)</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-fg-faint">PEA : après 5 ans, les retraits ne paient que les prélèvements sociaux. Assurance-vie : après 8 ans, un abattement annuel s'applique aux gains retirés.</p>
        </Card>

        <Card>
          <CardTitle>Plafonds de versement</CardTitle>
          {ceilings.length === 0 ? (
            <p className="text-sm text-fg-muted">Aucun compte plafonné. Indiquez votre plafond PER dans Paramètres › Plan pour le suivre ici.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {ceilings.map((c) => (
                <li key={c.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>{c.label}</span>
                    <span>
                      <Amount value={c.used} compact /> / <Amount value={c.ceiling} compact />
                      <span className="ml-2 text-xs text-fg-faint">
                        reste <Amount value={c.remaining} compact />
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-3" role="img" aria-label={`${Math.round((c.used / c.ceiling) * 100)} % du plafond`}>
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((c.used / c.ceiling) * 100))}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-fg-faint">{c.note}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {life && (
          <Card>
            <CardTitle>Assurance-vie</CardTitle>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <dt>Abattement annuel sur les gains retirés</dt>
              <dd className="text-right">
                <Amount value={life.allowance} />
              </dd>
              <dt>Gains retirés cette année (contrats de plus de 8 ans)</dt>
              <dd className="text-right">
                <Amount value={life.gainsWithdrawn} />
              </dd>
              <dt className="font-medium">Encore possible sans impôt sur le revenu</dt>
              <dd className="text-right font-medium">
                <Amount value={life.allowanceLeft} />
              </dd>
              <dt className="pt-2">Versements avant 70 ans</dt>
              <dd className="pt-2 text-right">
                <Amount value={life.before70} />
              </dd>
              <dt>Versements après 70 ans</dt>
              <dd className="text-right">
                <Amount value={life.after70} />
              </dd>
            </dl>
            <p className="mt-3 text-xs text-fg-faint">
              Les prélèvements sociaux restent dus sur les gains. Pour la transmission, les versements avant 70 ans et après 70 ans ne suivent pas les mêmes règles ; l'âge est compté d'après votre année de naissance ({formatDate(life.seventyOn)}).
            </p>
          </Card>
        )}

        <GiftsCard counters={gifts} />
      </div>
      <p className="mt-4 text-xs text-fg-faint">
        Règles vérifiées le {formatDate(COUNTERS_VERIFIED_ON)}. Sources :{" "}
        {COUNTER_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
              {s.label}
            </a>
          </span>
        ))}
        .
      </p>
    </>
  );
}

function GiftsCard({ counters }: Readonly<{ counters: ReturnType<typeof giftCounters> }>) {
  const pf = usePortfolio()!;
  const del = useMutate("gifts.delete", { success: "Donation supprimée" });
  const [editing, setEditing] = useState<Gift | "new" | null>(null);
  const list = pf.idx.ws.gifts;
  return (
    <Card className="@4xl:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-3">
        <CardTitle hint="abattements renouvelés tous les 15 ans">Donations</CardTitle>
        <Button className="h-8" onClick={() => setEditing("new")}>
          <Plus size={14} /> Noter une donation
        </Button>
      </div>
      {counters.length > 0 && (
        <Table className="mb-4">
          <thead>
            <tr>
              <Th>Personne</Th>
              <Th align="right">Abattement utilisé</Th>
              <Th align="right">Restant</Th>
              <Th align="right">Don familial d'argent restant</Th>
              <Th align="right">Au-delà</Th>
              <Th>Renouvelé le</Th>
            </tr>
          </thead>
          <tbody>
            {counters.map((c) => (
              <Tr key={`${c.direction}-${c.person}-${c.relation}`}>
                <Td>
                  <span className="font-medium">{c.person}</span>
                  <div className="text-xs text-fg-faint">
                    {c.direction === "faite" ? "Vous lui avez donné" : "Vous avez reçu de cette personne"} · {GIFT_RELATION_LABELS[c.relation].toLocaleLowerCase("fr-FR")}
                  </div>
                </Td>
                <Td align="right">
                  <Amount value={c.used} compact /> / <Amount value={c.allowance} compact />
                </Td>
                <Td align="right">
                  <Amount value={c.remaining} compact />
                </Td>
                <Td align="right">{c.cashGiftRemaining == null ? "—" : <Amount value={c.cashGiftRemaining} compact />}</Td>
                <Td align="right" className={c.taxable > 0 ? "font-medium text-negative" : undefined}>
                  <Amount value={c.taxable} compact />
                </Td>
                <Td>{c.renewsOn ? formatDate(c.renewsOn) : "—"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Donation</Th>
            <Th align="right">Montant</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && <EmptyRow cols={4}>Aucune donation notée.</EmptyRow>}
          {list.map((g) => (
            <Tr key={g.id} className="group">
              <Td className="whitespace-nowrap">{formatDate(g.date)}</Td>
              <Td>
                {GIFT_DIRECTION_LABELS[g.direction]} · {g.person} <span className="text-xs text-fg-faint">({GIFT_RELATION_LABELS[g.relation].toLocaleLowerCase("fr-FR")})</span>
                <div className="text-xs text-fg-faint">
                  {GIFT_KIND_LABELS[g.kind]}
                  {g.comment && ` · ${g.comment}`}
                </div>
              </Td>
              <Td align="right">
                <Amount value={g.amount} />
              </Td>
              <Td className="w-20">
                <RowActions onEdit={() => setEditing(g)} onDelete={() => confirm("Supprimer cette donation ?") && del.mutate({ id: g.id })} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-fg-faint">
        Chaque abattement vaut par donateur et par bénéficiaire. Le don familial de sommes d'argent ({FAMILY_CASH_GIFT.toLocaleString("fr-FR")} €) s'ajoute à l'abattement : donateur de moins de 80 ans, bénéficiaire majeur. Les présents d'usage (anniversaire, mariage, dans la mesure de vos revenus) ne comptent pas. Estimation sans valeur officielle.
      </p>
      <GiftDialog gift={editing === "new" ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </Card>
  );
}

function GiftDialog({ open, gift, onClose }: Readonly<{ open: boolean; gift: Gift | null; onClose: () => void }>) {
  const save = useMutate("gifts.upsert", { success: gift ? "Donation mise à jour" : "Donation notée" });
  const blank = { date: todayIso(), direction: "faite" as GiftDirection, kind: "donation" as GiftKind, person: "", relation: "enfant" as GiftRelation, amount: null as number | null, comment: "" };
  const [d, setD] = useState(blank);
  useEffect(() => {
    if (open) setD(gift ? { ...gift } : blank);
  }, [open, gift]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={gift ? "Modifier la donation" : "Noter une donation"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!d.person.trim() || !d.amount || save.isPending} onClick={() => d.amount && save.mutate({ ...d, amount: d.amount, id: gift?.id }, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Sens">
            {(id) => (
              <Select id={id} value={d.direction} onChange={(e) => setD({ ...d, direction: e.target.value as GiftDirection })}>
                {GIFT_DIRECTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k === "faite" ? "Je donne" : "Je reçois"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date">{(id) => <TextInput id={id} type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />}</Field>
          <Field label={d.direction === "faite" ? "Bénéficiaire" : "Donateur"}>{(id) => <TextInput id={id} value={d.person} onChange={(e) => setD({ ...d, person: e.target.value })} placeholder="ex. Prénom" />}</Field>
          <Field label="Lien du bénéficiaire avec le donateur" help={`Abattement : ${GIFT_ALLOWANCES[d.relation].toLocaleString("fr-FR")} € tous les 15 ans.`}>
            {(id) => (
              <Select id={id} value={d.relation} onChange={(e) => setD({ ...d, relation: e.target.value as GiftRelation })}>
                {GIFT_RELATIONS.map((k) => (
                  <option key={k} value={k}>
                    {GIFT_RELATION_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as GiftKind })}>
                {GIFT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {GIFT_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Montant">{(id) => <MoneyInput id={id} value={d.amount} onChange={(v) => setD({ ...d, amount: v })} />}</Field>
        </FormGrid>
        <Field label="Commentaire">{(id) => <TextInput id={id} value={d.comment} onChange={(e) => setD({ ...d, comment: e.target.value })} placeholder="ex. acte notarié, déclaration 2735" />}</Field>
      </div>
    </Modal>
  );
}
