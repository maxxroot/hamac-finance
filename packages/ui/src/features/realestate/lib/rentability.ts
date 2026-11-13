import { propertyBalance, propertyCashflow, type PlanParams, type PropertyBalance, type PropertyCashflow, type RentalData } from "@hamac/core";

/** Chiffres de l'onglet Rentabilité d'un bien en location, calculés une fois pour la page. */
export interface Rentability {
  cashflow: PropertyCashflow;
  balance: PropertyBalance | null;
}

/** `netValue` : valeur nette d'aujourd'hui, ou ce qu'il reste de la vente pour un bien vendu. */
export function rentabilityOf(data: RentalData, params: PlanParams, netValue: number, today: string): Rentability {
  return {
    cashflow: propertyCashflow(data, params.rental, today),
    balance: propertyBalance(data, netValue, today),
  };
}
