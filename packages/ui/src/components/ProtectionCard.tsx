import { useMemo } from "react";
import { GUARANTEE_LABELS, GUARANTEE_SOURCES, PROTECTION_VERIFIED_ON, protectionOf, type ProtectionLine } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Card, CardTitle } from "@/components/ui";
import { formatDate } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

/** Ce qui est garanti si un établissement fait faillite, groupé par établissement garant. */
export function ProtectionCard() {
  const pf = usePortfolio();
  const summary = useMemo(() => (pf ? protectionOf(pf.state.accounts, pf.data.institutions ?? [], pf.data.params.alerts.fgapGuarantee) : null), [pf]);
  if (!pf || !summary || summary.lines.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardTitle hint={`Règles vérifiées le ${formatDate(PROTECTION_VERIFIED_ON)}`}>Protection en cas de faillite</CardTitle>
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm @2xl:grid-cols-4">
        <Figure label="Sous les plafonds" value={summary.covered} />
        <Figure label="Au-delà d'un plafond" value={summary.overCeiling} warn={summary.overCeiling > 0} />
        <Figure label="Sans garantie" value={summary.unprotected} hint="crowdlending, crypto" />
        <Figure label="À vérifier" value={summary.toCheck + summary.separate} hint={summary.separate > 0 ? "dont épargne salariale" : undefined} />
      </dl>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Établissement garant</Th>
              <Th>Garantie</Th>
              <Th align="right">Montant</Th>
              <Th align="right">Plafond</Th>
              <Th className="w-40">Part garantie</Th>
              <Th align="right">Non garanti</Th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((l) => (
              <Line key={l.key} line={l} />
            ))}
          </tbody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-fg-faint">
        Montants pour votre part des comptes. L'établissement garant et le pays se règlent sur la fiche de chaque établissement (Paramètres › Établissements). Sources :{" "}
        {GUARANTEE_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
              {s.label}
            </a>
          </span>
        ))}
        .
      </p>
    </Card>
  );
}

function Figure({ label, value, hint, warn = false }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-fg-faint">
        {label}
        {hint && <span className="ml-1 text-[11px]">({hint})</span>}
      </dt>
      <dd className={warn ? "font-semibold text-negative" : "font-medium"}>
        <Amount value={value} compact />
      </dd>
    </div>
  );
}

function Line({ line: l }: { line: ProtectionLine }) {
  const ratio = l.ceiling == null || l.amount <= 0 ? null : l.covered / l.amount;
  const others = l.institutions.filter((n) => n !== l.guarantor);
  return (
    <Tr>
      <Td className="align-top">
        <div className="font-medium">{l.guarantor ?? "Établissement non renseigné"}</div>
        <div className="text-xs text-fg-faint">
          {others.length > 0 && <>via {others.join(", ")} · </>}
          {l.accounts.map((a) => a.name).join(", ")}
        </div>
        {l.note && <div className="mt-0.5 max-w-md text-xs text-fg-faint">{l.note}</div>}
      </Td>
      <Td className="align-top">
        <Badge tone={l.guarantee === "aucune" ? "negative" : l.guarantee === "inconnue" || l.guarantee === "separe" ? "neutral" : "accent"}>{GUARANTEE_LABELS[l.guarantee]}</Badge>
      </Td>
      <Td align="right" className="align-top">
        <Amount value={l.amount} compact />
      </Td>
      <Td align="right" className="align-top text-fg-muted">
        {l.ceiling == null ? "—" : <Amount value={l.ceiling} compact />}
      </Td>
      <Td className="align-top">
        {ratio == null ? (
          <span className="text-xs text-fg-faint">{l.guarantee === "aucune" ? "aucune" : "—"}</span>
        ) : (
          <div className="mt-1.5 h-2 rounded-full bg-negative/30" role="img" aria-label={`${Math.round(ratio * 100)} % garanti`}>
            <div className="h-full rounded-full bg-positive" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        )}
      </Td>
      <Td align="right" className={l.uncovered > 0 ? "align-top font-semibold text-negative" : "align-top text-fg-faint"}>
        {l.ceiling == null ? "—" : <Amount value={l.uncovered} compact />}
      </Td>
    </Tr>
  );
}
