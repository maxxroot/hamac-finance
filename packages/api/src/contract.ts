import type { z } from "zod";
import { systemProcedures } from "./system";
import { accountsProcedures } from "./accounts";
import { journalProcedures } from "./journal";
import { assetsProcedures } from "./assets";
import { exposureProcedures } from "./exposure";
import { investmentsProcedures } from "./investments";
import { realestateProcedures } from "./realestate";
import { loansProcedures } from "./loans";
import { otherAssetsProcedures } from "./other-assets";
import { planningProcedures } from "./planning";

/**
 * Chaque procédure déclare son entrée et sa sortie avec zod.
 * Le backend valide les deux ; l'interface en déduit les types.
 * Chaque domaine déclare les siennes dans `<domaine>/procedures.ts` ; ce fichier les assemble.
 * Ajouter une fonctionnalité = une entrée dans le `procedures.ts` du domaine + son handler côté backend.
 */
export const procedures = {
  ...systemProcedures,
  ...accountsProcedures,
  ...journalProcedures,
  ...assetsProcedures,
  ...exposureProcedures,
  ...investmentsProcedures,
  ...realestateProcedures,
  ...loansProcedures,
  ...otherAssetsProcedures,
  ...planningProcedures,
} as const;

export type Procedures = typeof procedures;
export type ProcName = keyof Procedures;
export type ProcInput<N extends ProcName> = z.input<Procedures[N]["input"]>;
export type ProcOutput<N extends ProcName> = z.output<Procedures[N]["output"]>;
