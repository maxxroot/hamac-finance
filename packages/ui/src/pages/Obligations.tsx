import { ShoppingCart, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router";
import { BOND_KIND_LABELS, maturityLabel, nextCoupon, type PositionState } from "@hamac/core";
import { PositionEvolution } from "@/components/AccountEvolution";
import { AddTransactionButton, EmptyEnvelope } from "@/components/TransactionButton";
import { Amount } from "@/components/Amount";
import { Field, MoneyInput, NumberInput, TextInput } from "@/components/form";
import { Movements } from "@/components/Movements";
import { Notice, Pct, Stat, StatGrid } from "@/components/Stat";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, useExpandedRow } from "@/components/table";
import { Badge, Button, Card, CardTitle, PageHeader } from "@/components/ui";
import { Onboarding } from "@/pages/Onboarding";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";
import { useMutate } from "@/lib/workspace";
import { SortTh, useSortable } from "@/lib/sort";

export function Obligations() {
  const pf = usePortfolio();
  const { isOpen, rowProps } = useExpandedRow();
  const [label, setLabel] = useState("");
  const [targetYear, setTargetYear] = useState<number | null>(null);
  const [nominal, setNominal] = useState<number | null>(null);
  const addPlan = useMutate("bondPlans.upsert", { success: "Ligne prévue ajoutée" });
  const delPlan = useMutate("bondPlans.delete");
  const heldBonds = useMemo(() => (pf ? pf.state.accounts.flatMap((a) => a.positions.filter((p) => p.bond)) : []), [pf]);
  const ladder = useSortable(
    heldBonds,
    {
      nom: (p) => p.asset.name,
      echeance: (p) => p.bond!.terms.maturityDate,
      coupon: (p) => p.bond!.terms.couponRate,
      nominal: (p) => p.bond!.nominal,
      cout: (p) => p.cost,
      valeur: (p) => p.value,
      pv: (p) => p.gainPct,
      ytm: (p) => p.bond!.ytm,
      age: (p) => p.bond!.ageAtMaturity,
      reste: (p) => p.bond!.yearsLeft,
    },
    { key: "echeance", dir: "asc" },
  );
  if (!pf) return null;
  if (pf.idx.ws.accounts.length === 0) return <Onboarding />;
  const { state, idx, data } = pf;

  const holders = state.accounts.filter((a) => a.positions.some((p) => p.bond) || a.maturedBonds.length || a.account.kind === "cto");
  const held: PositionState[] = holders.flatMap((a) => a.positions.filter((p) => p.bond));
  const matured: PositionState[] = holders.flatMap((a) => a.maturedBonds);
  const ctos = state.accounts.filter((a) => a.account.kind === "cto" && !a.account.archived);
  const cash = ctos.reduce((s, a) => s + a.cash, 0);
  const nominalHeld = held.reduce((s, p) => s + (p.bond?.nominal ?? 0), 0);
  const costHeld = held.reduce((s, p) => s + p.cost, 0);
  const coupons = held.reduce((s, p) => s + (p.bond?.annualCoupon ?? 0), 0);
  const next = held.map((p) => p.bond!.terms.maturityDate).sort()[0];
  const ytmAvg = costHeld > 0 ? held.reduce((s, p) => s + (p.bond?.ytm ?? 0) * p.cost, 0) / costHeld : null;
  const cto = ctos[0];

  // Coupons qui tombent à la prochaine date : plusieurs lignes peuvent la partager.
  const nextCoupons = heldBonds.flatMap((p) => {
    const c = nextCoupon(p.bond!.terms, pf.today);
    return c ? [{ date: c.date, amount: c.amount * p.bond!.nominal }] : [];
  });
  const firstDate = nextCoupons.map((c) => c.date).sort()[0];
  const upcoming = firstDate ? { date: firstDate, amount: nextCoupons.filter((c) => c.date === firstDate).reduce((t, c) => t + c.amount, 0) } : null;

  return (
    <>
      <PageHeader
        title="Obligations"
        description="Échelle d'obligations à taux fixe gardées jusqu'à l'échéance : valeur, coupons et rendement calculés, aucun cours nécessaire."
        actions={cto && <AddTransactionButton accountId={cto.account.id} type="achat" assetKinds={["obligation"]} accountKinds={["cto", "assurance_vie"]} />}
      />
      {!cto && (
        <div className="mb-6">
          <EmptyEnvelope kind="cto" label="Ajouter un compte-titres">
            Les obligations se détiennent dans un compte-titres (ou une assurance-vie). Créez d'abord le compte, rattaché à son courtier.
          </EmptyEnvelope>
        </div>
      )}
      <StatGrid>
        <Stat label="Nominal détenu" sub={<>coût d'achat <Amount value={costHeld} compact /></>}>
          <Amount value={nominalHeld} compact />
        </Stat>
        <Stat label="Coupons annuels bruts" sub={<>rendement à l'échéance moyen <Pct value={ytmAvg} /></>}>
          <Amount value={coupons} compact />
        </Stat>
        <Stat
          label="Prochaine échéance"
          sub={
            upcoming && (
              <>
                coupon le {formatDate(upcoming.date)} : <Amount value={upcoming.amount} compact /> brut
              </>
            )
          }
        >
          {next ? formatDate(next) : "—"}
        </Stat>
        <Stat label="Espèces en attente" tone={cash >= data.params.alerts.ctoCashThreshold ? "warning" : undefined} sub={cash >= data.params.alerts.ctoCashThreshold ? "De quoi acheter une ligne" : "Compte-titres"}>
          <Amount value={cash} compact />
        </Stat>
      </StatGrid>

      <Table className="mb-6">
        <thead>
          <tr>
            <SortTh {...ladder.by("nom")}>Obligation</SortTh>
            <SortTh {...ladder.by("echeance")}>Échéance</SortTh>
            <SortTh {...ladder.by("coupon")} align="right">Coupon</SortTh>
            <SortTh {...ladder.by("nominal")} align="right">Nominal</SortTh>
            <SortTh {...ladder.by("cout")} align="right">Coût (frais compris)</SortTh>
            <SortTh {...ladder.by("valeur")} align="right">Valeur</SortTh>
            <SortTh {...ladder.by("pv")} align="right">Plus-value (%)</SortTh>
            <SortTh {...ladder.by("ytm")} align="right">Rendement à l'échéance</SortTh>
            <SortTh {...ladder.by("age")} align="right">Âge à l'échéance</SortTh>
            <SortTh {...ladder.by("reste")} align="right">Reste</SortTh>
            <Th>Statut</Th>
          </tr>
        </thead>
        <tbody>
          {held.length + matured.length + idx.ws.bondPlans.length === 0 && <EmptyRow cols={11}>Aucune obligation. Prévoyez votre échelle ci-dessous, puis saisissez les achats dans le journal.</EmptyRow>}
          {ladder.sorted.map((p) => (
              <Fragment key={`${p.accountId}-${p.asset.id}`}>
              <Tr {...rowProps(`${p.accountId}-${p.asset.id}`)}>
                <Td className="font-medium">
                  <ExpandButton open={isOpen(`${p.accountId}-${p.asset.id}`)} label={p.asset.name} />
                  {p.asset.name}
                  <div className="text-xs font-normal text-fg-faint">
                    {p.asset.bondKind ? BOND_KIND_LABELS[p.asset.bondKind] : "Obligation"}
                    {p.asset.isin && <span className="font-mono"> · {p.asset.isin}</span>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">
                  {maturityLabel(p.bond!.terms.maturityDate)}
                  <div className="text-[11px] text-fg-faint">le {formatDate(p.bond!.terms.maturityDate)}</div>
                </Td>
                <Td align="right">
                  <Pct value={p.bond!.terms.couponRate} digits={2} />
                  <NextCouponLine p={p} today={pf.today} />
                </Td>
                <Td align="right">
                  <Amount value={p.bond!.nominal} compact />
                </Td>
                <Td align="right">
                  <Amount value={p.cost} />
                </Td>
                <Td align="right" title={p.priceUsed === "modele" ? "Prix d'achat amorti vers 100 % + coupon couru" : "Cours saisi"}>
                  <Amount value={p.value} />
                </Td>
                <Td align="right">
                  <Amount value={p.gain} signed compact />
                  <div className="text-[11px]">
                    <Pct value={p.gainPct} signed digits={2} />
                  </div>
                </Td>
                <Td align="right">
                  <Pct value={p.bond!.ytm} digits={2} />
                </Td>
                <Td align="right">{p.bond!.ageAtMaturity} ans</Td>
                <Td align="right">{p.bond!.yearsLeft.toFixed(1).replace(".", ",")} ans</Td>
                <Td>
                  <Badge tone="positive">Détenue</Badge>
                </Td>
              </Tr>
              {isOpen(`${p.accountId}-${p.asset.id}`) && (
                <DetailRow cols={11}>
                  <PositionEvolution accountId={p.accountId} assetId={p.asset.id} />
                </DetailRow>
              )}
              </Fragment>
            ))}
          {idx.ws.bondPlans.map((b) => (
            <Tr key={b.id} className="group">
              <Td className="font-medium">
                {b.label}
                {b.comment && <div className="text-xs font-normal text-fg-faint">{b.comment}</div>}
              </Td>
              <Td className="text-fg-muted">vers {b.targetYear}</Td>
              <Td />
              <Td align="right">
                <Amount value={b.nominal} compact />
              </Td>
              <Td />
              <Td />
              <Td />
              <Td />
              <Td align="right">{b.targetYear - data.params.profile.birthYear} ans</Td>
              <Td />
              <Td>
                <div className="flex items-center gap-2">
                  <Badge tone="accent">Prévue</Badge>
                  {cto && (
                    <Link to={`/journal?nouveau=1&compte=${cto.account.id}&type=achat&titre=nouveau`} className="text-fg-muted hover:text-accent" title="Saisir l'achat">
                      <ShoppingCart size={14} />
                    </Link>
                  )}
                  <button className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-negative" onClick={() => delPlan.mutate({ id: b.id })} aria-label="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
          {matured.map((p) => (
            <Tr key={`m-${p.accountId}-${p.asset.id}`} className="text-fg-faint">
              <Td className="line-through">{p.asset.name}</Td>
              <Td>{formatDate(p.asset.maturityDate)}</Td>
              <Td align="right">
                <Pct value={p.asset.couponRate} digits={2} />
              </Td>
              <Td />
              <Td />
              <Td />
              <Td align="right" title="Gain réalisé au remboursement">
                <Amount value={p.realizedGain} signed />
              </Td>
              <Td />
              <Td />
              <Td />
              <Td>
                <Badge>Échue</Badge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Prévoir une ligne de l'échelle</CardTitle>
          <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <Field label="Libellé">{(id) => <TextInput id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. À choisir : échéance vers 2034" />}</Field>
            <Field label="Échéance visée">{(id) => <NumberInput id={id} decimals={0} grouping={false} value={targetYear} onChange={setTargetYear} />}</Field>
            <Field label="Nominal">{(id) => <MoneyInput id={id} value={nominal} onChange={setNominal} />}</Field>
            <Button
              disabled={!label.trim() || !targetYear || !nominal}
              onClick={() =>
                targetYear &&
                nominal &&
                addPlan.mutate({ accountId: cto?.account.id ?? null, label, targetYear, nominal }, { onSuccess: () => (setLabel(""), setTargetYear(null), setNominal(null)) })
              }
            >
              Ajouter
            </Button>
          </div>
        </Card>
        <Notice>
          <b className="text-fg">Coupon ≠ rendement.</b> Achetée sous le pair, une obligation rapporte plus que son coupon, car l'émetteur rembourse 100 % à l'échéance. À l'échéance : avant l'âge de sécurisation, racheter une
          ligne plus longue ; après, transférer vers le fonds euros. Les coupons se saisissent dans le journal (Intérêts / coupon).
        </Notice>
      </div>
      {ctos.length > 0 && <Movements accountIds={ctos.map((c) => c.account.id)} limit={15} title="Mouvements (obligations et espèces)" type="achat" assetKinds={["obligation"]} accountKinds={["cto", "assurance_vie"]} />}
      <p className={cn("mt-2 text-xs text-fg-faint", !held.length && "hidden")}>Valeur « détenue jusqu'à l'échéance » : prix d'achat amorti linéairement vers 100 % + coupon couru. Un cours saisi à la main la remplace.</p>
    </>
  );
}

/** Date et montant brut du prochain coupon d'une ligne. */
function NextCouponLine({ p, today }: { p: PositionState; today: string }) {
  const c = nextCoupon(p.bond!.terms, today);
  if (!c) return null;
  return (
    <div className="text-[11px] whitespace-nowrap text-fg-faint">
      le {formatDate(c.date)} · <Amount value={c.amount * p.bond!.nominal} /> brut
    </div>
  );
}
