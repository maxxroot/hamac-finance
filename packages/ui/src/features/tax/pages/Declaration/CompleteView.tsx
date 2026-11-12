import { MODE_LABELS, type ConsolidatedLine, type TaxReport, type TaxSheet } from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Status, Block, BoxCell, Notes, Row } from "./_parts";

export function CompleteView({ report, onOpen }: { report: TaxReport; onOpen: (key: string) => void }) {
  const { lines, sheets, securities, crypto, others, reminders, rules } = report;
  const incomeOf = (s: TaxSheet) => s.lines.filter((l) => l.key === "dividendes" || l.key === "interets" || l.key === "crowdlending").reduce((t, l) => t + l.amount, 0);
  const prepaid = (s: TaxSheet) => s.lines.find((l) => l.key === "acompte")?.amount ?? 0;
  return (
    <>
      <Block title="Cases à reporter">
        {lines.length === 0 ? (
          <p className="text-sm text-fg-muted">Aucun montant à reporter pour cette année dans les comptes suivis.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Formulaire</Th>
                <Th>Libellé</Th>
                <Th align="right">À saisir</Th>
                <Th align="right">À contrôler avec l'IFU</Th>
                <Th align="right">Total</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l: ConsolidatedLine) => (
                <Tr key={l.key}>
                  <BoxCell line={l} covered={rules.covered} />
                  <Td>{l.rule.form}</Td>
                  <Td>
                    {l.rule.label}
                    <Notes notes={l.notes} />
                  </Td>
                  <Td align="right">{l.toEnter == null ? <span className="text-xs text-fg-faint">global</span> : <Amount value={l.toEnter} />}</Td>
                  <Td align="right">{l.toCheck == null ? <span className="text-xs text-fg-faint">global</span> : <Amount value={l.toCheck} />}</Td>
                  <Td align="right" className="font-medium">
                    <Amount value={l.total} />
                  </Td>
                  <Td>
                    <Status status={l.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="mt-3 text-xs text-fg-faint">Les montants « à contrôler » proviennent normalement déjà de l'IFU de l'établissement : ne les ajoutez pas une seconde fois.</p>
      </Block>

      {sheets.length > 0 && (
        <Block title="Répartition par établissement">
          <Table>
            <thead>
              <tr>
                <Th>Établissement</Th>
                <Th>Traitement</Th>
                <Th align="right">Revenus bruts</Th>
                <Th align="right">Acompte retenu</Th>
                <Th align="right">Résultat des cessions</Th>
                <Th align="right">Cessions crypto</Th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => (
                <Tr key={s.key}>
                  <Td className="font-medium">
                    {s.mode === "a_saisir" ? (
                      <button type="button" className="underline" onClick={() => onOpen(s.key)}>
                        {s.name}
                      </button>
                    ) : (
                      s.name
                    )}
                  </Td>
                  <Td className="text-xs text-fg-muted">{MODE_LABELS[s.mode]}</Td>
                  <Td align="right">
                    <Amount value={incomeOf(s)} />
                  </Td>
                  <Td align="right">
                    <Amount value={prepaid(s)} />
                  </Td>
                  <Td align="right">
                    <Amount value={s.securities.net} signed />
                  </Td>
                  <Td align="right">
                    <Amount value={s.crypto.proceeds} />
                  </Td>
                </Tr>
              ))}
              <tr className="bg-surface-2/60 font-medium">
                <Td colSpan={2}>Total</Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + incomeOf(s), 0)} />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + prepaid(s), 0)} />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + s.securities.net, 0)} signed />
                </Td>
                <Td align="right">
                  <Amount value={sheets.reduce((t, s) => t + s.crypto.proceeds, 0)} />
                </Td>
              </tr>
            </tbody>
          </Table>
        </Block>
      )}

      {securities && (securities.gains > 0 || securities.losses > 0 || securities.carryOut.length > 0) && (
        <Block title="Plus et moins-values de valeurs mobilières">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Plus-values de l'année">
              <Amount value={securities.gains} />
            </Row>
            <Row label="Moins-values de l'année">
              <Amount value={securities.losses} />
            </Row>
            <Row label="Résultat de l'année">
              <Amount value={securities.net} signed />
            </Row>
            <Row label="Moins-values antérieures imputées">{securities.usedCarry.length ? securities.usedCarry.map((c) => <div key={c.year}><Amount value={c.amount} /> <span className="text-xs text-fg-faint">({c.year})</span></div>) : "—"}</Row>
            <Row label="Moins-values restant reportables">{securities.carryOut.length ? securities.carryOut.map((c) => <div key={c.year}><Amount value={c.amount} /> <span className="text-xs text-fg-faint">({c.year}, jusqu'en {c.year + rules.lossCarryYears})</span></div>) : "—"}</Row>
          </dl>
          <p className="mt-3 text-xs text-fg-faint">Moins-values antérieures : uniquement celles que Hamac connaît par votre journal.</p>
        </Block>
      )}

      {crypto && (
        <Block title="Actifs numériques (portefeuille global)">
          <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Total des cessions">
              <Amount value={crypto.grossSales} />
            </Row>
            <Row label="Résultat net">
              <Amount value={crypto.netGain} signed />
            </Row>
            <Row label="Seuil d'exonération">{crypto.exempt ? "Sous le seuil : plus-value exonérée" : "Dépassé"}</Row>
          </dl>
        </Block>
      )}

      {others.length > 0 && (
        <Block title="Autres comptes">
          <ul className="space-y-1.5 text-sm">
            {others.map((o) => (
              <li key={o.account.id}>
                <span className="font-medium">{o.account.name}</span> <span className="text-fg-muted">: {o.reason}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="Rappels">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-muted">
          {reminders.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Block>
    </>
  );
}
