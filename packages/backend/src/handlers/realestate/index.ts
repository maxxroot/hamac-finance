import type { realestateProcedures } from "@hamac/api";
import type { DomainHandlers } from "../_types";
import { leaseHandlers } from "./leases";
import { propertyHandlers } from "./properties";
import { rentHandlers } from "./rents";

/** Immobilier : biens et sociétés, lots et baux, loyers. Le type exige un handler pour chaque procédure du domaine. */
export const realestateHandlers: DomainHandlers<typeof realestateProcedures> = {
  ...propertyHandlers,
  ...leaseHandlers,
  ...rentHandlers,
};
