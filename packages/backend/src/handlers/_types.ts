import type { ProcName, ProcOutput, Procedures } from "@hamac/api";
import type { output } from "zod";
import type { BackendContext } from "../context";

/** Les handlers reçoivent l'entrée APRÈS validation zod (valeurs par défaut appliquées). */
export type Parsed<N extends ProcName> = output<Procedures[N]["input"]>;
export type Handlers = { [N in ProcName]: (input: Parsed<N>, ctx: BackendContext) => Promise<ProcOutput<N>> };

/** Handlers d'un domaine : exactement les procédures déclarées par ce domaine dans le contrat. */
export type DomainHandlers<P> = Pick<Handlers, keyof P & ProcName>;

export const OK = { ok: true as const };
