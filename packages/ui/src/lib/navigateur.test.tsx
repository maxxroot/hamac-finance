import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@hamac/api";
import { downloadText, pickBinaryFile, pickTextFile, toCsv } from "@/lib/files";
import { call } from "@/lib/transport";
import { readCollapsed, saveCollapsed } from "@/lib/sidebar";

/** Mécanismes du navigateur (fichiers, réseau, stockage local) : jsdom, sans backend. */

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

/** Un fichier choisi : seul ce que lit le code (nom et contenu) est simulé. */
const fakeFile = (name: string, bytes: Uint8Array) => ({ name, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });

/** Le sélecteur de fichiers natif n'existe pas sous jsdom : le clic sur l'<input> « choisit » ce fichier (ou rien). */
function chooseWith(file: ReturnType<typeof fakeFile> | null) {
  const clicked: HTMLInputElement[] = [];
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
    clicked.push(this);
    Object.defineProperty(this, "files", { value: file ? [file] : [] });
    this.onchange?.(new Event("change"));
  });
  return clicked;
}

describe("fichiers", () => {
  describe("téléchargement", () => {
    it("crée un lien temporaire nommé comme demandé, le clique, puis libère l'adresse après 2 secondes", () => {
      vi.useFakeTimers();
      const created: Blob[] = [];
      vi.stubGlobal("URL", {
        createObjectURL: (b: Blob) => (created.push(b), "blob:fictif"),
        revokeObjectURL: vi.fn(),
      });
      const links: HTMLAnchorElement[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        // Le lien doit être dans la page au moment du clic, sinon certains navigateurs l'ignorent.
        expect(document.body.contains(this)).toBe(true);
        links.push(this);
      });

      downloadText("journal.csv", "a;b", "text/csv");

      expect(links).toHaveLength(1);
      expect(links[0]!.download).toBe("journal.csv");
      expect(links[0]!.href).toBe("blob:fictif");
      expect(created[0]!.type).toBe("text/csv");
      // Le lien est retiré de la page dès le clic ; l'adresse, un peu plus tard.
      expect(document.body.contains(links[0]!)).toBe(false);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2000);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fictif");
    });

    it("sans type précisé, le contenu part en texte UTF-8", () => {
      const created: Blob[] = [];
      vi.stubGlobal("URL", { createObjectURL: (b: Blob) => (created.push(b), "blob:x"), revokeObjectURL: vi.fn() });
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      downloadText("notes.txt", "bonjour");
      expect(created[0]!.type).toBe("text/plain;charset=utf-8");
    });
  });

  describe("choix d'un fichier texte", () => {
    it("ouvre un sélecteur filtré sur les extensions demandées et rend le nom et le contenu", async () => {
      const clicked = chooseWith(fakeFile("releve.ofx", new TextEncoder().encode("Dépôt à 100 €")));
      const picked = await pickTextFile(".ofx,.csv");
      expect(picked).toEqual({ name: "releve.ofx", content: "Dépôt à 100 €" });
      expect(clicked[0]!.type).toBe("file");
      expect(clicked[0]!.accept).toBe(".ofx,.csv");
    });

    it("relit en Windows-1252 un relevé qui n'est pas en UTF-8 (« é » codé sur un octet)", async () => {
      // « Crédit » en Windows-1252 : l'octet 0xE9 n'est pas de l'UTF-8 valide.
      chooseWith(fakeFile("banque.csv", Uint8Array.from([0x43, 0x72, 0xe9, 0x64, 0x69, 0x74])));
      expect(await pickTextFile(".csv")).toEqual({ name: "banque.csv", content: "Crédit" });
    });

    it("sans fichier choisi, rend null", async () => {
      chooseWith(null);
      expect(await pickTextFile(".csv")).toBeNull();
    });
  });

  describe("choix d'un fichier binaire", () => {
    it("rend les octets du classeur, tels quels", async () => {
      const octets = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff]);
      const clicked = chooseWith(fakeFile("classeur.xlsx", octets));
      const picked = await pickBinaryFile(".xlsx");
      expect(picked?.name).toBe("classeur.xlsx");
      expect([...picked!.bytes]).toEqual([...octets]);
      expect(clicked[0]!.accept).toBe(".xlsx");
    });

    it("sans fichier choisi, rend null", async () => {
      chooseWith(null);
      expect(await pickBinaryFile(".xlsx")).toBeNull();
    });
  });

  describe("export CSV", () => {
    it("commence par la marque d'ordre des octets, sépare par « ; » et termine les lignes par CRLF", () => {
      expect(toCsv([["a", "b"], ["c", "d"]])).toBe("﻿a;b\r\nc;d");
    });

    it("met la virgule décimale aux nombres et laisse vides les valeurs absentes", () => {
      expect(toCsv([[12.5, null, undefined, 3]])).toBe("﻿12,5;;;3");
    });

    it("entoure de guillemets ce qui contient « ; », un guillemet ou un retour à la ligne, en doublant les guillemets", () => {
      expect(toCsv([["a;b", 'dit "oui"', "deux\nlignes", "simple"]])).toBe('﻿"a;b";"dit ""oui""";"deux\nlignes";simple');
    });
  });
});

describe("transport HTTP", () => {
  const reponse = (corps: unknown, status = 200) => new Response(typeof corps === "string" ? corps : JSON.stringify(corps), { status });

  it("envoie un POST JSON avec l'en-tête anti-CSRF et les cookies, et rend les données", async () => {
    const fetchFake = vi.fn(async () => reponse({ ok: true, data: { total: 42 } }));
    vi.stubGlobal("fetch", fetchFake);

    const out = await call("workspace.load");

    expect(out).toEqual({ total: 42 });
    const [url, init] = fetchFake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rpc/workspace.load");
    expect(init).toMatchObject({ method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-Hamac": "1" } });
    // Sans argument : le corps est « null », pas vide.
    expect(init.body).toBe("null");
  });

  it("transmet l'argument de la procédure en JSON", async () => {
    const fetchFake = vi.fn(async () => reponse({ ok: true, data: null }));
    vi.stubGlobal("fetch", fetchFake);
    await call("settings.get", { key: "ui.theme" });
    expect((fetchFake.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe(JSON.stringify({ key: "ui.theme" }));
  });

  it("transforme une erreur du serveur en RpcError, avec son code, son message et ses détails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reponse({ ok: false, error: { code: "VALIDATION", message: "Montant invalide", details: { field: "amount" } } }, 400)));
    const err = await call("workspace.load").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RpcError);
    expect(err).toMatchObject({ code: "VALIDATION", message: "Montant invalide", details: { field: "amount" } });
  });

  it.each([401, 403])("réponse %i : annonce la session expirée à l'application, puis échoue", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => reponse({ ok: false, error: { code: "UNAUTHORIZED", message: "non" } }, status)));
    const annonce = vi.fn();
    window.addEventListener("hamac:unauthorized", annonce);
    try {
      const err = await call("workspace.load").catch((e: unknown) => e);
      expect(err).toMatchObject({ code: "UNAUTHORIZED", message: "Session expirée : reconnectez-vous." });
      expect(annonce).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener("hamac:unauthorized", annonce);
    }
  });

  it("une réponse qui n'est pas du JSON devient une erreur interne qui cite le statut", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reponse("<html>Bad Gateway</html>", 502)));
    const err = await call("workspace.load").catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "INTERNAL", message: "Réponse 502 du serveur" });
  });
});

describe("barre latérale : préférence gardée dans le navigateur", () => {
  beforeEach(() => localStorage.clear());

  it("par défaut, la barre n'est pas réduite", () => {
    expect(readCollapsed()).toBe(false);
  });

  it("garde le choix d'un appel à l'autre", () => {
    saveCollapsed(true);
    expect(readCollapsed()).toBe(true);
    saveCollapsed(false);
    expect(readCollapsed()).toBe(false);
  });

  it("navigation privée (stockage inaccessible) : lit « non réduite » et n'échoue pas à l'écriture", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readCollapsed()).toBe(false);
    expect(() => saveCollapsed(true)).not.toThrow();
  });
});
