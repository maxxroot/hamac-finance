import type { ProcInput, ProcName, ProcOutput } from "./contract";

/** Enveloppe de réponse sérialisable (IPC Electron ou HTTP). */
export type RpcResult<T> = { ok: true; data: T } | { ok: false; error: RpcErrorPayload };

export interface RpcErrorPayload {
  code: "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "UNAUTHORIZED" | "INTERNAL";
  message: string;
  details?: unknown;
}

export class RpcError extends Error {
  constructor(
    readonly code: RpcErrorPayload["code"],
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "RpcError";
  }
}

/** Ce que l'interface utilise pour parler au backend, quel que soit le mode. */
export interface Transport {
  call<N extends ProcName>(name: N, ...input: ProcInput<N> extends void ? [] : [ProcInput<N>]): Promise<ProcOutput<N>>;
}
