import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  DEBT_SOURCES,
  LOAN_PREPAYMENT_MODE_LABELS,
  LOAN_PREPAYMENT_MODES,
  MAX_EFFORT_RATE,
  comparePrepayment,
  debtOverview,
  formatPct,
  maxPrepaymentFee,
  placementPresets,
  type LoanPrepaymentMode,
} from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, MoneyInput, PercentInput, Select } from "@/components/form";
import { Pct } from "@/components/Stat";
import { Table, Td, Th, Tr } from "@/components/table";
import { Card, CardTitle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

/** Part du patrimoine financée à crédit, part de chaque bien encore due, taux d'effort et coût réel des crédits. */
export function DebtWeightCard() {
  const pf = usePortfolio();
  const o = useMemo(() => (pf ? debtOverview(pf.state, pf.data.properties ?? [], pf.data.params) : null), [pf]);
  if (!pf || !o || o.loans.length === 0) return null;
  const over = o.effortRate != null && o.effortRate > MAX_EFFORT_RATE;
  return (
    <Card className="mt-5">
      <CardTitle hint="part à votre charge">Poids des crédits</CardTitle>
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm @2xl:grid-cols-3">
        <div>
          <dt className="text-fg-faint">Patrimoine financé à crédit</dt>
          <dd className="font-medium">
            <Pct value={o.debtRatio} />{" "}
            <span className="text-xs font-normal text-fg-faint">
              (<Amount value={o.debts} compact /> sur <Amount value={o.assets} compact />)
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-fg-faint">Taux d'effort</dt>
          <dd className={cn("font-medium", over && "text-negative")}>
            {o.effortRate == null ? (
              <Link to="/parametres" className="text-xs font-normal underline">
                Indiquez vos revenus nets (Paramètres › Plan)
              </Link>
            ) : (
              <>
                <Pct value={o.effortRate} /> <span className="text-xs font-normal text-fg-faint">des revenus nets ; les banques prêtent jusqu'à 35 %</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-fg-faint">Mensualités</dt>
          <dd className="font-medium">
            <Amount value={o.monthly} compact /> <span className="text-xs font-normal text-fg-faint">assurance comprise</span>
          </dd>
        </div>
      </dl>
      {o.properties.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-medium text-fg-muted">Part de chaque bien encore due à la banque</div>
          <ul className="space-y-1.5 text-sm">
            {o.properties.map((x) => (
              <li key={x.property.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                <span className="truncate">{x.property.name}</span>
                <div className="h-2 rounded-full bg-surface-3" role="img" aria-label={`${Math.round((x.ratio ?? 0) * 100)} % encore dû`}>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((x.ratio ?? 0) * 100))}%` }} />
                </div>
                <span className="text-xs text-fg-muted">
                  <Pct value={x.ratio} /> · <Amount value={x.debt} compact /> sur <Amount value={x.value} compact />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Crédit</Th>
            <Th align="right">Taux</Th>
            <Th align="right">Taux assurance comprise</Th>
            <Th align="right">Intérêts restants</Th>
            <Th align="right">Assurance restante</Th>
          </tr>
        </thead>
        <tbody>
          {o.loans.map((c) => (
            <Tr key={c.loan.id}>
              <Td className="font-medium">{c.loan.name}</Td>
              <Td align="right">
                <Pct value={c.loan.rate} digits={2} />
              </Td>
              <Td align="right">
                <Pct value={c.rateWithInsurance} digits={2} />
              </Td>
              <Td align="right">
                <Amount value={c.remainingInterest} compact />
              </Td>
              <Td align="right">
                <Amount value={c.remainingInsurance} compact />
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-fg-faint">Le taux assurance comprise est celui qui égale le capital restant dû aux échéances restantes, assurance incluse : c'est ce que rapporte, sans risque, chaque euro remboursé par avance.</p>
    </Card>
  );
}

/** Rembourser par avance ou placer la même somme : comparaison à la fin prévue du crédit. */
export function PrepaymentCard() {
  const pf = usePortfolio();
  const loans = useMemo(() => (pf?.state.netWorth.loans ?? []).filter((l) => l.paymentsLeft > 0), [pf]);
  const presets = useMemo(() => (pf ? placementPresets(pf.data.params) : []), [pf]);
  const [loanId, setLoanId] = useState<string>("");
  const [amount, setAmount] = useState<number | null>(10_000);
  const [mode, setMode] = useState<LoanPrepaymentMode>("duree");
  const [fee, setFee] = useState<number | null>(null);
  const [preset, setPreset] = useState("fondsEuros");
  const [rate, setRate] = useState<number | null>(null);
  const loan = loans.find((l) => l.loan.id === loanId)?.loan ?? loans[0]?.loan ?? null;
  const today = pf?.today ?? "";
  const legalFee = loan && amount ? maxPrepaymentFee(loan, amount, today) : null;
  const placementRate = rate ?? presets.find((p) => p.key === preset)?.rate ?? 0;
  // L'indemnité suit le plafond légal tant qu'elle n'a pas été saisie.
  useEffect(() => setFee(null), [loanId, amount]);
  const result = useMemo(() => (loan && amount && amount > 0 ? comparePrepayment({ loan, date: today, amount, mode, fee: fee ?? legalFee ?? 0, placementRate }) : null), [loan, amount, mode, fee, legalFee, placementRate, today]);
  if (!pf || loans.length === 0) return null;

  return (
    <Card className="mt-5">
      <CardTitle hint="à la fin prévue du crédit">Rembourser par avance ou placer ?</CardTitle>
      <FormGrid cols={3}>
        <Field label="Crédit">
          {(id) => (
            <Select id={id} value={loan?.id ?? ""} onChange={(e) => setLoanId(e.target.value)}>
              {loans.map((l) => (
                <option key={l.loan.id} value={l.loan.id}>
                  {`${l.loan.name} (${formatPct(l.loan.rate)})`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Somme disponible" help="Pour le crédit entier, comme vous la verseriez à la banque.">
          {(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}
        </Field>
        <Field label="Après le remboursement">
          {(id) => (
            <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as LoanPrepaymentMode)}>
              {LOAN_PREPAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {LOAN_PREPAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Indemnité de la banque" help={legalFee == null ? "Selon votre contrat." : `Au plus ${legalFee.toLocaleString("fr-FR")} € selon la loi ; souvent 0 € si le contrat l'exclut.`}>
          {(id) => <MoneyInput id={id} value={fee ?? legalFee} onChange={setFee} />}
        </Field>
        <Field label="Placement de comparaison">
          {(id) => (
            <Select
              id={id}
              value={rate == null ? preset : "autre"}
              onChange={(e) => {
                if (e.target.value === "autre") setRate(placementRate);
                else {
                  setPreset(e.target.value);
                  setRate(null);
                }
              }}
            >
              {presets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="autre">Autre taux</option>
            </Select>
          )}
        </Field>
        <Field label="Rendement net par an" help="Après impôts. Prérempli d'après les hypothèses du plan.">
          {(id) => <PercentInput id={id} value={placementRate} onChange={(v) => setRate(v ?? 0)} />}
        </Field>
      </FormGrid>

      {result && loan && (
        <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface-2/40 p-4 text-sm">
          <p className="text-base font-medium">
            {Math.abs(result.advantage) < 1 ? (
              "Les deux options se valent."
            ) : result.advantage > 0 ? (
              <>
                Rembourser vous laisse environ <Amount value={result.advantage} /> de plus au {formatDate(result.horizon)}.
              </>
            ) : (
              <>
                Placer vous laisse environ <Amount value={-result.advantage} /> de plus au {formatDate(result.horizon)}.
              </>
            )}
          </p>
          <p>
            <b>Rembourser :</b> <Amount value={result.savedInterest} /> d'intérêts et <Amount value={result.savedInsurance} /> d'assurance économisés
            {mode === "duree" ? (
              <>
                , fin du crédit le {formatDate(result.newEndDate)} ({result.monthsSaved} mois de moins)
              </>
            ) : (
              <>
                , mensualité ramenée à <Amount value={result.newMonthly} />
              </>
            )}
            . Les échéances libérées, placées au même rendement, font <Amount value={result.repayWealth} />.
          </p>
          <p>
            <b>Placer :</b> la même somme, indemnité comprise, placée à <Pct value={placementRate} digits={2} /> jusqu'au {formatDate(result.horizon)}, fait <Amount value={result.investWealth} />.
          </p>
          {result.breakEvenRate != null && (
            <p className="text-fg-muted">
              Placer devient plus intéressant au-delà de <Pct value={result.breakEvenRate} digits={2} /> net par an.
            </p>
          )}
          <p className="text-xs text-fg-faint">
            Rembourser rapporte un taux certain ; un placement qui rapporte plus est aussi plus risqué. L'argent remboursé ne revient pas : gardez de quoi faire face aux imprévus. Les intérêts déductibles d'un bien loué ne sont pas pris en compte. Sources :{" "}
            {DEBT_SOURCES.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
                  {s.label}
                </a>
              </span>
            ))}
            .
          </p>
        </div>
      )}
    </Card>
  );
}
