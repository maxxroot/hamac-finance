import { describe, expect, it } from "vitest";
import { sidebarAccounts, sidebarLayout } from "./sidebar";

describe("barre latérale", () => {
  it("grand écran : suit la préférence, sans recouvrir le contenu", () => {
    expect(sidebarLayout({ wide: true, preferCollapsed: false, peek: false })).toEqual({ collapsed: false, overlay: false });
    expect(sidebarLayout({ wide: true, preferCollapsed: true, peek: false })).toEqual({ collapsed: true, overlay: false });
  });

  it("écran étroit : réduite par défaut, quelle que soit la préférence", () => {
    expect(sidebarLayout({ wide: false, preferCollapsed: false, peek: false })).toEqual({ collapsed: true, overlay: false });
  });

  it("écran étroit : ouverte à la demande, par-dessus le contenu", () => {
    expect(sidebarLayout({ wide: false, preferCollapsed: true, peek: true })).toEqual({ collapsed: false, overlay: true });
  });

  it("comptes du menu : sans les archivés, les comptes investis d'abord, puis l'ordre choisi", () => {
    const a = (id: string, kind: string, sortOrder: number, archived = false) => ({ id, name: id, kind, sortOrder, archived }) as Parameters<typeof sidebarAccounts>[0][number];
    const list = [a("Livret A", "livret", 0), a("CTO", "cto", 2), a("Ancien PEA", "pea", 0, true), a("PEA", "pea", 1), a("AV 2", "assurance_vie", 2), a("AV 1", "assurance_vie", 1)];
    expect(sidebarAccounts(list).map((x) => x.id)).toEqual(["PEA", "CTO", "AV 1", "AV 2", "Livret A"]);
  });
});
