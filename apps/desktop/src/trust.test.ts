import { describe, expect, it } from "vitest";
import { isTrustedUrl } from "./trust";

const renderer = "file:///Applications/Hamac/renderer/index.html";

describe("pages autorisées", () => {
  it("accepte la page de l'application, avec sa route", () => {
    expect(isTrustedUrl(`${renderer}#/journal`, renderer)).toBe(true);
    expect(isTrustedUrl(renderer, renderer)).toBe(true);
  });
  it("refuse tout autre fichier local et les adresses web", () => {
    expect(isTrustedUrl("file:///Users/x/Downloads/piege.html", renderer)).toBe(false);
    expect(isTrustedUrl("https://exemple.fr/", renderer)).toBe(false);
    expect(isTrustedUrl(undefined, renderer)).toBe(false);
  });
  it("en développement : la même origine seulement", () => {
    const dev = "http://localhost:5173";
    expect(isTrustedUrl("http://localhost:5173/#/journal", renderer, dev)).toBe(true);
    expect(isTrustedUrl("http://localhost:5173.exemple.fr/", renderer, dev)).toBe(false);
  });
});
