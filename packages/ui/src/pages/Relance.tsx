import { useParams } from "react-router";
import { NOTICE_LEVEL_LABELS, NOTICE_LEVELS, formatEur, leaseArrears, rentLedgerOf, type NoticeLevel } from "@hamac/core";
import { PrintPage } from "@/components/PrintPage";
import { leaseAddressee, leasePlace } from "@/lib/leaseLetters";
import { formatDate, formatMonth } from "@/lib/numbers";
import { usePortfolio } from "@/lib/portfolio";

/** Courrier de relance d'un loyer non reçu, avec le décompte des sommes dues, à imprimer. */
export function Relance() {
  const { leaseId, level: raw } = useParams();
  const pf = usePortfolio();
  if (!pf) return null;
  const { ws } = pf.idx;
  const level = (NOTICE_LEVELS as readonly string[]).includes(raw ?? "") ? (raw as NoticeLevel) : "rappel";
  const lease = ws.leases.find((l) => l.id === leaseId);
  const property = lease && ws.properties.find((p) => p.id === lease.propertyId);
  const arrears = lease ? leaseArrears(lease, ws.leaseRents, rentLedgerOf(ws), pf.today) : null;
  if (!lease || !property || !arrears) return <PrintPage>Aucun loyer en retard sur ce bail.</PrintPage>;
  const place = leasePlace(property, lease, ws);
  const total = formatEur(arrears.total);
  const period = arrears.months.length === 1 ? `du loyer de ${formatMonth(arrears.months[0].month)}` : `des loyers de ${formatMonth(arrears.months[0].month)} à ${formatMonth(arrears.months.at(-1)!.month)}`;
  const caution = ws.leaseGuarantees.some((g) => g.leaseId === lease.id && g.kind === "caution");
  return (
    <PrintPage>
      <div className="mb-8 grid grid-cols-2 gap-8">
        <div>
          <p className="font-semibold">{lease.landlord || "Le propriétaire"}</p>
          {lease.landlordAddress && <p className="whitespace-pre-line">{lease.landlordAddress}</p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">{leaseAddressee(lease, ws)}</p>
          <p>{place}</p>
        </div>
      </div>
      <p className="mb-4 text-right">Le {formatDate(pf.today)}</p>
      {level === "mise_en_demeure" && <p className="mb-2 font-semibold">Lettre recommandée avec accusé de réception</p>}
      <h1 className="mb-4 text-base font-semibold">Objet : {level === "mise_en_demeure" ? "mise en demeure de payer" : level === "relance" ? "relance pour loyer impayé" : "loyer non reçu"}</h1>
      <p className="mb-3">Madame, Monsieur,</p>
      {level === "rappel" && (
        <p className="mb-5">
          Sauf erreur de ma part, je n'ai pas encore reçu le règlement {period}, pour le logement situé {place}, soit {total}. Il s'agit peut-être d'un simple oubli : je vous remercie de bien vouloir procéder au règlement dans les meilleurs délais. Si vous l'avez déjà effectué, merci de ne pas tenir compte de ce courrier.
        </p>
      )}
      {level === "relance" && (
        <p className="mb-5">
          Malgré mon précédent courrier, le règlement {period}, pour le logement situé {place}, ne m'est toujours pas parvenu. Je vous demande de régler la somme de {total} sous huit jours à réception de ce courrier, ou de prendre contact avec moi sans attendre si vous rencontrez une difficulté.
        </p>
      )}
      {level === "mise_en_demeure" && (
        <>
          <p className="mb-3">
            Malgré mes précédentes relances, vous restez redevable {period}, pour le logement situé {place}, soit {total}, dont le détail figure ci-dessous.
          </p>
          <p className="mb-3">
            Par la présente, je vous mets en demeure de régler cette somme dans un délai de huit jours à compter de la réception de ce courrier. À défaut, je me verrai contraint de faire délivrer un commandement de payer par un commissaire de justice et d'engager la procédure prévue par le bail et par la loi.
          </p>
          {caution && <p className="mb-5">Une copie de ce courrier est adressée à la personne qui s'est portée caution.</p>}
        </>
      )}
      <h2 className="mb-1.5 border-b border-neutral-400 pb-1 text-sm font-semibold">Décompte des sommes dues au {formatDate(pf.today)}</h2>
      <table className="mb-5 w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-600">
            <th className="py-1 font-normal">Mois</th>
            <th className="py-1 text-right font-normal">Échéance</th>
            <th className="py-1 text-right font-normal">Dû</th>
            <th className="py-1 text-right font-normal">Reçu</th>
            <th className="py-1 text-right font-normal">Reste dû</th>
          </tr>
        </thead>
        <tbody>
          {arrears.months.map((m) => (
            <tr key={m.month}>
              <td className="py-0.5">{formatMonth(m.month)}</td>
              <td className="py-0.5 text-right">{formatDate(m.dueDate)}</td>
              <td className="py-0.5 text-right">{formatEur(m.due)}</td>
              <td className="py-0.5 text-right">{formatEur(m.paid)}</td>
              <td className="py-0.5 text-right">{formatEur(m.outstanding)}</td>
            </tr>
          ))}
          <tr className="border-t border-neutral-400 font-semibold">
            <td className="py-1" colSpan={4}>
              Total
            </td>
            <td className="py-1 text-right">{total}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3">Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>
      <p className="mt-8">Signature :</p>
      <p className="mt-10 text-xs text-neutral-500 print:hidden">{NOTICE_LEVEL_LABELS[level]} préparé par Hamac : document d'aide, à relire avant envoi.</p>
    </PrintPage>
  );
}
