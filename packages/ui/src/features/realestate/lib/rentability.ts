import {
  propertyBalance,
  propertyCashflow,
  propertyFullCost,
  propertyTaxReference,
  propertyTaxTotal,
  rentalTaxes,
  rentalTaxKind,
  type PlanParams,
  type PropertyBalance,
  type PropertyCashflow,
  type PropertyFullCost,
  type PropertyTaxYear,
  type RentalData,
  type RentalRegime,
  type RentalTaxKind,
  type RentalTaxYear,
} from "@hamac/core";

/** Impôt du bien sous chaque régime possible, pour l'année de référence (le régime vaut pour tout le foyer). */
export interface RegimeChoice {
  regime: RentalRegime;
  tax: number | null;
  /** Régime impossible cette année-là (plafond du micro dépassé). */
  impossible: boolean;
}

/** Chiffres de l'onglet Rentabilité d'un bien en location, calculés une fois pour la page. */
export interface Rentability {
  cashflow: PropertyCashflow;
  balance: PropertyBalance | null;
  cost: PropertyFullCost;
  tax: {
    kind: RentalTaxKind;
    regime: RentalRegime;
    years: PropertyTaxYear[];
    /** Année du foyer correspondant à l'année de référence du bien. */
    reference: RentalTaxYear | null;
    choices: RegimeChoice[];
  };
}

/** `netValue` : valeur nette d'aujourd'hui, ou ce qu'il reste de la vente. `all` : tous les biens en location du foyer. */
export function rentabilityOf(data: RentalData, all: readonly RentalData[], params: PlanParams, netValue: number, today: string): Rentability {
  const id = data.property.id;
  const taxes = rentalTaxes(all, params, today);
  const ref = propertyTaxReference(taxes, id, today);
  const cashflow = propertyCashflow(data, params.rental, today, ref);
  const kind = rentalTaxKind(data.property, data.leases);
  const regime = kind === "foncier" ? params.rental.unfurnishedRegime : params.rental.furnishedRegime;
  const choices = (["micro", "reel"] as const).map((r) => {
    const t = rentalTaxes(all, params, today, { [kind]: r });
    const year = ref ? t.years.find((y) => y.year === ref.year && y.kind === kind) : undefined;
    const own = ref ? t.properties.get(id)?.find((y) => y.year === ref.year) : undefined;
    return { regime: r, tax: own?.tax ?? null, impossible: r === "micro" && (year?.ceilingExceeded ?? false) };
  });
  return {
    cashflow,
    balance: propertyBalance(data, netValue, today, propertyTaxTotal(taxes, id)),
    cost: propertyFullCost(data, cashflow, today),
    tax: {
      kind,
      regime,
      years: taxes.properties.get(id) ?? [],
      reference: ref ? (taxes.years.find((y) => y.year === ref.year && y.kind === kind) ?? null) : null,
      choices,
    },
  };
}

const cache = new WeakMap<object, Map<string, Rentability>>();

/**
 * Comme `rentabilityOf`, gardé en mémoire pour un même portefeuille (recalculé à chaque changement des données ou du
 * jour) : la page d'un bien se réaffiche souvent (fenêtres, onglets) et l'impôt du foyer se calcule trois fois.
 */
export function cachedRentability(key: object, data: RentalData, all: () => readonly RentalData[], params: PlanParams, netValue: number, today: string): Rentability {
  const byProperty = cache.get(key) ?? new Map<string, Rentability>();
  cache.set(key, byProperty);
  const id = `${data.property.id}:${netValue}`;
  const hit = byProperty.get(id);
  if (hit) return hit;
  const value = rentabilityOf(data, all(), params, netValue, today);
  byProperty.set(id, value);
  return value;
}
