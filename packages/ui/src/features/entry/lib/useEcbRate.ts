import { useQuery } from "@tanstack/react-query";
import { EUR, type FxBook } from "@hamac/core";
import { call } from "@/shared/lib/transport";
import { ecbRateOn, type EcbRate } from "./fxEntry";

/**
 * Taux BCE d'une devise à la date d'une opération : celui des taux chargés avec l'espace de travail, sinon demandé au serveur
 * (premier titre dans une devise : l'espace de travail n'en a encore aucun taux).
 */
export function useEcbRate(book: FxBook, currency: string, date: string | null): EcbRate | null {
  const foreign = currency !== EUR && !!date;
  const known = foreign ? ecbRateOn(book, currency, date) : null;
  const q = useQuery({
    queryKey: ["market.fxRate", currency, date],
    queryFn: () => call("market.fxRate", { currency, date: date! }),
    enabled: foreign && !known,
    staleTime: 3_600_000,
  });
  return foreign ? (known ?? q.data ?? null) : null;
}
