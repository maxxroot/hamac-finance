import type { Handlers } from "./_types";
import { systemHandlers } from "./system";
import { accountsHandlers } from "./accounts";
import { journalHandlers } from "./journal";
import { assetsHandlers } from "./assets";
import { exposureHandlers } from "./exposure";
import { investmentsHandlers } from "./investments";
import { realestateHandlers } from "./realestate";
import { loansHandlers } from "./loans";
import { otherAssetsHandlers } from "./other-assets";
import { planningHandlers } from "./planning";

/** Tous les handlers, un fichier par domaine : une procédure sans handler est une erreur de compilation. */
export const handlers: Handlers = {
  ...systemHandlers,
  ...accountsHandlers,
  ...journalHandlers,
  ...assetsHandlers,
  ...exposureHandlers,
  ...investmentsHandlers,
  ...realestateHandlers,
  ...loansHandlers,
  ...otherAssetsHandlers,
  ...planningHandlers,
};
