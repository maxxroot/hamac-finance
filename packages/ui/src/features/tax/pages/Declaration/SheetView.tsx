import { useMemo, useState } from "react";
import { compareWithStatement, type FiscalYearRules, type TaxSheet, type TaxStatementAmount } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { MoneyInput } from "@/shared/components/form";
import { Notice } from "@/shared/components/Stat";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Button } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { useMutate } from "@/shared/lib/workspace";
import { Status, Block, BoxCell, Notes } from "./_parts";

/** Montants lus sur le document de l'établissement, comparés au récapitulatif de Hamac. */
export function StatementCheck({ sheet, rules, statements }: { sheet: TaxSheet; rules: FiscalYearRules; statements: readonly TaxStatementAmount[] }) {
  const save = useMutate("taxStatements.save", { success: "Montants enregistrés" });
  const saved = useMemo(() => new Map(statements.filter((x) => x.institutionId === sheet.institutionId && x.year === rules.incomeYear).map((x) => [x.box, x.amount])), [statements, sheet.institutionId, rules.incomeYear]);
  const [draft, setDraft] = useState<ReadonlyMap<string, number | null>>(new Map());
  const official = new Map(saved);
  for (const [box, amount] of draft) {
    if (amount == null) official.delete(box);
    else official.set(box, amount);
  }
  const rows = compareWithStatement(sheet, rules, official);
  if (!sheet.institutionId || rows.length === 0) return null;
  const persist = () => save.mutate({ institutionId: sheet.institutionId!, year: rules.incomeYear, amounts: rows.flatMap((r) => (r.official == null ? [] : [{ box: r.rule.box, amount: r.official }])) }, { onSuccess: () => setDraft(new Map()) });
  return (
    // Sur papier, le bloc n'apparaît que s'il compare réellement quelque chose.
    <Block title="Comparer avec le document de l'établissement" className={rows.some((r) => r.official != null) ? undefined : "no-print"}>
      <p className="mb-3 text-sm text-fg-muted">Recopiez les montants de son document fiscal : l'écart apparaît case par case.</p>
      <Table>
        <thead>
          <tr>
            <Th>Case</Th>
            <Th>Libellé</Th>
            <Th align="right">Hamac</Th>
            <Th align="right">Document</Th>
            <Th align="right">Écart</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Tr key={r.key}>
              <BoxCell line={r} covered={rules.covered} />
              <Td>{r.rule.label}</Td>
              <Td align="right">
                <Amount value={r.hamac} />
              </Td>
              <Td align="right" className="w-40">
                <MoneyInput aria-label={`Document, case ${r.rule.box}`} value={r.official} onChange={(v) => setDraft(new Map(draft).set(r.rule.box, v))} />
              </Td>
              <Td align="right" className={r.gap != null && Math.abs(r.gap) >= 1 ? "font-medium text-warning" : undefined}>
                {r.gap == null ? "—" : <Amount value={r.gap} />}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <div className="no-print mt-3 flex justify-end">
        <Button variant="primary" disabled={draft.size === 0 || save.isPending} onClick={persist}>
          Enregistrer les montants
        </Button>
      </div>
    </Block>
  );
}

export function SheetView({ sheet, rules, statements }: { sheet: TaxSheet; rules: FiscalYearRules; statements: readonly TaxStatementAmount[] }) {
  const empty = sheet.lines.length === 0 && sheet.disposals.length === 0 && sheet.cryptoSales.length === 0;
  return (
    <>
      <Block title="Comptes concernés">
        <p className="text-sm">{sheet.accounts.map((a) => a.name).join(", ")}</p>
      </Block>
      {empty && <Notice>Aucun revenu ni aucune cession pour cette année sur cet établissement.</Notice>}

      {sheet.lines.length > 0 && (
        <Block title="Cases à reporter">
          <Table>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Formulaire</Th>
                <Th>Libellé</Th>
                <Th align="right">Montant</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((l) => (
                <Tr key={l.key}>
                  <BoxCell line={l} covered={rules.covered} />
                  <Td>{l.rule.form}</Td>
                  <Td>
                    {l.rule.label}
                    <Notes notes={l.notes} />
                  </Td>
                  <Td align="right" className="font-medium">
                    <Amount value={l.amount} />
                  </Td>
                  <Td>
                    <Status status={l.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.incomes.length > 0 && (
        <Block title="Détail des revenus">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Compte</Th>
                <Th>Nature</Th>
                <Th align="right">Reçu</Th>
                <Th align="right">Brut</Th>
                <Th align="right">Acompte</Th>
                <Th align="right">Prél. sociaux</Th>
                <Th align="right">Retenue étrangère</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.incomes.map((i) => (
                <Tr key={i.tx.id}>
                  <Td className="whitespace-nowrap">{formatDate(i.tx.date)}</Td>
                  <Td>{i.accountName}</Td>
                  <Td>
                    {i.tx.type === "dividende" ? "Dividende" : "Intérêts"}
                    {i.assetName ? ` · ${i.assetName}` : ""}
                    {i.note && <Notes notes={[i.note]} />}
                  </Td>
                  <Td align="right">
                    <Amount value={i.tx.amount} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.gross} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.incomeTax} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.social} />
                  </Td>
                  <Td align="right">
                    <Amount value={i.foreign} />
                  </Td>
                  <Td>
                    <Status status={i.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.disposals.length > 0 && (
        <Block title="Cessions de titres (détail pour la 2074)">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Titre</Th>
                <Th align="right">Quantité</Th>
                <Th align="right">Prix de cession net</Th>
                <Th align="right">Prix de revient</Th>
                <Th align="right">Plus ou moins-value</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.disposals.map((d) => (
                <Tr key={`${d.txId ?? d.assetId}-${d.date}`}>
                  <Td className="whitespace-nowrap">{formatDate(d.date)}</Td>
                  <Td>
                    {d.assetName}
                    {d.note && <Notes notes={[d.note]} />}
                  </Td>
                  <Td align="right">{d.quantity.toLocaleString("fr-FR")}</Td>
                  <Td align="right">
                    <Amount value={d.proceeds} />
                  </Td>
                  <Td align="right">
                    <Amount value={d.cost} />
                  </Td>
                  <Td align="right">
                    <Amount value={d.gain} signed />
                  </Td>
                  <Td>
                    <Status status={d.status} />
                  </Td>
                </Tr>
              ))}
              <tr className="bg-surface-2/60 font-medium">
                <Td colSpan={5}>Résultat de cet établissement, avant compensation avec les autres</Td>
                <Td align="right">
                  <Amount value={sheet.securities.net} signed />
                </Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        </Block>
      )}

      {sheet.cryptoSales.length > 0 && (
        <Block title="Cessions d'actifs numériques (détail pour la 2086)">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Actif</Th>
                <Th align="right">Prix de cession</Th>
                <Th align="right">Frais</Th>
                <Th align="right">Valeur globale du portefeuille</Th>
                <Th align="right">Prix d'acquisition imputé</Th>
                <Th align="right">Plus ou moins-value</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.cryptoSales.map((c) => (
                <Tr key={c.sale.tx.id}>
                  <Td className="whitespace-nowrap">{formatDate(c.sale.date)}</Td>
                  <Td>{c.assetName}</Td>
                  <Td align="right">
                    <Amount value={c.sale.gross} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.fee} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.portfolioValue} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.attributed} />
                  </Td>
                  <Td align="right">
                    <Amount value={c.sale.gain} signed />
                  </Td>
                  <Td>
                    <Status status={c.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-fg-faint">Le gain imposable se calcule sur le portefeuille global, toutes plateformes : voir le récapitulatif complet.</p>
        </Block>
      )}

      <StatementCheck sheet={sheet} rules={rules} statements={statements} />
    </>
  );
}
