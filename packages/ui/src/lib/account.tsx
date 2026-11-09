import { createContext, useContext } from "react";
import type { Me } from "./auth";

export interface Account {
  me: Me;
  /** Relit le compte : le bandeau et la fenêtre suivent aussitôt. */
  refresh: () => Promise<void>;
  /** Vrai juste après une connexion, jusqu'à ce que la fenêtre d'incitation soit refermée. */
  justLoggedIn: boolean;
  closeLoginPrompt: () => void;
}

export const AccountContext = createContext<Account | null>(null);

export function useAccount(): Account | null {
  return useContext(AccountContext);
}
