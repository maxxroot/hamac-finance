import { describe, expect, it } from "vitest";
import { shouldReload } from "./workspaceSync";

describe("rechargement après une écriture faite ailleurs", () => {
  it("recharge quand la version a changé", () => {
    expect(shouldReload("a1b2.3", "a1b2.4", false)).toBe(true);
    // Backend rouvert (compteur remis à zéro) : l'identifiant d'ouverture change, on recharge aussi.
    expect(shouldReload("a1b2.3", "c3d4.0", false)).toBe(true);
  });

  it("ne fait rien si la version est la même, inconnue, ou si un chargement est en cours", () => {
    expect(shouldReload("a1b2.3", "a1b2.3", false)).toBe(false);
    expect(shouldReload(undefined, "a1b2.3", false)).toBe(false);
    expect(shouldReload("", "a1b2.3", false)).toBe(false);
    expect(shouldReload("a1b2.3", "a1b2.4", true)).toBe(false);
  });
});
