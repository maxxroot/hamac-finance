import { Link } from "react-router";
import { dispenseReminderSeason, institutionWithholds, withholdingDispensed, type Account, type Institution, type PlanParams } from "@hamac/core";

/**
 * État de l'acompte de 12,8 % sur les intérêts pour l'année en cours, établissement par établissement (dispensé ou
 * retenu), avec un lien vers la page Impôts où il se règle. De septembre au 30 novembre, rappelle la demande pour
 * l'année suivante si un établissement n'est pas encore coché. Rien sans établissement qui prélève.
 */
export function DispenseStatus({ accounts, institutions, params, today }: { accounts: readonly Account[]; institutions: readonly Institution[]; params: PlanParams; today: string }) {
  const year = +today.slice(0, 4);
  const ids = new Set(accounts.map((a) => a.institutionId).filter((id): id is string => id != null));
  const shown = institutions.filter((i) => ids.has(i.id) && institutionWithholds(i)).sort((a, b) => a.name.localeCompare(b.name));
  if (!shown.length) return null;
  const nextMissing = dispenseReminderSeason(today) && shown.some((i) => !withholdingDispensed(params, year + 1, i.id));
  return (
    <p className="mb-6 text-sm text-fg-muted">
      Acompte de 12,8 % sur les intérêts en {year} :{" "}
      {shown.map((i, n) => (
        <span key={i.id}>
          {n > 0 && " · "}
          {i.name} <b className="font-medium text-fg">{withholdingDispensed(params, year, i.id) ? "dispensé" : "retenu"}</b>
        </span>
      ))}
      .{nextMissing && ` Dispense pour ${year + 1} : à demander avant le 30/11/${year}.`}{" "}
      <Link to="/impots" className="text-accent hover:underline">
        Régler dans Impôts
      </Link>
    </p>
  );
}
