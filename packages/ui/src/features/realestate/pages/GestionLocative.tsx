import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { NOTICE_LEVEL_LABELS, RENT_GRACE_DAYS, formatEur, leaseArrears, noticeStep, rentLedgerOf, settlingPayment, type Lease, SCHEDULE_KIND_LABELS, addMonths, lotIsActive, parkDebts, parkMonth, parkOccupancy, parkProperties, parkPropertyRows, parkSchedule, parkVacancies, type ParkData, type PropertyReminder, type ScheduleItem } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Select } from "@/shared/components/form";
import { RowActions } from "@/shared/components/RowActions";
import { RentStatusBadge } from "@/features/realestate/components/RentStatusBadge";
import { Pct, Stat, StatGrid } from "@/shared/components/Stat";
import { EmptyRow, Table, Td, Th, Tr } from "@/shared/components/table";
import { Button, Card, CardTitle, PageHeader } from "@/shared/components/ui";
import { ReminderDialog } from "@/features/realestate/dialogs/ReminderDialog";
import { capitalize, formatDate, formatMonth } from "@/shared/lib/numbers";
import { usePortfolio } from "@/shared/lib/portfolio";
import { useMutate } from "@/shared/lib/workspace";

const where = (propertyName: string, lotName: string) => (lotName ? `${propertyName}, ${lotName}` : propertyName);
const BienLink = ({ id, name, lot }: { id: string; name: string; lot: string }) => (
  <Link to={`/immobilier/${id}?onglet=location`} className="font-medium hover:underline">
    {where(name, lot)}
  </Link>
);
const days = (n: number) => `${n} jour${n > 1 ? "s" : ""}`;

/** Tout le parc loué, comme le suit une agence : loyers du mois, impayés, lots vides, occupation et échéances. */
export function GestionLocative() {
  const pf = usePortfolio();
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const [editing, setEditing] = useState<PropertyReminder | "new" | null>(null);
  const saveReminder = useMutate("propertyReminders.upsert", { success: "Rappel marqué fait" });
  const receive = useMutate("rentPayments.upsert", { success: "Loyer reçu" });
  const validateMonth = useMutate("rentPayments.addMany", { success: "Mois validé" });
  const deleteReminder = useMutate("propertyReminders.delete", { success: "Rappel supprimé" });
  if (!pf) return null;
  const { ws } = pf.idx;
  const data: ParkData = ws;
  const today = pf.today;
  const properties = parkProperties(data);
  const header = <PageHeader title="Gestion locative" description="Tout le parc loué : loyers du mois, impayés, lots vides, occupation et dates à venir. Montants du bien entier." />;
  if (properties.length === 0) {
    return (
      <>
        {header}
        <Card>
          <p className="text-sm text-fg-muted">
            Aucun bien en location. Ajoutez un bien « Investissement locatif » dans la page <Link to="/immobilier" className="underline">Immobilier</Link>, puis ses baux.
          </p>
        </Card>
      </>
    );
  }

  const thisMonth = today.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, k) => addMonths(`${thisMonth}-01`, -k).slice(0, 7));
  const month = chosenMonth ?? thisMonth;
  const rentMonth = parkMonth(data, month, today);
  // « Valider le mois » : chaque loyer du mois qui n'est pas soldé, au reste dû.
  const toValidate = rentMonth.lines.map((l) => settlingPayment(l.month, today)).filter((p) => p != null);
  const toValidateTotal = toValidate.reduce((s, p) => s + p.amount, 0);
  const current = month === thisMonth ? rentMonth : parkMonth(data, thisMonth, today);
  const debts = parkDebts(data, today);
  const due = debts.reduce((s, d) => s + d.due, 0);
  const stepLabel = (lease: Lease) => {
    const step = noticeStep(leaseArrears(lease, ws.leaseRents, rentLedgerOf(ws), today), ws.rentNotices, lease.id, ws.params.alerts);
    if (!step) return "—";
    const last = step.sent.at(-1);
    return step.done && last ? `${NOTICE_LEVEL_LABELS[last.level]} le ${formatDate(last.sentOn)}` : `${NOTICE_LEVEL_LABELS[step.level]} à envoyer`;
  };
  const vacancies = parkVacancies(data, today);
  const activeLots = properties.reduce((n, p) => n + Math.max(1, ws.lots.filter((l) => l.propertyId === p.id && lotIsActive(l, p.rentalMode)).length), 0);
  const thisYear = Number(today.slice(0, 4));
  const firstYear = Math.min(thisYear, ...ws.leases.filter((l) => properties.some((p) => p.id === l.propertyId)).map((l) => Number(l.startDate.slice(0, 4))));
  const years = Array.from({ length: thisYear - firstYear + 1 }, (_, k) => thisYear - k);
  const year = chosenYear ?? thisYear;
  const rows = parkPropertyRows(data, year, today);
  const park = parkOccupancy(data, year, today);
  const schedule = parkSchedule(data, today);
  const groups = new Map<string, ScheduleItem[]>();
  for (const item of schedule) {
    const key = item.late ? "retard" : item.date.slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <>
      {header}
      <StatGrid>
        <Stat label="Attendu ce mois-ci" sub={`${capitalize(formatMonth(thisMonth))}, charges comprises`}>
          <span className="text-2xl">
            <Amount value={current.expected} />
          </span>
        </Stat>
        <Stat label="Reçu ce mois-ci" sub="loyers et charges">
          <Amount value={current.received} />
        </Stat>
        <Stat label="Non reçus" sub={debts.length ? `${debts.length} bail${debts.length > 1 ? "x" : ""}, passé ${RENT_GRACE_DAYS} jours` : "aucun"} tone={due > 0 ? "negative" : undefined}>
          <Amount value={due} />
        </Stat>
        <Stat label="Lots vides" sub={`sur ${activeLots} proposé${activeLots > 1 ? "s" : ""} à la location`} tone={vacancies.length ? "warning" : undefined}>
          {vacancies.length}
        </Stat>
      </StatGrid>

      <div className="grid items-start gap-5 @3xl:grid-cols-2">
        <Card>
          <CardTitle
            hint={
              <Select aria-label="Mois des loyers" value={month} onChange={(e) => setChosenMonth(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {capitalize(formatMonth(m))}
                  </option>
                ))}
              </Select>
            }
          >
            Loyers du mois
          </CardTitle>
          {toValidate.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span>
                {toValidate.length} loyer{toValidate.length > 1 ? "s" : ""} à pointer (<Amount value={toValidateTotal} />).
              </span>
              <Button
                className="h-8"
                variant="primary"
                disabled={validateMonth.isPending}
                onClick={() => confirm(`Valider ${formatMonth(month)} : marquer reçus ${toValidate.length} loyer${toValidate.length > 1 ? "s" : ""} pour ${formatEur(toValidateTotal)} ?`) && validateMonth.mutate({ payments: toValidate })}
              >
                Valider le mois
              </Button>
            </div>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th align="right">Attendu</Th>
                <Th align="right">Reçu</Th>
                <Th>État</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rentMonth.lines.length === 0 && <EmptyRow cols={5}>Aucun loyer attendu ce mois-là.</EmptyRow>}
              {rentMonth.lines.map((l) => (
                <Tr key={l.lease.id}>
                  <Td>
                    <BienLink id={l.property.id} name={l.property.name} lot={l.lotName} />
                    {l.renters && <div className="text-xs text-fg-faint">{l.renters}</div>}
                  </Td>
                  <Td align="right"><Amount value={l.month.due} /></Td>
                  <Td align="right"><Amount value={l.month.paid} /></Td>
                  <Td><RentStatusBadge status={l.month.status} /></Td>
                  <Td align="right">
                    {settlingPayment(l.month, today) && (
                      <Button className="h-7 px-2 text-xs" variant="ghost" disabled={receive.isPending} aria-label={`Marquer reçu : ${where(l.property.name, l.lotName)}`} onClick={() => receive.mutate(settlingPayment(l.month, today)!)}>
                        Reçu
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
            {rentMonth.lines.length > 1 && (
              <tfoot>
                <tr className="border-t border-line font-medium">
                  <Td>Total</Td>
                  <Td align="right"><Amount value={rentMonth.expected} /></Td>
                  <Td align="right"><Amount value={rentMonth.received} /></Td>
                  <Td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </Table>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardTitle hint={`passé ${RENT_GRACE_DAYS} jours après l'échéance`}>Loyers non reçus</CardTitle>
            {debts.length === 0 ? (
              <p className="text-sm text-fg-muted">Tous les loyers échus sont pointés.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Bail</Th>
                    <Th>Mois</Th>
                    <Th>Relance</Th>
                    <Th align="right">Dû</Th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => (
                    <Tr key={d.lease.id}>
                      <Td>
                        <BienLink id={d.property.id} name={d.property.name} lot={d.lotName} />
                        {d.renters && <div className="text-xs text-fg-faint">{d.renters}</div>}
                      </Td>
                      <Td>{d.months.length === 1 ? capitalize(formatMonth(d.months[0])) : `${d.months.length} mois, depuis ${formatMonth(d.months[0])}`}</Td>
                      <Td>{stepLabel(d.lease)}</Td>
                      <Td align="right" className="text-negative"><Amount value={d.due} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardTitle>Lots vides</CardTitle>
            {vacancies.length === 0 ? (
              <p className="text-sm text-fg-muted">Tous les lots proposés à la location sont loués.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Lot</Th>
                    <Th>Vide depuis</Th>
                    <Th align="right">Loyers perdus</Th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map((v) => (
                    <Tr key={v.lot.id}>
                      <Td>
                        <BienLink id={v.property.id} name={v.property.name} lot={v.lot.name} />
                        {v.nextStart && <div className="text-xs text-fg-faint">Prochain bail le {formatDate(v.nextStart)}</div>}
                      </Td>
                      <Td>{v.since ? `${formatDate(v.since)}${v.days != null ? ` (${days(v.days)})` : ""}` : "Jamais loué"}</Td>
                      <Td align="right">{v.lost != null ? <Amount value={v.lost} /> : "—"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-2 text-xs text-fg-faint">Loyers perdus : au loyer espéré du lot, sinon à son dernier loyer.</p>
          </Card>
        </div>

        <Card className="@3xl:col-span-2">
          <CardTitle
            hint={
              years.length > 1 && (
                <Select aria-label="Année de l'occupation" value={year} onChange={(e) => setChosenYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
              )
            }
          >
            Biens
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Bien</Th>
                <Th align="right">Lots loués</Th>
                <Th align="right">Loyer du mois</Th>
                <Th align="right" title="Jours loués ÷ jours proposés à la location">Occupation</Th>
                <Th align="right" title="Loyers reçus ÷ loyers possibles">Loyers reçus</Th>
                <Th align="right">Rendement brut</Th>
                <Th align="right">Rendement net</Th>
                <Th align="right">Relocation</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.property.id}>
                  <Td><BienLink id={r.property.id} name={r.property.name} lot="" /></Td>
                  <Td align="right">{r.rentedLots} / {r.lots}</Td>
                  <Td align="right"><Amount value={r.monthlyRent} /></Td>
                  <Td align="right"><Pct value={r.occupancy.physical} digits={0} /></Td>
                  <Td align="right"><Pct value={r.occupancy.financial} digits={0} /></Td>
                  <Td align="right"><Pct value={r.grossYield} /></Td>
                  <Td align="right"><Pct value={r.netYield} /></Td>
                  <Td align="right">{r.averageRelocationDays == null ? "—" : days(r.averageRelocationDays)}</Td>
                </Tr>
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t border-line font-medium">
                  <Td>Tout le parc</Td>
                  <Td align="right">{rows.reduce((s, r) => s + r.rentedLots, 0)} / {rows.reduce((s, r) => s + r.lots, 0)}</Td>
                  <Td align="right"><Amount value={rows.reduce((s, r) => s + r.monthlyRent, 0)} /></Td>
                  <Td align="right"><Pct value={park.physical} digits={0} /></Td>
                  <Td align="right"><Pct value={park.financial} digits={0} /></Td>
                  <Td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </Table>
          <p className="mt-2 text-xs text-fg-faint">
            Occupation : jours loués sur les jours où chaque lot était proposé, en {year}. Loyers reçus : ce qui a été encaissé sur ce que les lots pouvaient rapporter, vides compris. Rendements : sur la dernière année complète, à la part détenue. Relocation : temps moyen entre deux baux d'un même lot.
          </p>
        </Card>

        <Card className="@3xl:col-span-2">
          <CardTitle
            hint={
              <Button className="h-8" onClick={() => setEditing("new")}>
                <Plus size={14} /> Nouveau rappel
              </Button>
            }
          >
            À venir
          </CardTitle>
          {schedule.length === 0 && <p className="text-sm text-fg-muted">Rien de prévu dans les douze prochains mois.</p>}
          <div className="space-y-4">
            {[...groups].map(([key, items]) => (
              <div key={key}>
                <div className={`mb-1 text-xs font-medium ${key === "retard" ? "text-negative" : "text-fg-muted"}`}>{key === "retard" ? "En retard" : capitalize(formatMonth(key))}</div>
                <Table>
                  <tbody>
                    {items.map((i) => (
                      <Tr key={i.key} className="group">
                        <Td className="w-28 whitespace-nowrap">{formatDate(i.date)}</Td>
                        <Td>
                          <span className="font-medium">{i.title}</span>
                          <div className="text-xs text-fg-faint">
                            <BienLink id={i.property.id} name={i.property.name} lot={i.lotName} /> · {SCHEDULE_KIND_LABELS[i.kind]}
                            {i.reminder?.yearly && " · chaque année"}
                          </div>
                        </Td>
                        <Td align="right">{i.amount != null && <Amount value={i.amount} />}</Td>
                        <Td className="w-36" align="right">
                          {i.reminder && (
                            <div className="flex items-center justify-end gap-1">
                              {!i.reminder.yearly && (
                                <Button className="h-7 px-2 text-xs" variant="ghost" onClick={() => saveReminder.mutate({ ...i.reminder!, doneOn: today })}>
                                  Fait
                                </Button>
                              )}
                              <RowActions onEdit={() => setEditing(i.reminder)} onDelete={() => confirm(`Supprimer le rappel « ${i.reminder!.label} » ?`) && deleteReminder.mutate({ id: i.reminder!.id })} />
                            </div>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <ReminderDialog open={editing !== null} properties={properties} reminder={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </>
  );
}
