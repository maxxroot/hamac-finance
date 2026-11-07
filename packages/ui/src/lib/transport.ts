import type { DesktopBridge, ProcInput, ProcName, ProcOutput, RpcResult, Transport } from "@hamac/api";
import { RpcError } from "@hamac/api";

declare global {
  interface Window {
    hamac?: DesktopBridge;
  }
}

/** Bureau : canal IPC exposé par le preload Electron. */
function desktopTransport(bridge: DesktopBridge): Transport {
  return {
    async call(name, ...input) {
      return unwrap(await bridge.rpc(name, input[0]));
    },
  } as Transport;
}

/** Web : POST /api/rpc/<procédure> vers le serveur auto-hébergé (étape 6). */
function httpTransport(baseUrl: string): Transport {
  return {
    async call(name, ...input) {
      const res = await fetch(`${baseUrl}/api/rpc/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(input[0] ?? null),
      });
      return unwrap((await res.json()) as RpcResult<unknown>);
    },
  } as Transport;
}

function unwrap(res: RpcResult<unknown>) {
  if (res.ok) return res.data;
  throw new RpcError(res.error.code, res.error.message, res.error.details);
}

export const transport: Transport = window.hamac ? desktopTransport(window.hamac) : httpTransport("");
export const isDesktop = Boolean(window.hamac);

export function call<N extends ProcName>(name: N, ...input: ProcInput<N> extends void ? [] : [ProcInput<N>]) {
  return transport.call(name, ...input) as Promise<ProcOutput<N>>;
}
