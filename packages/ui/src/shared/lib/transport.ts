import { RpcError, type ProcInput, type ProcName, type ProcOutput, type RpcResult, type Transport } from "@hamac/api";

/** POST /api/rpc/<procédure> vers le serveur. */
function httpTransport(baseUrl: string): Transport {
  return {
    async call(name, ...input) {
      const res = await fetch(`${baseUrl}/api/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        // En-tête anti-CSRF exigé par le serveur.
        headers: { "Content-Type": "application/json", "X-Hamac": "1" },
        credentials: "include",
        body: JSON.stringify(input[0] ?? null),
      });
      const body = (await res.json().catch(() => null)) as RpcResult<unknown> | null;
      if (res.status === 401 || res.status === 403) {
        window.dispatchEvent(new Event("hamac:unauthorized"));
        throw new RpcError("UNAUTHORIZED", "Session expirée : reconnectez-vous.");
      }
      if (!body) throw new RpcError("INTERNAL", `Réponse ${res.status} du serveur`);
      return unwrap(body);
    },
  } as Transport;
}

function unwrap(res: RpcResult<unknown>) {
  if (res.ok) return res.data;
  throw new RpcError(res.error.code, res.error.message, res.error.details);
}

export const transport: Transport = httpTransport("");

export function call<N extends ProcName>(name: N, ...input: ProcInput<N> extends void ? [] : [ProcInput<N>]) {
  return transport.call(name, ...input) as Promise<ProcOutput<N>>;
}
