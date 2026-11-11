import { describe, expect, it } from "vitest";
import { isThemeChoice, resolveTheme } from "./theme";

describe("thème", () => {
  it("suit le système seulement quand on le demande", () => {
    expect(resolveTheme("systeme", true)).toBe("sombre");
    expect(resolveTheme("systeme", false)).toBe("clair");
    expect(resolveTheme("clair", true)).toBe("clair");
    expect(resolveTheme("sombre", false)).toBe("sombre");
  });

  it("refuse une valeur enregistrée inconnue", () => {
    expect(isThemeChoice("sombre")).toBe(true);
    expect(isThemeChoice("dark")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});
