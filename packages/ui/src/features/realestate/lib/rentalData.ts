import { rentLedgerOf, sortLots, type RentalData } from "@hamac/core";
import type { usePortfolio } from "@/shared/lib/portfolio";

type Portfolio = NonNullable<ReturnType<typeof usePortfolio>>;

/** Données de location d'un bien, à la part détenue (parts de SCI comprises) ; null s'il n'existe pas. */
export function rentalDataOf(pf: Portfolio, propertyId: string): RentalData | null {
  const { ws } = pf.idx;
  const property = ws.properties.find((p) => p.id === propertyId);
  if (!property) return null;
  return {
    property: pf.data.properties?.find((p) => p.id === propertyId) ?? property,
    incomes: ws.propertyIncomes,
    leases: ws.leases.filter((l) => l.propertyId === propertyId),
    rents: ws.leaseRents,
    ledger: rentLedgerOf(ws),
    expenses: ws.propertyExpenses,
    loans: pf.data.loans ?? ws.loans,
    lots: sortLots(ws.lots.filter((l) => l.propertyId === propertyId)),
  };
}

/** Tous les biens en location du foyer : l'impôt sur les loyers se calcule ensemble. */
export const allRentalData = (pf: Portfolio): RentalData[] => pf.idx.ws.properties.filter((p) => p.kind === "locatif").flatMap((p) => rentalDataOf(pf, p.id) ?? []);
