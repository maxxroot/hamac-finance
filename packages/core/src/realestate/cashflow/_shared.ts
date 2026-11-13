import type { ExpenseCategory } from "../expenses";
import type { Provision } from "../realestate";

/** Postes du cashflow, dans l'ordre d'affichage. Montants signés : positifs pour ce qui rentre. */
export const CASHFLOW_KEYS = ["rents", "vacancy", "recovered", "taxe_fonciere", "copropriete", "assurance", "gestion", "autre", "travaux", "otherIncome", "loans"] as const;
export type CashflowKey = (typeof CASHFLOW_KEYS)[number];

export const CASHFLOW_LABELS: Record<CashflowKey, string> = {
  rents: "Loyers hors charges",
  vacancy: "Vacance locative",
  recovered: "Charges remboursées par le locataire",
  taxe_fonciere: "Taxe foncière",
  copropriete: "Charges de copropriété",
  assurance: "Assurance propriétaire",
  gestion: "Frais de gestion",
  autre: "Autres dépenses",
  travaux: "Travaux et entretien",
  otherIncome: "Autres recettes",
  loans: "Crédit (mensualités et assurance)",
};

/** Catégories de dépense qui ont leur propre poste. */
export const EXPENSE_KEYS = ["taxe_fonciere", "copropriete", "assurance", "gestion", "autre", "travaux"] as const satisfies readonly ExpenseCategory[];

export type Amounts = Record<CashflowKey, number>;
export const zeroAmounts = (): Amounts => Object.fromEntries(CASHFLOW_KEYS.map((k) => [k, 0])) as Amounts;

/** Montant mensuel d'une provision, pour un loyer mensuel hors charges donné. */
export const provisionMonthly = (p: Provision, monthlyRent: number) => (p.kind === "taux" ? monthlyRent * p.value : p.value / 12);
