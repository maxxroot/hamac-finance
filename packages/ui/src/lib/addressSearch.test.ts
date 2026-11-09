import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAddressResults, searchAddress } from "./addressSearch";

afterEach(() => vi.unstubAllGlobals());

const feature = (properties: Record<string, unknown>) => ({ type: "Feature", properties });

describe("recherche d'adresse", () => {
  it("garde le libellé, l'adresse, le code postal et la ville", () => {
    expect(parseAddressResults({ features: [feature({ label: "1 Rue Fictive 00000 Ville", name: "1 Rue Fictive", postcode: "00000", city: "Ville", type: "housenumber" })] })).toEqual([{ label: "1 Rue Fictive 00000 Ville", address: "1 Rue Fictive", postalCode: "00000", city: "Ville" }]);
  });

  it("une commune seule ne remplit pas l'adresse", () => {
    expect(parseAddressResults({ features: [feature({ label: "Ville", name: "Ville", postcode: "00000", city: "Ville", type: "municipality" })] })[0].address).toBe("");
  });

  it("ignore une réponse inattendue", () => {
    expect(parseAddressResults(null)).toEqual([]);
    expect(parseAddressResults({ features: "non" })).toEqual([]);
    expect(parseAddressResults({ features: [null, feature({ name: "sans libellé" }), feature({ label: 42 })] })).toEqual([]);
  });

  it("n'interroge pas le service sous 3 caractères, puis sans cookie ni référent", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ features: [] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await searchAddress(" ab ")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await searchAddress("10 rue & co");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://data.geopf.fr/geocodage/search/?q=10+rue+%26+co&autocomplete=1&limit=5");
    expect(init).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
  });

  it("signale un service indisponible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(searchAddress("10 rue")).rejects.toThrow("indisponible");
  });
});
