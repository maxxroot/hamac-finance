import { describe, expect, it } from "vitest";
import { sidebarLayout } from "./sidebar";

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
});
