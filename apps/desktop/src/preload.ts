import { contextBridge, ipcRenderer } from "electron";

// Seul pont entre l'interface (isolée, sans Node) et le processus principal.
// Le nom du canal est dupliqué ici car le preload, en bac à sable, ne peut rien importer d'autre.
contextBridge.exposeInMainWorld("hamac", {
  rpc: (name: string, input: unknown) => ipcRenderer.invoke("hamac:rpc", name, input),
});
