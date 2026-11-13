import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amundiFake, testBackend, testMarket } from "@hamac/backend/testkit";
import { ToastProvider } from "@/shared/lib/toast";
import type { Alert } from "@hamac/core";
import { AddressInput } from "@/features/realestate/components/AddressInput";
import { AlertList } from "@/features/dashboard/components/Alerts";
import { CompaniesCard } from "@/features/realestate/components/CompaniesCard";
import { CompositionAdminCard } from "@/features/settings/components/CompositionAdminCard";
import { ProtectionCard } from "@/features/accounts/components/ProtectionCard";
import { YearEndCard } from "@/features/tax/components/YearEndCard";
import { Bien } from "@/features/realestate/pages/Bien";
import { PriceDialog } from "@/features/investments/dialogs/PriceDialog";
import { BricksImportDialog } from "@/features/investments/dialogs/BricksImportDialog";
import { StatementImportDialog } from "@/features/journal/dialogs/StatementImportDialog";
import { makeXlsx } from "@/features/investments/lib/xlsx.fixture";
import { PriceStatus } from "@/app/components/PriceStatus";
import { Etablissements } from "@/features/settings/pages/Etablissements";
import { Parametres } from "@/features/settings/pages/Parametres";

/** Parcours réels : l'interface parle au vrai backend, sur une base en mémoire. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, file: { name: "", content: "" } as { name: string; content: string } | null, binary: { name: "", bytes: new Uint8Array() as Uint8Array }, downloads: [] as Array<{ name: string; content: string }> }));

vi.mock("@/shared/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
// Pas de sélecteur de fichier sous jsdom : le fichier « choisi » est celui que le test a préparé, les téléchargements sont notés.
vi.mock("@/shared/lib/files", () => ({
  pickTextFile: async () => h.file,
  pickBinaryFile: async () => h.binary,
  downloadText: (name: string, content: string) => void h.downloads.push({ name, content }),
}));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lignes d'entités lues telles que le backend les renvoie
type Obj = Record<string, any>;
const workspace = () => rpc<Record<string, Obj[]> & { params: Obj }>("workspace.load");

/** Chemin et paramètres de l'adresse courante, pour vérifier les liens suivis. */
function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function show(ui: ReactNode, path = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          {ui}
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  h.backend = await testBackend();
  h.file = { name: "", content: "" };
  h.downloads = [];
  // Aucun service externe pendant les parcours.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  h.backend.close();
});

/** Texte sans espaces insécables. */
const norm = (s: string | null | undefined) => (s ?? "").replace(/[\u00a0\u202f]/g, " ");
/** Valeur affichée en face d'un libellé de liste de définitions (carte d'établissement). */
const detail = (label: string) => norm(screen.getByText(label, { selector: "dt" }).nextElementSibling?.textContent);
/** Faux justETF : répond pour les ISIN donnés (dernier cours au 5 novembre 2026), échoue pour tout le reste. */
const justEtf =
  (known: Record<string, number>) =>
  async (url: string): Promise<Response> => {
    const isin = /justetf\.com\/api\/etfs\/([A-Z0-9]+)\//.exec(url)?.[1];
    const price = isin ? known[isin] : undefined;
    if (!price) return new Response("introuvable", { status: 404 });
    return Response.json({ latestQuote: { raw: price }, latestQuoteDate: "2026-11-05", series: [{ date: "2026-11-04", value: { raw: price - 1 } }] });
  };
/** Remplace le backend par un autre, branché sur un faux marché et, au besoin, sur un autre administrateur. */
async function withMarket(fetcher: (url: string) => Promise<Response>, opts: { isAdmin?: boolean; twelveDataKey?: string } = {}) {
  h.backend.close();
  const market = await testMarket(fetcher, opts.twelveDataKey ? { twelveDataKey: opts.twelveDataKey } : undefined);
  h.backend = await testBackend({ market, isAdmin: opts.isAdmin ?? true });
}
const fieldOf = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
/** Bloc titré d'une fenêtre d'établissement (PEA, Compte-titres, Assurance-vie…). */
const section = (title: string) => within(screen.getByRole("heading", { name: title }).closest("div.rounded-xl") as HTMLElement);
async function fill(user: ReturnType<typeof userEvent.setup>, el: HTMLElement, text: string) {
  await user.clear(el);
  await user.type(el, text);
  await user.tab();
}
const institution = (name: string, extra: Obj = {}) => rpc<{ id: string }>("institutions.upsert", { name, kind: "courtier", ...extra });
const grid = (fixed: number, rate = 0, extra: Obj = {}) => ({ orderFees: { tiers: [{ upTo: null, fixed, rate }], ...extra }, custodyFixed: 0, custodyRate: 0 });

describe("établissements", () => {
  it("état vide : création d'un courtier avec sa grille à paliers, copiée sur le compte-titres, puis carte et comparatif", async () => {
    const user = userEvent.setup();
    show(<Etablissements />, "/?nouveau=1");
    expect(await screen.findByText(/Aucun établissement\./)).toBeTruthy();
    const dialog = await screen.findByRole("dialog", { name: "Nouvel établissement" });
    expect((within(dialog).getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(fieldOf("Nom"), "Courtier Fictif");
    fireEvent.change(fieldOf("Site web"), { target: { value: "https://courtier.exemple" } });
    await fill(user, fieldOf("Note /10"), "14");
    // La note est plafonnée à 10.
    expect(fieldOf("Note /10").value).toBe("10");

    const pea = section("PEA");
    await user.click(pea.getByRole("button", { name: "Ajouter un palier" }));
    await fill(user, pea.getByLabelText("Ordre jusqu'à"), "1000");
    await fill(user, pea.getAllByLabelText("Montant fixe")[0]!, "2");
    await fill(user, pea.getByLabelText("Frais minimum par ordre"), "1");
    await fill(user, pea.getByLabelText("Frais maximum par ordre"), "10");
    await fill(user, pea.getByLabelText("Droits de garde / tenue de compte (€ par an)"), "12");
    await fill(user, pea.getByLabelText("Droits de garde (% de l'encours par an)"), "0,2");
    await user.selectOptions(pea.getByLabelText("ETF monde éligible au PEA"), "Oui");
    await user.selectOptions(pea.getByLabelText("Investissement programmé"), "Non");
    await user.selectOptions(pea.getByLabelText("Service client joignable"), "Oui");
    // Coût d'un ordre : le palier de 2 € sur 100 € dépasse 1 %, il est signalé.
    expect(pea.getByText(/100 € → 2,00 € \(2 %\)/)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Même grille que le PEA" }));
    const cto = section("Compte-titres");
    expect((cto.getByLabelText("Ordre jusqu'à") as HTMLInputElement).value).toBe("1 000");
    await user.selectOptions(cto.getByLabelText("Obligations accessibles en direct"), "Oui");
    // Le dernier palier (« au-delà ») ne peut pas être supprimé, les autres si.
    const deletes = cto.getAllByRole("button", { name: "Supprimer ce palier" }) as HTMLButtonElement[];
    expect(deletes.map((b) => b.disabled)).toEqual([false, true]);
    await user.click(deletes[0]!);
    expect(cto.queryByLabelText("Ordre jusqu'à")).toBeNull();
    expect(cto.getByText("Tout montant")).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Le paramètre d'adresse qui ouvrait la création est retiré à la fermeture.
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
    expect(await screen.findByRole("heading", { name: "Courtier Fictif" })).toBeTruthy();
    expect(screen.getByText("10/10")).toBeTruthy();
    expect(screen.getByRole("link", { name: /site/ }).getAttribute("href")).toBe("https://courtier.exemple");
    expect(detail("Garde (PEA)")).toBe("12,00 €/an + 0.2 %/an");
    expect(detail("PEA")).toBe("jusqu'à 1 000 € : 2 € · au-delà de 1 000 € : gratuit (min. 1 €, max. 10 €)");
    expect(detail("Compte-titres")).toMatch(/gratuit/);
    expect(screen.getByText("À l'étude")).toBeTruthy();
    expect(screen.getByText("Comparer le courtage")).toBeTruthy();

    const saved = (await workspace()).institutions[0]!;
    expect(saved).toMatchObject({ name: "Courtier Fictif", kind: "courtier", score: 10, website: "https://courtier.exemple" });
    expect(saved.offers.pea).toMatchObject({ custodyFixed: 12, custodyRate: 0.002, etfWorld: true, programmed: false, reachableSupport: true });
    expect(saved.offers.pea.orderFees).toMatchObject({ min: 1, max: 10, tiers: [{ upTo: 1000, fixed: 2, rate: 0 }, { upTo: null, fixed: 0, rate: 0 }] });
    expect(saved.offers.cto.orderFees.tiers).toEqual([{ upTo: null, fixed: 0, rate: 0 }]);
    expect(saved.offers.cto.directBonds).toBe(true);
  });

  it("cartes, comparatifs triables et frais par défaut ; suppression confirmée qui détache les comptes", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await institution("Courtier Alpha", {
      score: 7.5,
      comment: "Grille relevée en janvier",
      offers: { pea: grid(1.9), cto: { ...grid(0, 0.001, { max: 20 }), custodyRate: 0.002 } },
      tax: { report: false, withholds: false },
    });
    await institution("Courtier Beta", {
      offers: { pea: { ...grid(0), custodyFixed: 5, orderFees: { tiers: [{ upTo: 500, fixed: 1, rate: 0 }, { upTo: null, fixed: 0, rate: 0.001 }] } }, cto: grid(3) },
    });
    await institution("Assureur Alpha", {
      kind: "assureur",
      score: 8.5,
      offers: { assurance_vie: { entryFee: 0, euroFee: 0.007, ucFee: 0.005, euroRateLast: 0.025, euroRate5y: 0.02, full100Euro: true, bonusConditioned: false, etfWorld: true, programmedFrom: 50, insurer: "Assureur SA" } },
    });
    await institution("Assureur Beta", { kind: "assureur", offers: { assurance_vie: { entryFee: 0.01, euroFee: 0.008, ucFee: 0.0075, euroRateLast: 0.028, euroRate5y: 0.021 } } });
    await institution("Crypto Alpha", { kind: "crypto", score: 6, offers: { crypto: { tradeFee: 0.01, spread: 0.005 } } });
    await institution("Crypto Beta", { kind: "crypto", offers: { crypto: { tradeFee: 0.0149, spread: 0.002 } } });
    const banque = await institution("Banque Fictive", { kind: "banque", website: "", offers: { livret: {} } });
    await rpc("accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP Fictif", institutionId: banque.id });

    show(<Etablissements />);
    expect(await screen.findByRole("heading", { name: "Banque Fictive" })).toBeTruthy();
    const card = (name: string) => within(screen.getByRole("heading", { name }).closest("div.rounded-2xl") as HTMLElement);

    // Cartes : frais de chaque offre, impôts, crypto, comptes rattachés ou « à l'étude ».
    const alpha = card("Courtier Alpha");
    expect(alpha.getByText("7,5/10")).toBeTruthy();
    expect(norm(alpha.getByText("Garde (CTO)").nextElementSibling?.textContent)).toBe("0.2 %/an");
    expect(alpha.getByText("rien n'est prélevé : à déclarer soi-même")).toBeTruthy();
    expect(alpha.getByText("Grille relevée en janvier")).toBeTruthy();
    expect(alpha.getByText("À l'étude")).toBeTruthy();
    expect(norm(card("Assureur Alpha").getByText("Assurance-vie", { selector: "dt" }).nextElementSibling?.textContent)).toBe("versements 0 % · gestion fonds euros 0,7 % · UC 0,5 %");
    expect(norm(card("Crypto Alpha").getByText("Crypto", { selector: "dt" }).nextElementSibling?.textContent)).toBe("1 % par opération · spread 0,5 %");
    const bank = card("Banque Fictive");
    expect(bank.getByText("prélevés à la source par l'établissement")).toBeTruthy();
    expect(bank.getByText("LEP Fictif")).toBeTruthy();
    expect(bank.queryByText("À l'étude")).toBeNull();

    // Comparatif du courtage : la grille la moins chère de chaque type de compte est en valeur.
    const table = (title: string) => within(screen.getByRole("heading", { name: title }).closest("div.rounded-2xl") as HTMLElement);
    const names = (title: string) => table(title).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.firstChild!.textContent);
    const courtage = table("Comparer le courtage");
    const peaRows = courtage.getAllByRole("row").filter((r) => within(r).queryByText("PEA", { selector: "td" }));
    expect(peaRows).toHaveLength(2);
    // Ordre de 100 € : Beta prend 1 € contre 1,90 € chez Alpha.
    const best = (row: HTMLElement) => [...row.querySelectorAll("td.text-positive")].map((c) => norm(c.firstChild?.textContent));
    const beta = peaRows.find((r) => within(r).queryByText("Courtier Beta"))!;
    const alphaPea = peaRows.find((r) => within(r).queryByText("Courtier Alpha"))!;
    expect(norm(within(alphaPea).getAllByRole("cell")[2]!.firstChild!.textContent)).toBe("1,90 €");
    // Sur un ordre de 5 000 €, c'est l'inverse : 1,90 € contre 5 € (0,1 %).
    expect(best(alphaPea)).toEqual(["1,90 €"]);
    expect(best(beta)).toEqual(["1,00 €", "1,00 €", "1,00 €", "1,00 €"]);
    await user.click(courtage.getByRole("button", { name: "Établissement" }));
    expect(names("Comparer le courtage")).toEqual(["Courtier Alpha", "Courtier Alpha", "Courtier Beta", "Courtier Beta"]);
    await user.click(courtage.getByRole("button", { name: "Établissement" }));
    expect(names("Comparer le courtage")[0]).toBe("Courtier Beta");
    for (const col of courtage.getAllByRole("button", { name: /^(Compte|Ordre de|ETF monde|Obligations|Programmé)/ })) await user.click(col);
    await user.click(courtage.getByRole("button", { name: "Garde / an" }));
    expect(names("Comparer le courtage").slice(0, 2)).toEqual(["Courtier Alpha", "Courtier Beta"]);

    // Assurances-vie : meilleur taux, meilleurs frais, tri par colonne.
    const av = table("Comparer les assurances-vie");
    const avRows = av.getAllByRole("row").slice(1);
    expect(avRows).toHaveLength(2);
    const alphaAv = avRows.find((r) => within(r).queryByText("Assureur Alpha"))!;
    const betaAv = avRows.find((r) => within(r).queryByText("Assureur Beta"))!;
    expect(within(alphaAv).getByText("Assureur SA")).toBeTruthy();
    expect(alphaAv.querySelectorAll("td.text-positive")).toHaveLength(3);
    expect(betaAv.querySelectorAll("td.text-positive")).toHaveLength(2);
    // Le tableau écrit la note avec un point (« 8.5/10 »), la carte avec une virgule.
    expect(within(alphaAv).getByText("8.5/10")).toBeTruthy();
    expect(within(alphaAv).getByText(/^50/)).toBeTruthy();
    expect(within(betaAv).getAllByText("—").length).toBeGreaterThan(2);
    for (const col of ["Contrat", "Frais sur versements", "Gestion fonds euros", "Gestion UC", "Fonds euros : dernier taux", "Moyenne 5 ans", "100 % fonds euros", "Bonus conditionné", "ETF monde", "Programmé dès", "Note"]) {
      await user.click(av.getByRole("button", { name: col }));
    }
    expect(names("Comparer les assurances-vie")).toHaveLength(2);

    // Plateformes crypto : coût total d'un achat, le plus bas en valeur.
    const crypto = table("Comparer les plateformes crypto");
    const cryptoRows = crypto.getAllByRole("row").slice(1);
    expect(within(cryptoRows.find((r) => within(r).queryByText("Crypto Alpha"))!).getByText("1,5 %").className).toContain("text-positive");
    expect(within(cryptoRows.find((r) => within(r).queryByText("Crypto Beta"))!).getByText("1,69 %").className).not.toContain("text-positive");
    for (const col of ["Plateforme", "Frais par opération", "Spread estimé", "Coût total d'un achat", "Note"]) await user.click(crypto.getByRole("button", { name: col }));
    expect(names("Comparer les plateformes crypto")).toHaveLength(2);

    // Frais par défaut : le bouton ne s'allume qu'avec une modification.
    const save = screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await fill(user, fieldOf("Courtage (% par ordre)"), "0,5");
    await fill(user, fieldOf("Courtage minimum"), "1,5");
    await fill(user, fieldOf("Crypto (% par opération)"), "1,2");
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(await screen.findByText("Frais par défaut enregistrés")).toBeTruthy();
    expect((await workspace()).params).toMatchObject({ broker: { feeRate: 0.005, minFee: 1.5 }, crypto: { feeRate: 0.012 } });
    await waitFor(() => expect(save.disabled).toBe(true));

    // Suppression : refusée, la fiche reste ; acceptée, le compte repasse sans établissement.
    await user.click(bank.getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer « Banque Fictive » ? Les comptes rattachés repasseront sur les frais par défaut.");
    expect((await workspace()).institutions).toHaveLength(7);
    confirm.mockReturnValue(true);
    await user.click(bank.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Établissement supprimé")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Banque Fictive" })).toBeNull());
    const ws = await workspace();
    expect(ws.institutions).toHaveLength(6);
    expect(ws.accounts[0]).toMatchObject({ name: "LEP Fictif", institutionId: null });
  });

  it("fiche d'avant le réglage commun : le taux de la plateforme passe dans les taux retenus, enregistré tel quel", async () => {
    const user = userEvent.setup();
    await institution("Plateforme Ancienne", { kind: "crowdlending", offers: { crowdlending: { taxWithheld: true, taxRate: 0.3 } } });
    show(<Etablissements />);
    await user.click(await screen.findByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier « Plateforme Ancienne »" });
    expect((within(dialog).getByRole("checkbox", { name: "L'établissement prélève les impôts sur les intérêts et dividendes" }) as HTMLInputElement).checked).toBe(true);
    // 30 % = 12,8 % d'acompte (PFU) + 17,2 % de prélèvements sociaux.
    expect(fieldOf("Acompte d'impôt retenu").value).toBe("12,8");
    expect(fieldOf("Prélèvements sociaux retenus").value).toBe("17,2");
    expect(within(dialog).getByText(/Pas de frais à régler ici/)).toBeTruthy();
    expect(within(dialog).getByText(/Vide : 12,8 %/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Établissement mis à jour")).toBeTruthy();
    expect((await workspace()).institutions[0]!.tax).toMatchObject({ withholds: true, withheldIncomeTax: 0.128, withheldSocial: 0.172 });
  });

  it("décocher une offre utilisée par un compte demande confirmation ; les autres offres se cochent et se règlent", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const courtier = await institution("Courtier Fictif", { offers: { pea: grid(0), cto: grid(0) } });
    await institution("Autre Assureur", { kind: "assureur", protection: { guarantor: "Groupe Garant", country: "france" }, offers: { assurance_vie: { insurer: "Assureur Tiers" } } });
    await rpc("accounts.upsert", { kind: "pea", name: "PEA Fictif", institutionId: courtier.id });
    await rpc("accounts.upsert", { kind: "cto", name: "CTO Un", institutionId: courtier.id });
    await rpc("accounts.upsert", { kind: "cto", name: "CTO Deux", institutionId: courtier.id });
    show(<Etablissements />);
    const fiche = within((await screen.findByRole("heading", { name: "Courtier Fictif" })).closest("div.rounded-2xl") as HTMLElement);
    await user.click(fiche.getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Comptes proposés")).toBeTruthy();
    const toggle = (name: RegExp) => dialog.getByRole("button", { name }) as HTMLButtonElement;
    expect(toggle(/^(✓ )?PEA/).textContent).toBe("✓ PEA(1 compte)");
    expect(toggle(/^(✓ )?Compte-titres/).textContent).toBe("✓ Compte-titres(2 comptes)");

    // Refus : l'offre reste cochée. Accord : elle disparaît, et on peut la recocher à vide.
    await user.click(toggle(/^(✓ )?Compte-titres/));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirm.mock.calls[0]![0])).toMatch(/^CTO (Un|Deux), CTO (Un|Deux) utilise cette offre : ses frais repasseront sur les frais par défaut\. Continuer \?$/);
    expect(toggle(/^(✓ )?Compte-titres/).getAttribute("aria-pressed")).toBe("true");
    confirm.mockReturnValue(true);
    await user.click(toggle(/^(✓ )?Compte-titres/));
    expect(toggle(/^(✓ )?Compte-titres/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByRole("heading", { name: "Compte-titres" })).toBeNull();
    await user.click(toggle(/^(✓ )?Compte-titres/));
    expect(screen.getByRole("heading", { name: "Compte-titres" })).toBeTruthy();
    // Sans compte rattaché, aucune confirmation (la précédente avait déjà été comptée).
    await user.click(toggle(/^Livret/));
    expect(dialog.getByText(/Pas de frais\. Le taux et le plafond se règlent sur chaque livret/)).toBeTruthy();
    await user.click(toggle(/^Crowdlending/));
    expect(dialog.getByText(/Les impôts sur les intérêts se règlent dans la rubrique Fiscalité/)).toBeTruthy();
    await user.click(toggle(/^Plateforme crypto/));
    await fill(user, dialog.getByLabelText("Frais par achat ou vente"), "1,5");
    await fill(user, dialog.getByLabelText("Écart de prix (spread) estimé"), "0,4");
    await user.click(toggle(/^Assurance-vie/));
    const av = section("Assurance-vie");
    await fill(user, av.getByLabelText("Frais sur versements"), "0,5");
    await fill(user, av.getByLabelText("Frais de gestion du fonds euros (par an)"), "0,6");
    await fill(user, av.getByLabelText("Frais de gestion des unités de compte (par an)"), "0,7");
    await fill(user, av.getByLabelText("Frais d'arbitrage"), "0,1");
    await fill(user, av.getByLabelText("Fonds euros : dernier taux servi"), "2,6");
    await fill(user, av.getByLabelText("Fonds euros : moyenne sur 5 ans"), "2,1");
    await fill(user, av.getByLabelText("Versements programmés dès"), "50");
    await user.type(av.getByLabelText("Assureur"), "Assureur Maison");
    for (const label of ["100 % fonds euros possible", "Bonus conditionné à une part de risque", "ETF monde disponible", "Fonds datés"]) await user.selectOptions(av.getByLabelText(label), "Oui");
    await user.selectOptions(av.getByLabelText("Fonds datés"), "—");
    expect(dialog.getByText(/Pour l'assurance-vie, c'est l'assureur \(Assureur Maison\) qui compte/)).toBeTruthy();

    // Établissement garant : liste des noms déjà saisis ailleurs (garant ou assureur), pays au choix.
    const garant = dialog.getByLabelText("Établissement garant") as HTMLInputElement;
    const known = [...document.querySelectorAll(`datalist#${CSS.escape(garant.getAttribute("list") ?? "")} option`)].map((o) => (o as HTMLOptionElement).value);
    expect(known).toEqual(["Assureur Tiers", "Groupe Garant"]);
    expect(dialog.getByText(/Vide : Courtier Fictif\./)).toBeTruthy();
    await user.type(garant, "Groupe Garant");
    await user.selectOptions(dialog.getByLabelText("Pays de l'établissement"), "ue");

    // Les deux cases d'impôts : tout décocher cache les taux ; cocher le récapitulatif fiscal.
    await user.click(dialog.getByRole("checkbox", { name: "L'établissement prélève les impôts sur les intérêts et dividendes" }));
    expect(dialog.queryByLabelText("Acompte d'impôt retenu")).toBeNull();
    expect(dialog.getByText(/Décoché : le montant reçu est le brut/)).toBeTruthy();
    await user.click(dialog.getByRole("checkbox", { name: "Hamac rédige le récapitulatif fiscal de cet établissement" }));
    await user.type(dialog.getByLabelText("Commentaire"), "Frais à revérifier");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Établissement mis à jour")).toBeTruthy();

    const saved = (await workspace()).institutions.find((i) => i.name === "Courtier Fictif")!;
    expect(saved).toMatchObject({ comment: "Frais à revérifier", protection: { guarantor: "Groupe Garant", country: "ue" }, tax: { report: true, withholds: false } });
    expect(Object.keys(saved.offers).sort()).toEqual(["assurance_vie", "crowdlending", "crypto", "cto", "livret", "pea"]);
    expect(saved.offers.crypto).toMatchObject({ tradeFee: 0.015, spread: 0.004 });
    expect(saved.offers.assurance_vie).toMatchObject({ entryFee: 0.005, euroFee: 0.006, ucFee: 0.007, arbitrageFee: 0.001, euroRateLast: 0.026, euroRate5y: 0.021, programmedFrom: 50, insurer: "Assureur Maison", full100Euro: true, bonusConditioned: true, etfWorld: true, datedFunds: null });
  });

  it("nouvel établissement : le type pré-coche les comptes habituels et garde le nom saisi ; annuler ne crée rien", async () => {
    const user = userEvent.setup();
    show(<Etablissements />);
    await user.click(await screen.findByRole("button", { name: "Ajouter un établissement" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouvel établissement" }));
    await user.type(dialog.getByLabelText("Nom"), "Plateforme Neuve");
    expect(dialog.getByRole("button", { name: /^(✓ )?PEA/ }).getAttribute("aria-pressed")).toBe("true");
    await user.selectOptions(dialog.getByLabelText("Type"), "crypto");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Plateforme Neuve");
    expect(dialog.getByRole("button", { name: /^(✓ )?PEA/ }).getAttribute("aria-pressed")).toBe("false");
    expect(dialog.getByRole("button", { name: /^✓ Plateforme crypto/ })).toBeTruthy();
    // Annuler ne crée rien.
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await workspace()).institutions).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Ajouter un établissement" }));
    await user.type(await screen.findByLabelText("Nom"), "Banque Neuve");
    await user.selectOptions(fieldOf("Type"), "banque");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Établissement ajouté")).toBeTruthy();
    expect((await workspace()).institutions[0]).toMatchObject({ name: "Banque Neuve", kind: "banque", tax: { withholds: true } });
  });
});

describe("paramètres › comptes", () => {
  const openAccounts = async () => {
    show(<Parametres />, "/?onglet=Comptes");
    return screen.findByRole("button", { name: "Nouveau compte" });
  };
  const dialogOf = async (name: string | RegExp) => within(await screen.findByRole("dialog", { name }));

  it("nouveau livret : le type règle le nom et le plafond légal, le taux est daté ; le tableau l'affiche", async () => {
    const user = userEvent.setup();
    expect(await openAccounts()).toBeTruthy();
    expect(await screen.findByText("Aucun compte.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nouveau compte" }));
    const dialog = await dialogOf("Nouveau compte");
    expect((dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    // Par défaut un LEP : son plafond légal est pré-rempli ; changer de livret change nom et plafond.
    expect((dialog.getByLabelText("Plafond de dépôt") as HTMLInputElement).value).toBe("10 000");
    expect(dialog.getByText("Ajoutez vos établissements et leurs frais dans Paramètres › Établissements.")).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Livret"), "LIVRET_A");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Livret A");
    expect((dialog.getByLabelText("Plafond de dépôt") as HTMLInputElement).value).toBe("22 950");
    // Un nom personnalisé n'est plus écrasé par le changement de livret.
    await user.clear(dialog.getByLabelText("Nom"));
    await user.type(dialog.getByLabelText("Nom"), "Mon livret");
    await user.selectOptions(dialog.getByLabelText("Livret"), "LDDS");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Mon livret");
    expect((dialog.getByLabelText("Plafond de dépôt") as HTMLInputElement).value).toBe("12 000");
    await user.selectOptions(dialog.getByLabelText("Livret"), "AUTRE");
    expect((dialog.getByLabelText("Plafond de dépôt") as HTMLInputElement).value).toBe("");
    // Le livret « Autre » peut être joint : la part détenue apparaît, bornée entre 1 % et 100 %.
    await fill(user, dialog.getByLabelText("Part détenue"), "50");
    await fill(user, dialog.getByLabelText("Taux actuel"), "1,5");
    fireEvent.change(dialog.getByLabelText("En vigueur depuis le"), { target: { value: "2026-02-01" } });
    fireEvent.change(dialog.getByLabelText("Date d'ouverture"), { target: { value: "2020-03-04" } });
    await user.type(dialog.getByLabelText("Rôle dans le plan"), "Matelas de sécurité");
    await user.selectOptions(dialog.getByLabelText("Allocation cible"), "Hors allocation");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Compte créé")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const saved = (await workspace()).accounts[0]!;
    expect(saved).toMatchObject({ kind: "livret", livretType: "AUTRE", name: "Mon livret", rate: 0.015, share: 0.5, role: "Matelas de sécurité", openedOn: "2020-03-04", inAllocation: false, archived: false });
    const row = (await screen.findByText("Mon livret")).closest("tr")!;
    expect(within(row).getByText("Livret")).toBeTruthy();
    expect(within(row).getByText("1,5 %")).toBeTruthy();
    expect(within(row).getByText("04/03/2020")).toBeTruthy();
    expect(within(row).getByText("Matelas de sécurité")).toBeTruthy();
    // Livret A, LDDS, LEP : un seul de chaque ; « Autre » reste libre.
    await rpc("accounts.upsert", { kind: "livret", livretType: "LDDS", name: "LDDS" });
    cleanup();
    await openAccounts();
    await user.click(screen.getByRole("button", { name: "Nouveau compte" }));
    const again = await dialogOf("Nouveau compte");
    expect((again.getByRole("option", { name: "LDDS (déjà ouvert)" }) as HTMLOptionElement).disabled).toBe(true);
    expect((again.getByRole("option", { name: "Autre livret" }) as HTMLOptionElement).disabled).toBe(false);
  });

  it("types de compte : PEA unique par personne, assurance-vie et ses frais, compte-titres joint, établissement sans offre du type", async () => {
    const user = userEvent.setup();
    const courtier = await institution("Courtier Fictif", { offers: { cto: grid(0) } });
    await institution("Banque Fictive", { kind: "banque", offers: { livret: {} } });
    await rpc("accounts.upsert", { kind: "pea", name: "PEA Existant" });
    await openAccounts();
    await user.click(screen.getByRole("button", { name: "Nouveau compte" }));
    const dialog = await dialogOf("Nouveau compte");
    expect((dialog.getByRole("option", { name: "PEA (déjà ouvert : un seul par personne)" }) as HTMLOptionElement).disabled).toBe(true);
    expect((dialog.getByRole("option", { name: /^PEA-PME/ }) as HTMLOptionElement).disabled).toBe(false);

    // Assurance-vie : frais d'entrée et de gestion, clause bénéficiaire ; règle des 8 ans.
    await user.selectOptions(dialog.getByLabelText("Type de compte"), "assurance_vie");
    expect(dialog.queryByLabelText("Livret")).toBeNull();
    expect(dialog.getByText("Sert à la règle des 8 ans.")).toBeTruthy();
    await user.type(dialog.getByLabelText("Nom"), "AV Fictive");
    await fill(user, dialog.getByLabelText("Frais sur versements"), "1");
    await fill(user, dialog.getByLabelText("Frais de gestion du fonds euros"), "0,6");
    await user.click(dialog.getByRole("checkbox", { name: "Clause bénéficiaire rédigée" }));
    // Établissement : groupés selon qu'ils proposent ou non ce type de compte.
    const etab = dialog.getByLabelText("Établissement") as HTMLSelectElement;
    expect([...etab.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Autres établissements"]);
    await user.selectOptions(etab, courtier.id);
    expect(dialog.getByText("Cet établissement n'a pas d'offre de ce type : les frais par défaut s'appliquent.")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Compte créé")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await workspace()).accounts.find((a) => a.name === "AV Fictive")).toMatchObject({ kind: "assurance_vie", entryFeeRate: 0.01, managementFeeRate: 0.006, beneficiaryClause: true, institutionId: courtier.id });

    // Compte-titres : l'établissement qui propose ce compte est listé en premier ; compte joint à 50 %.
    await user.click(screen.getByRole("button", { name: "Nouveau compte" }));
    const cto = await dialogOf("Nouveau compte");
    await user.selectOptions(cto.getByLabelText("Type de compte"), "cto");
    await user.type(cto.getByLabelText("Nom"), "CTO joint");
    expect([...(cto.getByLabelText("Établissement") as HTMLSelectElement).querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Proposent un compte-titres", "Autres établissements"]);
    await user.selectOptions(cto.getByLabelText("Établissement"), courtier.id);
    await fill(user, cto.getByLabelText("Part détenue"), "0");
    expect((cto.getByLabelText("Part détenue") as HTMLInputElement).value).toBe("1");
    await fill(user, cto.getByLabelText("Part détenue"), "50");
    await user.click(cto.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).accounts.find((a) => a.name === "CTO joint")).toMatchObject({ kind: "cto", share: 0.5, institutionId: courtier.id }));
  });

  it("le PEA propose un délai d'investissement de l'apport ; modifier un compte l'archive ; l'archivé reste listé et sa suppression se confirme", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await openAccounts();
    await user.click(screen.getByRole("button", { name: "Nouveau compte" }));
    const dialog = await dialogOf("Nouveau compte");
    await user.selectOptions(dialog.getByLabelText("Type de compte"), "pea");
    expect(dialog.getByText("Sert à la règle des 5 ans.")).toBeTruthy();
    expect((dialog.getByLabelText("Mois pour investir l'apport de départ") as HTMLInputElement).value).toBe("12");
    // Au moins un mois ; un nombre entier.
    await fill(user, dialog.getByLabelText("Mois pour investir l'apport de départ"), "0");
    expect((dialog.getByLabelText("Mois pour investir l'apport de départ") as HTMLInputElement).value).toBe("1");
    await fill(user, dialog.getByLabelText("Mois pour investir l'apport de départ"), "6");
    await user.type(dialog.getByLabelText("Nom"), "PEA Fictif");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).accounts[0]).toMatchObject({ kind: "pea", monthsToInvest: 6 }));

    const row = () => screen.getByText("PEA Fictif").closest("tr")!;
    await user.click(within(row()).getByRole("button", { name: "Modifier" }));
    const edit = await dialogOf("Modifier « PEA Fictif »");
    // Un compte existant n'a pas la mention « déjà ouvert » pour son propre type.
    expect((edit.getByRole("option", { name: "PEA" }) as HTMLOptionElement).disabled).toBe(false);
    await user.click(edit.getByRole("checkbox", { name: "Archivé (masqué des listes, l'historique est conservé)" }));
    await user.click(edit.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Compte mis à jour")).toBeTruthy();
    await waitFor(() => expect(within(row()).getByText("archivé")).toBeTruthy());
    expect((await workspace()).accounts[0]!.archived).toBe(true);

    await user.click(within(row()).getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer « PEA Fictif » ?");
    expect((await workspace()).accounts).toHaveLength(1);
    confirm.mockReturnValue(true);
    await user.click(within(row()).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Compte supprimé")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Aucun compte.")).toBeTruthy());
    expect((await workspace()).accounts).toHaveLength(0);
  });

  it("le tableau des comptes se trie par colonne", async () => {
    const user = userEvent.setup();
    const courtier = await institution("Courtier Fictif", { offers: { cto: grid(0) } });
    await rpc("accounts.upsert", { kind: "livret", livretType: "LDDS", name: "LDDS", rate: 0.02, depositCeiling: 12_000, openedOn: "2021-01-01", role: "Réserve" });
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres", institutionId: courtier.id });
    await openAccounts();
    const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.textContent!.trim());
    await waitFor(() => expect(rows()).toHaveLength(2));
    for (const col of ["Nom", "Type", "Établissement", "Ouvert le", "Taux", "Plafond", "Rôle"]) await user.click(within(screen.getByRole("table")).getByRole("button", { name: col }));
    // Dernier tri : par rôle, croissant ; les comptes sans rôle passent après.
    expect(rows()).toEqual(["LDDS", "Compte-titres"]);
    await user.click(within(screen.getByRole("table")).getByRole("button", { name: "Établissement" }));
    expect(rows()).toEqual(["Compte-titres", "LDDS"]);
  });
});

describe("paramètres › plan et répartition", () => {
  const year = new Date().getFullYear();
  const bar = () => screen.getByText(/point\(s\) à corriger|Modifications non enregistrées/);
  const saveBar = () => screen.getAllByRole("button", { name: "Enregistrer" }).at(-1) as HTMLButtonElement;

  it("plan : champs liés entre eux, points à corriger nommés, annuler, enregistrer", async () => {
    const user = userEvent.setup();
    show(<Parametres />);
    const birth = await screen.findByLabelText("Année de naissance");
    // Usage : sans projection de retraite, les âges visés disparaissent ; on peut revenir.
    await user.click(screen.getByRole("radio", { name: /Gérer mon patrimoine/ }));
    expect(screen.queryByLabelText("Âge de départ visé")).toBeNull();
    expect(screen.getByRole("radio", { name: /Gérer mon patrimoine/ }).getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("radio", { name: /Préparer ma retraite/ }));
    expect(fieldOf("Âge de départ visé")).toBeTruthy();
    expect(bar().textContent).toBe("Modifications non enregistrées");
    await fill(user, birth as HTMLInputElement, "1990");
    expect(screen.getByText(`Âge cette année : ${year - 1990} ans.`)).toBeTruthy();
    await fill(user, fieldOf("Âge de départ visé"), "62");
    expect(screen.getByText(`Départ en ${1990 + 62}.`)).toBeTruthy();
    expect(bar().textContent).toBe("Modifications non enregistrées");

    // Un âge horizon qui ne dépasse pas le départ, une sécurisation après le départ : deux erreurs, nommées sous le champ.
    await fill(user, fieldOf("Âge horizon (fin des retraits)"), "60");
    expect(await screen.findByText("L'âge horizon doit dépasser l'âge de départ.")).toBeTruthy();
    await fill(user, fieldOf("Âge de début de sécurisation"), "70");
    expect(await screen.findByText("L'âge de sécurisation doit précéder (ou égaler) l'âge de départ.")).toBeTruthy();
    expect(bar().textContent).toBe("2 point(s) à corriger (Plan)");
    expect(saveBar().disabled).toBe(true);

    // Annuler remet les valeurs enregistrées.
    await user.click(screen.getAllByRole("button", { name: "Annuler" }).at(-1)!);
    expect(fieldOf("Âge horizon (fin des retraits)").value).toBe("90");
    expect(fieldOf("Âge de départ visé").value).toBe("64");

    // Enregistrer : fiscalité, hypothèses, modules, seuils.
    await fill(user, fieldOf("Âge de départ visé"), "65");
    await user.selectOptions(screen.getByLabelText("Tranche marginale d'imposition (TMI)"), "0");
    expect(screen.getByText(/Barème \(plus avantageux\)/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Tranche marginale d'imposition (TMI)"), "0.3");
    expect(screen.getByText(/Flat tax 12,8 %/)).toBeTruthy();
    // La dispense de l'acompte se règle désormais année par année, dans la page Impôts.
    expect(screen.getByRole("link", { name: "Impôts" }).getAttribute("href")).toBe("/impots");
    await user.click(screen.getByRole("checkbox", { name: "Imposition en couple" }));
    await user.click(screen.getByRole("checkbox", { name: "Crypto" }));
    await fill(user, screen.getByLabelText("Inflation") as HTMLInputElement, "2,5");
    await fill(user, fieldOf("Revenus nets par mois"), "4200");
    await fill(user, fieldOf("Jour des versements"), "15");
    await fill(user, fieldOf("Concentration maximale"), "35");
    fireEvent.change(fieldOf("Premier mois des versements"), { target: { value: "2030-02" } });
    expect(saveBar().disabled).toBe(false);
    await user.click(saveBar());
    expect(await screen.findByText("Paramètres enregistrés")).toBeTruthy();
    const { params } = await workspace();
    expect(params).toMatchObject({
      profile: { retirementAge: 65, couple: true, netMonthlyIncome: 4200, contributionDay: 15, startMonth: "2030-02" },
      tax: { tmi: 0.3, withholdingDispenses: [] },
      returns: { inflation: 0.025 },
      alerts: { concentrationMax: 0.35 },
      modules: { crypto: false, immobilier: true },
    });
    // Une fois enregistré, la barre redevient discrète et les champs restent à jour.
    await waitFor(() => expect(fieldOf("Âge de départ visé").value).toBe("65"));
  });

  it("répartition : allocations personnalisées ajoutées, chaînées, modifiées et supprimées, puis enregistrées ; anciennes cibles retirées signalées", async () => {
    const user = userEvent.setup();
    const pea = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA Fictif" });
    await rpc("accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP" });
    const current = (await workspace()).params;
    await rpc("params.update", { ...current, removedTargets: [{ label: "Ancien compte", share: 0.2 }], customClasses: [{ id: "classe-or", label: "Métaux précieux", color: "#aa8844" }] });
    show(<Parametres />, "/?onglet=Répartition");
    expect(await screen.findByText(/Ces anciennes cibles posées sur des comptes ont été retirées : Ancien compte \(20,0\s%\)/)).toBeTruthy();
    expect(screen.getByText(/Aucune pour l'instant\. Exemple/)).toBeTruthy();

    // Première ligne : 30 % des versements sur le PEA, jusqu'à 5 000 € versés.
    await user.click(screen.getByRole("button", { name: "Ajouter une allocation" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await user.selectOptions(dialog.getByLabelText("Vise"), `compte:${pea.id}`);
    await fill(user, dialog.getByLabelText("Part"), "30");
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "verse");
    await fill(user, dialog.getByLabelText("Montant versé à atteindre"), "5000");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    const row = (await screen.findByText("PEA Fictif", { selector: "td div" })).closest("tr")!;
    expect(norm(row.textContent)).toBe("PEA FictifVersements30,0 %jusqu'à 5 000 € versésaux autres lignes");

    // Deuxième ligne : 20 % sur les livrets, nommée ; la limite de la première renvoie vers elle.
    await user.click(screen.getByRole("button", { name: "Ajouter une allocation" }));
    dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await user.type(dialog.getByLabelText("Nom (facultatif)"), "Réserve");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText(/^50,0\s%$/, { selector: "b" })).toBeTruthy();
    await user.dblClick(row);
    dialog = within(await screen.findByRole("dialog", { name: "Modifier l'allocation" }));
    await user.selectOptions(dialog.getByLabelText("Ensuite, la part va"), within(dialog.getByLabelText("Ensuite, la part va")).getByRole("option", { name: /Réserve/ }));
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(norm(row.textContent)).toMatch(/vers « Réserve »/));

    // Modifier par le crayon ; supprimer une ligne détache celles qui y renvoyaient.
    await user.click(within(screen.getByText("Réserve").closest("tr")!).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(screen.queryByText("Réserve")).toBeNull());
    expect(norm(row.textContent)).toMatch(/aux autres lignes/);
    await user.click(within(row).getByRole("button", { name: "Modifier" }));
    dialog = within(await screen.findByRole("dialog", { name: "Modifier l'allocation" }));
    await user.click(dialog.getByRole("button", { name: "Annuler" }));

    await user.click(screen.getByRole("button", { name: "Compris" }));
    expect(screen.queryByText(/Ces anciennes cibles/)).toBeNull();
    expect(saveBar().disabled).toBe(false);
    await user.click(saveBar());
    expect(await screen.findByText("Paramètres enregistrés")).toBeTruthy();
    const { params } = await workspace();
    expect(params.removedTargets).toEqual([]);
    expect(params.customAllocations).toMatchObject([{ target: { kind: "compte", accountId: pea.id }, share: 0.3, limit: { basis: "verse", amount: 5000 }, overflowTo: null }]);
  });

  it("répartition : une allocation qui ferait dépasser 100 % des versements est refusée dans la fenêtre, sans rien ajouter", async () => {
    const user = userEvent.setup();
    show(<Parametres />, "/?onglet=Répartition");
    await user.click(await screen.findByRole("button", { name: "Ajouter une allocation" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await fill(user, dialog.getByLabelText("Part"), "70");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Ajouter une allocation" }));
    dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await fill(user, dialog.getByLabelText("Part"), "60");
    // Les erreurs n'apparaissent qu'à la validation.
    expect(dialog.queryByText(/dépassent 100/)).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(await dialog.findByText(/Les parts des versements dépassent 100\s%\s\(130\s%\)\./)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(await screen.findByText(/^70,0\s%$/, { selector: "b" })).toBeTruthy();
    // Un point à régler ailleurs que dans la fenêtre : l'onglet est nommé.
    await user.click(screen.getByRole("tab", { name: "Plan" }));
    await fill(user, fieldOf("Âge horizon (fin des retraits)"), "60");
    await user.click(screen.getByRole("tab", { name: "Répartition" }));
    expect(bar().textContent).toBe("1 point(s) à corriger (Plan)");
  });
});

describe("paramètres › actifs", () => {
  const openAssets = () => show(<Parametres />, "/?onglet=Actifs");

  it("état vide, puis tableau : source du cours, obligation, parts cibles, classes, tri, modification et suppression confirmée", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    openAssets();
    expect(await screen.findByText(/Aucun actif\. Ajoutez vos ETF, obligations ou cryptos\./)).toBeTruthy();
    cleanup();

    await rpc("params.update", { ...(await workspace()).params, customClasses: [{ id: "classe-or", label: "Métaux précieux", color: "#aa8844" }] });
    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Monde Fictif", isin: "IE000BI8OT95", priceSource: "auto", symbol: "WLD", targetWeight: 0.6 });
    await rpc("assets.upsert", { kind: "action", name: "Action Fictive", priceSource: "manuel", targetWeight: 0.3 });
    await rpc("assets.upsert", { kind: "obligation", name: "Obligation Fictive", priceSource: "modele", couponRate: 0.03, maturityDate: "2030-05-15" });
    await rpc("assets.upsert", { kind: "crypto", name: "Crypto Fictive", priceSource: "auto", priceProvider: "coingecko", symbol: "bitcoin" });
    openAssets();
    const row = async (name: string) => (await screen.findByText(name)).closest("tr")!;

    // Parts cibles des actions : 90 % au lieu de 100 %, signalé ; les obligations et cryptos n'y comptent pas.
    expect(await screen.findByText(/\(devrait faire 100\s%\)/)).toBeTruthy();
    expect(norm(screen.getByText(/Parts cibles des actions/).textContent)).toMatch(/90,0 %/);
    expect(norm((await row("ETF Monde Fictif")).textContent)).toContain("auto · WLD");
    expect(norm((await row("ETF Monde Fictif")).textContent)).toContain("IE000BI8OT95");
    expect(norm((await row("Action Fictive")).textContent)).toContain("manuel");
    expect(norm((await row("Obligation Fictive")).textContent)).toMatch(/3,0 % · échéance 15\/05\/2030/);
    expect(norm((await row("Obligation Fictive")).textContent)).toContain("calculé");
    expect(norm((await row("Crypto Fictive")).textContent)).toContain("auto · bitcoin");

    // Classe : par défaut celle du type de titre, ou une classe créée par l'utilisateur.
    const classe = within(await row("ETF Monde Fictif")).getByLabelText("Classe de ETF Monde Fictif") as HTMLSelectElement;
    expect(within(classe).getByRole("option", { name: "Actions (par défaut)" })).toBeTruthy();
    await user.selectOptions(classe, "classe-or");
    await waitFor(async () => expect((await workspace()).assets.find((a) => a.id === etf.id)?.classId).toBe("classe-or"));
    await user.selectOptions(within(await row("ETF Monde Fictif")).getByLabelText("Classe de ETF Monde Fictif"), "");
    await waitFor(async () => expect((await workspace()).assets.find((a) => a.id === etf.id)?.classId).toBeNull());
    // Allocation : retour à « Par défaut ».
    const alloc = within(await row("ETF Monde Fictif")).getByLabelText("Allocation de ETF Monde Fictif");
    await user.selectOptions(alloc, "in");
    await waitFor(async () => expect((await workspace()).assets.find((a) => a.id === etf.id)?.inAllocation).toBe(true));
    await user.selectOptions(alloc, "");
    await waitFor(async () => expect((await workspace()).assets.find((a) => a.id === etf.id)?.inAllocation).toBeNull());

    // Tri par colonne.
    const table = within(screen.getByRole("table"));
    const names = () => table.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.firstChild!.textContent);
    await user.click(table.getByRole("button", { name: "Nom" }));
    expect(names()).toEqual(["Action Fictive", "Crypto Fictive", "ETF Monde Fictif", "Obligation Fictive"]);
    for (const col of ["Type", "Cours"]) await user.click(table.getByRole("button", { name: col }));
    await user.click(table.getByRole("button", { name: "Part cible" }));
    expect(names().slice(0, 2)).toEqual(["ETF Monde Fictif", "Action Fictive"]);

    // Modifier ouvre la fiche du titre ; nouvel actif ouvre une fiche vide.
    await user.click(within(await row("Action Fictive")).getByRole("button", { name: "Modifier" }));
    const edit = within(await screen.findByRole("dialog", { name: "Modifier « Action Fictive »" }));
    await user.click(edit.getByRole("button", { name: "Annuler" }));
    await user.click(screen.getByRole("button", { name: "Nouvel actif" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Nouveau titre" })).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    // Suppression : refusée puis acceptée.
    await user.click(within(await row("Crypto Fictive")).getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer « Crypto Fictive » ?");
    expect((await workspace()).assets).toHaveLength(4);
    confirm.mockReturnValue(true);
    await user.click(within(await row("Crypto Fictive")).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Actif supprimé")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Crypto Fictive")).toBeNull());
    expect((await workspace()).assets).toHaveLength(3);
  });
});

describe("paramètres › application", () => {
  const openApp = () => show(<Parametres />, "/?onglet=Application");

  it("informations de l'instance, thème choisi, mot de passe trop court refusé", async () => {
    const user = userEvent.setup();
    openApp();
    expect(await screen.findByText("Données et application")).toBeTruthy();
    expect(await screen.findByText("test", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("désactivées")).toBeTruthy();
    // Le thème choisi est gardé dans le compte.
    await user.click(screen.getByRole("radio", { name: /Sombre/ }));
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("sombre"));
    expect(screen.getByRole("radio", { name: /Sombre/ }).getAttribute("aria-checked")).toBe("true");
    // Le bouton de changement de mot de passe attend les trois champs (10 caractères au moins, confirmés).
    const change = screen.getByRole("button", { name: "Changer le mot de passe" }) as HTMLButtonElement;
    expect(change.disabled).toBe(true);
    await user.type(screen.getByLabelText("Mot de passe actuel"), "ancien-secret");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "court");
    await user.type(screen.getByLabelText("Confirmation"), "autre");
    expect(screen.getByText("Les deux mots de passe diffèrent.")).toBeTruthy();
    expect(change.disabled).toBe(true);
  });

  it("sauvegarde : export d'un fichier Hamac, fichier étranger refusé, restauration confirmée qui remplace les données", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte sauvegardé" });
    openApp();
    await user.click(await screen.findByRole("button", { name: "Exporter une sauvegarde" }));
    await waitFor(() => expect(h.downloads).toHaveLength(1));
    expect(h.downloads[0]!.name).toMatch(/^hamac-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const dump = JSON.parse(h.downloads[0]!.content) as { format: string; tables: Record<string, unknown[]> };
    expect(dump.format).toBe("hamac");
    expect(dump.tables.accounts).toHaveLength(1);

    // Aucun fichier choisi : rien ne se passe. Fichier qui n'est pas une sauvegarde : message d'erreur.
    h.file = null;
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    h.file = { name: "notes.json", content: JSON.stringify({ format: "autre" }) };
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    expect(await screen.findByText("Ce fichier n'est pas une sauvegarde Hamac.")).toBeTruthy();
    h.file = { name: "cassé.json", content: "pas du json" };
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    expect((await screen.findAllByText("Ce fichier n'est pas une sauvegarde Hamac.")).length).toBeGreaterThan(0);

    // Le compte créé après la sauvegarde disparaît à la restauration.
    await rpc("accounts.upsert", { kind: "cto", name: "Compte éphémère" });
    h.file = { name: "sauvegarde.json", content: h.downloads[0]!.content };
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Restaurer une sauvegarde" }));
    expect(dialog.getByText("sauvegarde.json")).toBeTruthy();
    expect(dialog.getByText(/Contenu : 1 comptes, 0 titres, 0 opérations/)).toBeTruthy();
    expect(dialog.getByText(/Toutes les données actuelles seront remplacées/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Échap ferme aussi la fenêtre, sans rien restaurer.
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    await screen.findByRole("dialog", { name: "Restaurer une sauvegarde" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await workspace()).accounts).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: /Restaurer une sauvegarde/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remplacer toutes mes données" }));
    expect(await screen.findByText("Sauvegarde restaurée.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await workspace()).accounts.map((a) => a.name)).toEqual(["Compte sauvegardé"]);
  });

  it("restauration d'une sauvegarde invalide : l'erreur du serveur s'affiche et la fenêtre reste ouverte", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte intact" });
    h.file = { name: "ancienne.json", content: JSON.stringify({ format: "hamac", version: 1, schemaVersion: "0", exportedAt: "2020-01-01T00:00:00.000Z", appVersion: "0.0.1", tables: { accounts: [{ id: "x" }] } }) };
    openApp();
    await user.click(await screen.findByRole("button", { name: /Restaurer une sauvegarde/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Restaurer une sauvegarde" }));
    expect(dialog.getByText(/exportée le 01\/01\/2020 \(version 0\.0\.1\)/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Remplacer toutes mes données" }));
    // Zone des notifications (l'élément <output> de l'adresse a aussi le rôle « status »).
    const toasts = () => document.querySelector('[aria-live="polite"]')!;
    await waitFor(() => expect(toasts().textContent).toMatch(/^Import impossible/));
    // L'échec n'a rien touché : les données actuelles sont intactes.
    expect((await workspace()).accounts.map((a) => a.name)).toEqual(["Compte intact"]);
    expect(screen.queryByText("Sauvegarde restaurée.")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Restaurer une sauvegarde" })).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Remplacer toutes mes données" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("paramètres › cours", () => {
  const items = () => [...document.querySelectorAll("ol > li")] as HTMLElement[];
  const labels = () => [...document.querySelectorAll("ol > li")].map((li) => li.querySelector("div.text-sm.font-medium")!.textContent);

  it("administrateur : ordre et activation des sources, état de chaque titre après actualisation", async () => {
    const user = userEvent.setup();
    await withMarket(justEtf({ IE000BI8OT95: 51.5 }));
    await rpc("assets.upsert", { kind: "etf", name: "ETF Un", isin: "IE000BI8OT95", priceSource: "auto" });
    await rpc("assets.upsert", { kind: "etf", name: "ETF Deux", isin: "LU1681043599", priceSource: "auto" });
    show(<Parametres />, "/?onglet=Cours");
    expect(await screen.findByText("Ordre des sources")).toBeTruthy();
    expect(labels()).toEqual(["justETF", "Euronext", "Twelve Data", "Yahoo Finance", "CoinGecko"]);
    expect(screen.getByText(/Aucune clé configurée\. Pour activer cette source, renseignez/)).toBeTruthy();
    expect(screen.getByText("HAMAC_TWELVEDATA_KEY")).toBeTruthy();
    expect(screen.getByText("Le détail apparaîtra après la prochaine actualisation.")).toBeTruthy();
    // Aux extrémités, on ne peut pas aller plus loin.
    expect((screen.getByRole("button", { name: "Monter justETF" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Descendre CoinGecko" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Descendre justETF" }));
    await waitFor(() => expect(labels().slice(0, 2)).toEqual(["Euronext", "justETF"]));
    await user.click(screen.getByRole("button", { name: "Monter Yahoo Finance" }));
    await waitFor(() => expect(labels()).toEqual(["Euronext", "justETF", "Yahoo Finance", "Twelve Data", "CoinGecko"]));
    await user.click(within(items()[2]!).getByRole("checkbox", { name: "Active" }));
    await waitFor(async () => expect((await rpc<{ order: Obj[] }>("market.settings")).order).toEqual([
      { id: "euronext", enabled: true }, { id: "justetf", enabled: true }, { id: "yahoo", enabled: false }, { id: "twelvedata", enabled: true }, { id: "coingecko", enabled: true },
    ]));
    expect((within(items()[2]!).getByRole("checkbox", { name: "Active" }) as HTMLInputElement).checked).toBe(false);

    // Actualiser : justETF connaît le premier titre, aucune source ne connaît le second.
    await user.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(await screen.findByText(/Dernière actualisation :/)).toBeTruthy();
    const un = (await screen.findByText("ETF Un", { selector: "td" })).closest("tr")!;
    expect(within(un).getByText("justETF")).toBeTruthy();
    expect(within(un).getByText("05/11/2026")).toBeTruthy();
    const deux = screen.getByText("ETF Deux", { selector: "td" }).closest("tr")!;
    expect(within(deux).getByText("Aucune")).toBeTruthy();
    expect(within(deux).getByText("Aucune source n'a répondu")).toBeTruthy();
    expect(within(deux).getByText(/^justETF : /)).toBeTruthy();
    expect(within(deux).getByText(/^Euronext : /)).toBeTruthy();
    expect(screen.queryByText("Le détail apparaîtra après la prochaine actualisation.")).toBeNull();
    // Rien de Twelve Data n'a été utilisé : la source est désactivée pour ce titre faute de clé.
    expect(within(deux).queryByText(/^Twelve Data : /)).toBeNull();
  });

  it("administrateur avec une clé Twelve Data : le budget de requêtes se calcule d'après les titres concernés", async () => {
    await withMarket(justEtf({}), { twelveDataKey: "cle-fictive" });
    show(<Parametres />, "/?onglet=Cours");
    expect(await screen.findByText("Clé configurée sur le serveur.")).toBeTruthy();
    expect(screen.getByText(/Aucun titre ne passe par Twelve Data pour l'instant : il lui faut un symbole\./)).toBeTruthy();
    expect(screen.getByText(/Utilisées aujourd'hui/).textContent).toMatch(/0 \/ \d+/);
    expect(screen.queryByText(/Aucune clé configurée/)).toBeNull();
    cleanup();

    await rpc("assets.upsert", { kind: "action", name: "Action Un", symbol: "AAA.PA", priceSource: "auto" });
    await rpc("prices.refresh");
    show(<Parametres />, "/?onglet=Cours");
    expect(await screen.findByText(/1 titre peut passer par Twelve Data/)).toBeTruthy();
    // 30 minutes entre deux actualisations : 48 requêtes par jour au plus pour ce titre.
    expect(norm(screen.getByText(/1 titre peut passer par Twelve Data/).textContent)).toMatch(/actualisation toutes les 30 min, soit 48 requêtes par jour au plus/);
    cleanup();

    await rpc("assets.upsert", { kind: "action", name: "Action Deux", symbol: "BBB.PA", priceSource: "auto" });
    await rpc("prices.refresh");
    show(<Parametres />, "/?onglet=Cours");
    expect(await screen.findByText(/2 titres peuvent passer par Twelve Data/)).toBeTruthy();
    expect(norm(screen.getByText(/2 titres peuvent passer par Twelve Data/).textContent)).toMatch(/soit 96 requêtes par jour au plus/);
  });

  it("utilisateur sans droit d'administration : sources en lecture seule, modification refusée par le serveur", async () => {
    const user = userEvent.setup();
    await withMarket(justEtf({}), { isAdmin: false });
    show(<Parametres />, "/?onglet=Cours");
    expect(await screen.findByText(/Les cours sont communs à toute l'instance et réglés par son administrateur\./)).toBeTruthy();
    expect(screen.queryByText(/Twelve Data \(facultatif\)/)).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Active" })).toBeNull();
    expect(screen.getAllByText("Active")).toHaveLength(5);
    // Les boutons de déplacement sont masqués ; un appel direct reste refusé.
    fireEvent.click(screen.getByRole("button", { name: "Descendre justETF" }));
    expect(await screen.findByText("Réservé à l'administrateur de l'instance.")).toBeTruthy();
    expect(labels()[0]).toBe("justETF");
    await user.click(screen.getByRole("button", { name: "Actualiser" }));
    expect(await screen.findByText(/Dernière actualisation :/)).toBeTruthy();
  });
});

describe("état de l'actualisation des cours", () => {
  it("relancer l'actualisation, lire l'échec d'un titre, réessayer ou suivre le lien vers les sources", async () => {
    const user = userEvent.setup();
    await withMarket(justEtf({}));
    show(<PriceStatus />);
    const button = await screen.findByRole("button", { name: "Actualiser les cours" });
    await user.click(button);
    expect(await screen.findByText("Cours à l'instant")).toBeTruthy();
    // Sans titre, rien n'est en échec : cliquer relance simplement l'actualisation.
    expect(screen.queryByText("Cours non actualisés")).toBeNull();
    cleanup();

    await rpc("assets.upsert", { kind: "etf", name: "ETF Introuvable", isin: "LU1681043599", priceSource: "auto" });
    show(<PriceStatus />);
    await user.click(await screen.findByRole("button", { name: /^Actualiser les cours|^Cours/ }));
    await user.click(await screen.findByRole("button", { name: /Cours/ }));
    expect(await screen.findByText("Cours non actualisés")).toBeTruthy();
    expect(screen.getByText("ETF Introuvable")).toBeTruthy();
    // Réessayer referme la liste et relance.
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    await waitFor(() => expect(screen.queryByText("Cours non actualisés")).toBeNull());
    await user.click(await screen.findByRole("button", { name: /Cours/ }));
    await user.click(await screen.findByRole("link", { name: "Voir les sources" }));
    expect(screen.queryByText("Cours non actualisés")).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe("/parametres?onglet=Cours");
  });

  it("l'ancienneté des cours s'écrit en minutes, heures ou jours", async () => {
    await withMarket(justEtf({}));
    await rpc("prices.refresh");
    const real = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (const [delta, text] of [
        [5 * 60_000, "Cours il y a 5 min"],
        [3 * 3_600_000, "Cours il y a 3 h"],
        [2 * 86_400_000, "Cours il y a 2 j"],
      ] as const) {
        vi.setSystemTime(real + delta);
        const view = show(<PriceStatus />);
        expect(await screen.findByText(text)).toBeTruthy();
        view.unmount();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("saisie d'un cours à la main", () => {
  const assetNamed = async (name: string) => (await workspace()).assets.find((a) => a.name === name) as Obj;

  it("sans titre, rien ne s'affiche ; pour un ETF, le cours et sa date sont enregistrés (4 décimales), la fenêtre se ferme", async () => {
    const user = userEvent.setup();
    const empty = show(<PriceDialog asset={null} onClose={() => undefined} />);
    expect(empty.container.querySelector('[role="dialog"]')).toBeNull();
    empty.unmount();

    await rpc("assets.upsert", { kind: "etf", name: "ETF Fictif", priceSource: "manuel" });
    const onClose = vi.fn();
    show(<PriceDialog asset={(await assetNamed("ETF Fictif")) as never} onClose={onClose} />);
    const dialog = within(await screen.findByRole("dialog", { name: "Cours de « ETF Fictif »" }));
    const save = dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((dialog.getByLabelText("Date") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await fill(user, dialog.getByLabelText("Cours"), "51,2345");
    expect((dialog.getByLabelText("Cours") as HTMLInputElement).value).toBe("51,2345");
    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2026-11-03" } });
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(await screen.findByText("Cours enregistré")).toBeTruthy();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await assetNamed("ETF Fictif")).toMatchObject({ manualPrice: 51.2345, manualPriceDate: "2026-11-03" });
  });

  it("obligation : cours en pourcentage du nominal ; annuler ne change rien, enregistrer remplace le dernier cours saisi", async () => {
    const user = userEvent.setup();
    await rpc("assets.upsert", { kind: "obligation", name: "Obligation Fictive", priceSource: "modele", couponRate: 0.03, maturityDate: "2032-05-15", manualPrice: 98.5, manualPriceDate: "2026-10-01" });
    const onClose = vi.fn();
    const view = show(<PriceDialog asset={(await assetNamed("Obligation Fictive")) as never} onClose={onClose} />);
    let dialog = within(await screen.findByRole("dialog", { name: "Cours de « Obligation Fictive »" }));
    expect(dialog.getByLabelText("Cours (% du nominal, pied de coupon)")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(await assetNamed("Obligation Fictive")).toMatchObject({ manualPrice: 98.5, manualPriceDate: "2026-10-01" });
    view.unmount();

    show(<PriceDialog asset={(await assetNamed("Obligation Fictive")) as never} onClose={onClose} />);
    dialog = within(await screen.findByRole("dialog", { name: "Cours de « Obligation Fictive »" }));
    await fill(user, dialog.getByLabelText("Cours (% du nominal, pied de coupon)"), "97,25");
    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2026-11-02" } });
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect(await assetNamed("Obligation Fictive")).toMatchObject({ manualPrice: 97.25, manualPriceDate: "2026-11-02" }));
  });
});

describe("liste des alertes", () => {
  const alerts: Alert[] = [
    { id: "a", level: "critique", title: "Plafond dépassé", detail: "Le livret dépasse son plafond.", link: "/parametres?onglet=Comptes" },
    { id: "b", level: "attention", title: "Espèces à investir", detail: "Il reste 800 € sur le PEA." },
    { id: "c", level: "info", title: "Nouvelle campagne fiscale" },
    { id: "d", level: "ok", title: "Tout est à jour", detail: "Rien à signaler." },
  ];

  it("sans alerte, le dit ; sinon un statut en toutes lettres par niveau, le détail, et un lien quand une page permet d'agir", async () => {
    const user = userEvent.setup();
    const empty = show(<AlertList alerts={[]} />);
    expect(screen.getByText("Aucune alerte.")).toBeTruthy();
    empty.unmount();

    show(<AlertList alerts={alerts} />);
    expect(screen.getAllByRole("listitem").map((li) => li.querySelector("span")!.textContent)).toEqual(["Critique", "À faire", "Info", "OK"]);
    expect(screen.getByText("Le livret dépasse son plafond.")).toBeTruthy();
    expect(screen.getByText("Rien à signaler.")).toBeTruthy();
    // Seule l'alerte avec un lien est cliquable.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    await user.click(screen.getByRole("link", { name: /Plafond dépassé/ }));
    expect(screen.getByTestId("where").textContent).toBe("/parametres?onglet=Comptes");
  });

  it("version compacte : les détails sont masqués", () => {
    show(<AlertList alerts={alerts} compact />);
    expect(screen.getByText("Plafond dépassé")).toBeTruthy();
    expect(screen.queryByText("Le livret dépasse son plafond.")).toBeNull();
    expect(screen.queryByText("Il reste 800 € sur le PEA.")).toBeNull();
  });
});

describe("protection en cas de faillite", () => {
  const fund = (accountId: string, amount: number) => rpc("transactions.upsert", { date: "2025-01-05", type: "apport_initial", accountId, amount });

  it("rien sans compte ; sinon un tableau par établissement garant, avec plafonds, parts garanties et sommes non garanties", async () => {
    show(<ProtectionCard />);
    await waitFor(() => expect(document.querySelector("h2")).toBeNull());
    cleanup();

    const banque = await institution("Banque Fictive", { kind: "banque", offers: { livret: {} } });
    // Deux marques d'un même établissement agréé : un seul plafond.
    const marque = await institution("Banque Fictive en ligne", { kind: "banque", offers: { livret: {} }, protection: { guarantor: "Banque Fictive", country: "france" } });
    const etranger = await institution("Banque Lointaine", { kind: "banque", offers: { livret: {} }, protection: { guarantor: "", country: "hors_ue" } });
    const europe = await institution("Banque Européenne", { kind: "banque", offers: { livret: {} }, protection: { guarantor: "", country: "ue" } });
    const assureur = await institution("Assureur Fictif", { kind: "assureur", offers: { assurance_vie: { insurer: "Assureur SA" } } });
    const courtier = await institution("Courtier Fictif", { offers: { pea: grid(0) } });
    const lep = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP Fictif", institutionId: banque.id });
    const libre = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret libre", institutionId: banque.id });
    const libre2 = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret en ligne", institutionId: marque.id });
    const lointain = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret lointain", institutionId: etranger.id });
    const ue = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret européen", institutionId: europe.id });
    const orphelin = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret orphelin" });
    const av = await rpc<{ id: string }>("accounts.upsert", { kind: "assurance_vie", name: "AV Fictive", institutionId: assureur.id });
    const pea = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA Fictif", institutionId: courtier.id });
    const crowd = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Plateforme prêts" });
    const salariale = await rpc<{ id: string }>("accounts.upsert", { kind: "epargne_salariale", name: "PEE Fictif" });
    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Fictif", priceSource: "manuel" });
    await fund(lep.id, 5_000);
    await fund(libre.id, 90_000);
    await fund(libre2.id, 40_000);
    await fund(lointain.id, 3_000);
    await fund(ue.id, 8_000);
    await fund(orphelin.id, 2_000);
    await fund(av.id, 20_000);
    await fund(pea.id, 1_000);
    await rpc("transactions.upsert", { date: "2025-01-06", type: "achat", accountId: pea.id, assetId: etf.id, amount: 600, quantity: 6 });
    await rpc("transactions.upsert", { date: "2025-01-07", type: "versement", accountId: crowd.id, amount: 1_500 });
    await fund(salariale.id, 4_000);

    show(<ProtectionCard />);
    expect(await screen.findByRole("heading", { name: "Protection en cas de faillite" })).toBeTruthy();
    expect(screen.getByText(/Règles vérifiées le 11\/11\/2026/)).toBeTruthy();
    const figure = (label: string) => norm(screen.getByText(label, { selector: "dt" }).closest("div")!.querySelector("dd")!.textContent);
    // Les deux marques partagent le plafond de 100 000 € de leur établissement : 130 000 € de dépôts, 30 000 € au-delà.
    expect(figure("Au-delà d'un plafond")).toBe("30 000 €");
    expect(figure("Sans garantie")).toBe("1 500 €");
    expect(screen.getByText("(dont épargne salariale)")).toBeTruthy();
    expect(screen.getByText("(crowdlending, crypto)")).toBeTruthy();

    const row = (name: string, nth = 0) => screen.getAllByText(name, { selector: "td div.font-medium" })[nth]!.closest("tr")!;
    const text = (r: HTMLElement) => norm(r.textContent);
    const banqueDepots = screen.getAllByText("Banque Fictive", { selector: "td div.font-medium" }).map((d) => d.closest("tr")!).find((r) => text(r).includes("Dépôts"))!;
    expect(text(banqueDepots)).toContain("via Banque Fictive en ligne · Livret en ligne, Livret libre");
    expect(text(banqueDepots)).toContain("130 000 €");
    expect(text(banqueDepots)).toContain("100 000 €");
    expect(text(banqueDepots)).toContain("30 000 €");
    expect(within(banqueDepots).getByRole("img", { name: "77 % garanti" })).toBeTruthy();
    // Livrets réglementés : plafond distinct.
    const livrets = screen.getAllByText("Banque Fictive", { selector: "td div.font-medium" }).map((d) => d.closest("tr")!).find((r) => text(r).includes("Livret A, LDDS, LEP"))!;
    expect(text(livrets)).toContain("Plafond distinct, qui s'ajoute à celui des dépôts.");
    expect(within(livrets).getByRole("img", { name: "100 % garanti" })).toBeTruthy();
    // Titres du PEA, espèces du PEA, assureur (plafond du FGAP), UE, hors UE.
    expect(text(row("Courtier Fictif", 0))).toMatch(/PEA Fictif/);
    expect(text(screen.getByText("Assureur SA", { selector: "td div.font-medium" }).closest("tr")!)).toContain("Par assureur, tous contrats confondus.");
    expect(text(row("Banque Européenne"))).toContain("Garantie de son pays, au même plafond de 100 000 €");
    const horsUe = row("Banque Lointaine");
    expect(text(horsUe)).toContain("À vérifier");
    expect(text(horsUe)).toContain("Établissement hors de l'Union européenne");
    expect(within(horsUe).getByText("—", { selector: "span" })).toBeTruthy();
    // Sans établissement renseigné et sans garantie : ligne sans nom, « aucune » à la place de la jauge.
    const sans = screen.getAllByText("Établissement non renseigné", { selector: "td div.font-medium" }).map((d) => d.closest("tr")!);
    expect(sans).toHaveLength(3);
    expect(sans.some((r) => text(r).includes("Rattachez le compte à son établissement"))).toBe(true);
    const crowdRow = sans.find((r) => text(r).includes("Plateforme prêts"))!;
    expect(text(crowdRow)).toContain("Sans garantie");
    expect(within(crowdRow).getByText("aucune")).toBeTruthy();
    expect(sans.some((r) => text(r).includes("PEE Fictif") && text(r).includes("Épargne salariale"))).toBe(true);
    expect(screen.getByRole("link", { name: /Garantie des dépôts et des titres/ }).getAttribute("href")).toMatch(/^https:\/\/www\.economie\.gouv\.fr/);
  });
});

describe("sociétés (SCI)", () => {
  it("masquées sans société ni bien en SCI ; sinon créer, rattacher un bien, modifier, archiver et supprimer une société", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const none = show(<CompaniesCard />);
    await waitFor(() => expect(none.container.querySelector("h2")).toBeNull());
    none.unmount();

    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", ownership: "sci", name: "Studio SCI", value: 200_000, purchasePrice: 150_000 });
    show(<CompaniesCard />);
    expect(await screen.findByText(/Créez la SCI, puis rattachez-lui ses biens depuis leur fiche/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nouvelle société" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouvelle société" }));
    const save = dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(dialog.queryByRole("checkbox", { name: "Archivée" })).toBeNull();
    await user.type(dialog.getByLabelText("Nom"), "SCI Fictive");
    await fill(user, dialog.getByLabelText("Part des parts détenue"), "50");
    await user.type(dialog.getByLabelText("Commentaire"), "Deux associés");
    await user.click(save);
    expect(await screen.findByText("Société ajoutée")).toBeTruthy();
    const company = (await workspace()).companies[0]!;
    expect(company).toMatchObject({ name: "SCI Fictive", share: 0.5, comment: "Deux associés", archived: false });
    const row = () => screen.getByText("SCI Fictive").closest("tr")!;
    await waitFor(() => expect(within(row()).getByText("Aucun bien rattaché")).toBeTruthy());

    // Le bien rattaché apparaît, avec sa valeur à hauteur des parts détenues (50 % de 200 000 €).
    await rpc("properties.upsert", { id: bien.id, kind: "locatif", ownership: "sci", name: "Studio SCI", value: 200_000, purchasePrice: 150_000, companyId: company.id });
    cleanup();
    show(<CompaniesCard />);
    await waitFor(() => expect(within(row()).getByText("Studio SCI")).toBeTruthy());
    expect(norm(row().textContent)).toContain("50,0 %");
    expect(norm(row().textContent)).toContain("200 000 €");
    expect(norm(row().textContent)).toContain("100 000 €");

    // Modifier : part bornée à 100 %, archivage.
    await user.click(within(row()).getByRole("button", { name: "Modifier" }));
    const edit = within(await screen.findByRole("dialog", { name: "Modifier « SCI Fictive »" }));
    expect((edit.getByLabelText("Nom") as HTMLInputElement).value).toBe("SCI Fictive");
    await fill(user, edit.getByLabelText("Part des parts détenue"), "150");
    expect((edit.getByLabelText("Part des parts détenue") as HTMLInputElement).value).toBe("100");
    await user.click(edit.getByRole("checkbox", { name: "Archivée" }));
    await user.click(edit.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Société mise à jour")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).companies[0]).toMatchObject({ share: 1, archived: true }));

    // Suppression : refusée, puis acceptée ; le bien reste.
    await user.click(within(row()).getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer « SCI Fictive » ? Ses biens restent, détenus pour la part saisie sur chacun.");
    expect((await workspace()).companies).toHaveLength(1);
    confirm.mockReturnValue(true);
    await user.click(within(row()).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Société supprimée")).toBeTruthy();
    expect((await workspace()).companies).toHaveLength(0);
    expect((await workspace()).properties).toHaveLength(1);
  });
});

describe("fiche d'un bien : estimations, recettes et documents", () => {
  const routes = (
    <Routes>
      <Route path="/immobilier/:id" element={<Bien />} />
    </Routes>
  );

  it("estimations successives : ajout, ordre, suppression ; recettes hors loyer : ajout, modification, suppression confirmée", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", name: "Studio", value: 120_000, valueDate: "2026-06-01", purchasePrice: 100_000 });
    await rpc("propertyValues.add", { propertyId: bien.id, date: "2023-01-10", value: 100_000 });
    show(routes, `/immobilier/${bien.id}?onglet=finances`);

    // Valeur dans le temps : la valeur actuelle d'abord, puis les anciennes estimations.
    const values = within((await screen.findByRole("heading", { name: "Valeur dans le temps" })).closest("div.rounded-2xl") as HTMLElement);
    expect(values.getByText("01/06/2026")).toBeTruthy();
    expect(values.getByText("actuelle")).toBeTruthy();
    expect(values.getByText("10/01/2023")).toBeTruthy();
    await user.click(values.getByRole("button", { name: "Nouvelle estimation" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouvelle estimation" }));
    const save = dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect((dialog.getByLabelText("Estimée le") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dialog.getByLabelText("Estimée le"), { target: { value: "2024-09-15" } });
    await fill(user, dialog.getByLabelText("Valeur du bien entier"), "110000");
    await user.click(save);
    expect(await screen.findByText("Estimation enregistrée")).toBeTruthy();
    await waitFor(() => expect(values.getByText("15/09/2024")).toBeTruthy());
    expect((await workspace()).propertyValues.map((v) => [v.date, v.value]).sort()).toEqual([["2023-01-10", 100000], ["2024-09-15", 110000]]);
    await user.click(values.getByRole("button", { name: "Supprimer l'estimation du 10/01/2023" }));
    expect(await screen.findByText("Estimation supprimée")).toBeTruthy();
    await waitFor(() => expect(values.queryByText("10/01/2023")).toBeNull());

    // Autres recettes : uniquement pour un bien loué.
    const recettes = () => within(screen.getByRole("heading", { name: "Autres recettes" }).closest("div.rounded-2xl") as HTMLElement);
    expect(recettes().getByText(/Régularisation annuelle des charges, indemnité d'assurance/)).toBeTruthy();
    await user.click(recettes().getByRole("button", { name: "Nouvelle recette" }));
    let income = within(await screen.findByRole("dialog", { name: "Nouvelle recette" }));
    const add = income.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await fill(user, income.getByLabelText("Montant"), "350");
    await user.type(income.getByLabelText("Libellé (facultatif)"), "Régularisation 2025");
    fireEvent.change(income.getByLabelText("Date"), { target: { value: "2026-03-20" } });
    await user.click(add);
    expect(await screen.findByText("Recette ajoutée")).toBeTruthy();
    const line = () => screen.getByText("Régularisation 2025").closest("tr")!;
    await waitFor(() => expect(line()).toBeTruthy());
    expect(norm(line().textContent)).toContain("20/03/2026");
    expect(norm(line().textContent)).toContain("+350");
    expect((await workspace()).propertyIncomes).toMatchObject([{ propertyId: bien.id, category: "regularisation_recue", amount: 350, date: "2026-03-20", label: "Régularisation 2025" }]);

    await user.click(within(line()).getByRole("button", { name: "Modifier" }));
    income = within(await screen.findByRole("dialog", { name: "Modifier la recette" }));
    await fill(user, income.getByLabelText("Montant"), "420");
    await user.click(income.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Recette mise à jour")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).propertyIncomes[0]).toMatchObject({ amount: 420 }));

    await user.click(within(line()).getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer cette recette ?");
    expect((await workspace()).propertyIncomes).toHaveLength(1);
    confirm.mockReturnValue(true);
    await user.click(within(line()).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Recette supprimée")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Régularisation 2025")).toBeNull());
  });

  it("registre des documents de la fiche : ajout daté, modification, suppression confirmée", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "residence_principale", name: "Maison", value: 250_000 });
    show(routes, `/immobilier/${bien.id}`);
    await user.click(await screen.findByRole("button", { name: "Fiche du bien" }));
    const sheet = within(await screen.findByRole("dialog", { name: "Fiche du bien" }));
    expect(sheet.getByText(/Acte, diagnostics, assurance : notez où les retrouver\./)).toBeTruthy();
    await user.click(sheet.getByRole("button", { name: "Nouveau document" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouveau document" }));
    const add = dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await user.selectOptions(dialog.getByLabelText("Type"), within(dialog.getByLabelText("Type")).getAllByRole("option")[1]!.getAttribute("value")!);
    await user.type(dialog.getByLabelText("Nom"), "Diagnostic électricité");
    fireEvent.change(dialog.getByLabelText("Date du document"), { target: { value: "2025-02-01" } });
    fireEvent.change(dialog.getByLabelText("Valable jusqu'au"), { target: { value: "2028-02-01" } });
    await user.type(dialog.getByLabelText("Où le trouver"), "Coffre-fort numérique");
    await user.click(add);
    expect(await screen.findByText("Document ajouté")).toBeTruthy();
    const line = () => sheet.getByText("Diagnostic électricité").closest("tr")!;
    await waitFor(() => expect(line()).toBeTruthy());
    expect(norm(line().textContent)).toContain("Coffre-fort numérique");
    expect(norm(line().textContent)).toContain("01/02/2028");
    const saved = (await workspace()).propertyDocuments[0]!;
    expect(saved).toMatchObject({ propertyId: bien.id, label: "Diagnostic électricité", date: "2025-02-01", expiresOn: "2028-02-01", location: "Coffre-fort numérique" });

    await user.click(within(line()).getByRole("button", { name: "Modifier" }));
    dialog = within(await screen.findByRole("dialog", { name: "Modifier le document" }));
    await user.clear(dialog.getByLabelText("Valable jusqu'au"));
    fireEvent.change(dialog.getByLabelText("Valable jusqu'au"), { target: { value: "" } });
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Document mis à jour")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).propertyDocuments[0]!.expiresOn).toBeNull());
    await waitFor(() => expect(within(line()).getByText("—")).toBeTruthy());

    await user.click(within(line()).getByRole("button", { name: "Supprimer" }));
    expect(confirm).toHaveBeenCalledWith("Supprimer « Diagnostic électricité » ?");
    expect((await workspace()).propertyDocuments).toHaveLength(1);
    confirm.mockReturnValue(true);
    await user.click(within(line()).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Document supprimé")).toBeTruthy();
    await waitFor(() => expect(sheet.queryByText("Diagnostic électricité")).toBeNull());
  });
});

describe("liste de fin d'année", () => {
  const year = new Date().getFullYear().toString();

  it("gestes chiffrés d'après le plan, cochés année par année et gardés dans les réglages", async () => {
    const user = userEvent.setup();
    await rpc("params.update", { ...(await workspace()).params, tax: { ...(await workspace()).params.tax, perDeductionCeiling: 5_000, tmi: 0.3 } });
    await rpc("accounts.upsert", { kind: "per", name: "PER Fictif" });
    await rpc("accounts.upsert", { kind: "pea", name: "PEA Fictif" });
    show(<YearEndCard />);
    expect(await screen.findByText(`Liste de fin d'année ${year}`)).toBeTruthy();
    const summary = () => norm(screen.getByText(/gestes? à faire avant le 31 décembre/).textContent);
    // Verser sur le PER : 5 000 € de plafond × 30 % = 1 500 € d'impôt en moins.
    expect(summary()).toMatch(/3 gestes à faire avant le 31 décembre · jusqu'à 1 500 € d'impôt en moins ou évité/);
    expect(screen.getByText("Verser sur le PER avant le 31 décembre")).toBeTruthy();
    expect(screen.getByText("Vérifier les plafonds disponibles")).toBeTruthy();
    expect(screen.getByText("Préparer la déclaration du printemps")).toBeTruthy();
    expect(screen.getByText(/≈/).textContent).toMatch(/1\s500/);
    expect(screen.getByText(new RegExp(`Versements sur le PER en ${year}`))).toBeTruthy();
    expect(screen.getAllByText("plafond restant").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Voir le détail" }).map((a) => a.getAttribute("href"))).toEqual(["/compteurs", "/compteurs", "/declaration"]);

    // Cocher un geste : il sort du décompte et du total, et la case est retenue pour l'année.
    await user.click(screen.getByRole("checkbox", { name: "Verser sur le PER avant le 31 décembre" }));
    await waitFor(() => expect(summary()).toBe("2 gestes à faire avant le 31 décembre"));
    await waitFor(async () => expect(await rpc("settings.get", { key: "taxes.yearEnd" })).toEqual({ [year]: ["per"] }));
    await user.click(screen.getByRole("checkbox", { name: "Préparer la déclaration du printemps" }));
    await waitFor(() => expect(summary()).toBe("1 geste à faire avant le 31 décembre"));
    // Décocher le premier le rend à la liste.
    await user.click(screen.getByRole("checkbox", { name: "Verser sur le PER avant le 31 décembre" }));
    await waitFor(async () => expect(await rpc("settings.get", { key: "taxes.yearEnd" })).toEqual({ [year]: ["declaration"] }));
    await waitFor(() => expect(summary()).toMatch(/^2 gestes à faire.*jusqu'à 1 500 €/));
  });
});

describe("recherche d'adresse", () => {
  const suggestions = [
    { properties: { label: "1 Rue Fictive 00000 Ville fictive", name: "1 Rue Fictive", postcode: "00000", city: "Ville fictive", type: "housenumber" } },
    { properties: { label: "Ville fictive 00000", name: "Ville fictive", postcode: "00000", city: "Ville fictive", type: "municipality" } },
    { properties: { label: "2 Rue Fictive 00000 Ville fictive", name: "2 Rue Fictive", postcode: "00000", city: "Ville fictive", type: "housenumber" } },
  ];

  function Harness({ onSelect }: { onSelect: (a: unknown) => void }) {
    const [value, setValue] = useState("");
    return <AddressInput id="adresse" value={value} onChange={setValue} onSelect={(a) => (setValue(a.address || value), onSelect(a))} />;
  }

  it("flèches, Entrée et Échap : on choisit au clavier, Échap ferme la liste sans fermer la fenêtre ; une commune seule ne remplit pas la rue", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ features: suggestions })));
    const onSelect = vi.fn();
    const escape = vi.fn();
    window.addEventListener("keydown", escape);
    show(<Harness onSelect={onSelect} />);
    const field = screen.getByRole("combobox");
    // Moins de trois caractères : aucune requête.
    await user.type(field, "1 ");
    expect(fetch).not.toHaveBeenCalled();
    await user.type(field, "rue");
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(suggestions.map((s) => s.properties.label));
    expect(field.getAttribute("aria-expanded")).toBe("true");
    // Flèche bas : la première ; flèche haut depuis la première : on boucle sur la dernière, puis flèche bas revient à la première.
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[2]!.getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");
    expect(field.getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option")[0]!.id);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith({ label: "Ville fictive 00000", address: "", postalCode: "00000", city: "Ville fictive" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field.getAttribute("aria-expanded")).toBe("false");

    // Échap ferme la liste mais n'est pas transmis à la fenêtre (le gestionnaire de Modal n'est pas appelé).
    await user.type(field, "x");
    await screen.findAllByRole("option");
    escape.mockClear();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(escape).not.toHaveBeenCalled();
    // Sans liste ouverte, Échap passe normalement.
    await user.keyboard("{Escape}");
    expect(escape).toHaveBeenCalled();
    window.removeEventListener("keydown", escape);
  });

  it("service indisponible : message, saisie libre conservée ; la liste se ferme en quittant le champ", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const onSelect = vi.fn();
    show(<Harness onSelect={onSelect} />);
    await user.type(screen.getByRole("combobox"), "12 avenue");
    expect(await screen.findByText("Recherche d'adresse indisponible : saisissez-la à la main.")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("12 avenue");

    // Le service répond de nouveau : le message disparaît, les suggestions s'affichent, puis se ferment au clic ailleurs.
    fetcher.mockImplementation(async () => Response.json({ features: suggestions }) as never);
    await user.type(screen.getByRole("combobox"), "s");
    expect(await screen.findAllByRole("option")).toHaveLength(3);
    expect(screen.queryByText(/indisponible/)).toBeNull();
    await user.tab();
    expect(screen.queryByRole("listbox")).toBeNull();
    // Un clic sur une suggestion la choisit (sans faire perdre le focus au champ avant le choix).
    await user.type(screen.getByRole("combobox"), "e");
    await user.click(await screen.findByRole("option", { name: /^2 Rue Fictive/ }));
    expect(onSelect).toHaveBeenCalledWith({ label: "2 Rue Fictive 00000 Ville fictive", address: "2 Rue Fictive", postalCode: "00000", city: "Ville fictive" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("import d'un relevé", () => {
  const frDate = (iso: string) => iso.split("-").reverse().join("/");
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const open = async (user: ReturnType<typeof userEvent.setup>, onClose: () => void = () => undefined) => {
    const view = show(<StatementImportDialog open onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "Choisir un fichier" }));
    return { view, dialog: within(screen.getByRole("dialog", { name: "Importer un relevé" })) };
  };
  const cells = (row: HTMLElement) => within(row).getAllByRole("cell").map((c) => norm(c.textContent));
  const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
  const footer = () => norm(screen.getByText(/nouvelle\(s\) ·/).textContent);

  it("CSV : colonnes devinées, rôles modifiables, type forcé, lignes décochées ; le choix est retenu pour le prochain fichier du même format", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", livretType: "AUTRE", name: "Livret Fictif" });
    const csv = ["Relevé du compte", "Date;Libellé;Débit;Crédit", "12/10/2026;VIREMENT SALAIRE;;1500,00", "13/10/2026;PRELEVEMENT ASSURANCE;200,50;", "pas une date;ligne cassée;10,00;"].join("\n");
    h.file = { name: "releve.csv", content: csv };
    const onClose = vi.fn();
    const first = await open(user, onClose);
    const { dialog } = first;
    expect(dialog.getByText("Fichier CSV")).toBeTruthy();
    expect(dialog.getByText("releve.csv")).toBeTruthy();
    // Date, libellé, débit, crédit : devinés d'après l'en-tête.
    const roleSelects = () => within(dialog.getByText(/À quoi correspond chaque colonne/).parentElement!).getAllByRole("combobox") as HTMLSelectElement[];
    expect(roleSelects().map((s) => s.value)).toEqual(["date", "label", "debit", "credit"]);
    expect(rows()).toHaveLength(3);
    expect(cells(rows()[0]!).slice(1, 5)).toEqual(["12/10/2026", "Versement", "", "+1 500,00 €"]);
    expect(cells(rows()[1]!).slice(1, 5)).toEqual(["13/10/2026", "Retrait", "", "-200,50 €"]);
    expect(rows()[2]!.textContent).toContain("⚠ Date illisible");
    expect((within(rows()[2]!).getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect(footer()).toMatch(/^2 nouvelle\(s\) · 0 déjà au journal · 0 déjà comptée\(s\) par un versement programmé · 1 à compléter/);

    // Un rôle déjà pris par une autre colonne lui est retiré.
    await user.selectOptions(roleSelects()[1]!, "date");
    expect(roleSelects().map((s) => s.value)).toEqual(["", "date", "debit", "credit"]);
    expect(rows()[0]!.textContent).toContain("⚠ Date illisible");
    await user.selectOptions(roleSelects()[0]!, "date");
    await user.selectOptions(roleSelects()[1]!, "label");
    expect(roleSelects().map((s) => s.value)).toEqual(["date", "label", "debit", "credit"]);

    // Le type d'opération peut être imposé ; « transfert » n'est pas proposé.
    const type = dialog.getByLabelText("Type d'opération");
    expect(within(type).queryByRole("option", { name: /Transfert/ })).toBeNull();
    await user.selectOptions(type, "Toujours : Frais");
    expect(cells(rows()[0]!)[2]).toBe("Frais");
    await user.selectOptions(type, "Deviner d'après le libellé et le signe");
    expect(cells(rows()[0]!)[2]).toBe("Versement");

    // Compte : le livret ; une ligne décochée n'est pas importée.
    await user.selectOptions(dialog.getByLabelText("Compte concerné"), livret.id);
    await user.click(within(rows()[1]!).getByRole("checkbox"));
    expect(dialog.getByRole("button", { name: "Importer 1 opération" })).toBeTruthy();
    await user.click(within(rows()[1]!).getByRole("checkbox"));
    await user.click(within(rows()[1]!).getByRole("checkbox"));
    await user.click(dialog.getByRole("button", { name: "Importer 1 opération" }));
    expect(await screen.findByText("1 opération(s) importée(s).")).toBeTruthy();
    expect(screen.getByText("2 ligne(s) non importée(s).")).toBeTruthy();
    expect((await workspace()).transactions).toMatchObject([{ type: "versement", amount: 1500, accountId: livret.id, date: "2026-10-12" }]);
    // Réglages retenus pour ce format de fichier.
    await waitFor(async () => expect(await rpc("settings.get", { key: "import.formats" })).toEqual({ "csv:date|libellé|débit|crédit": { roles: ["date", "label", "debit", "credit"], accountId: livret.id, defaultType: "auto" } }));

    // Fermer remet la fenêtre à zéro.
    await user.click(dialog.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
    first.view.unmount();

    // Même format : le compte et les rôles sont repris ; la ligne déjà importée est reconnue.
    const second = await open(user);
    expect((second.dialog.getByLabelText("Compte concerné") as HTMLSelectElement).value).toBe(livret.id);
    expect(await within(rows()[0]!).findByText("Déjà au journal")).toBeTruthy();
    expect(footer()).toMatch(/^1 nouvelle\(s\) · 1 déjà au journal/);
  });

  it("titres non reconnus : associés à un titre existant, ou créés avec leur type ; la source du cours dépend de l'ISIN", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    const existant = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Existant", priceSource: "manuel" });
    h.file = {
      name: "ordres.csv",
      content: ["Date;Opération;Titre;ISIN;Quantité;Frais;Montant", "12/10/2026;Achat;ETF Fictif Monde;IE000BI8OT95;3;1,50;-300,00", "13/10/2026;Achat;Action Maison;;2;;-80,00"].join("\n"),
    };
    const { dialog } = await open(user);
    expect(dialog.getByText("Titres non reconnus")).toBeTruthy();
    expect(dialog.getByText("IE000BI8OT95")).toBeTruthy();
    expect(cells(rows()[0]!).slice(1, 6)).toEqual(["12/10/2026", "Achat", "ETF Fictif Monde", "-300,00 €", "3"]);
    // Le type proposé exclut les obligations : ETF, action, fonds, SCPI.
    const kinds = within(dialog.getByLabelText("Type de ETF Fictif Monde")).getAllByRole("option").map((o) => o.textContent);
    expect(kinds).toEqual(expect.arrayContaining(["ETF", "Action"]));
    expect(kinds.some((k) => /Obligation/.test(k ?? ""))).toBe(false);

    // Le premier titre est créé (ETF avec ISIN : cours automatique), le second est rapproché d'un titre existant.
    await user.click(within(dialog.getByLabelText("Type de ETF Fictif Monde").parentElement!).getByRole("button", { name: "Créer" }));
    expect(await screen.findByText("Titre créé")).toBeTruthy();
    await waitFor(() => expect(dialog.queryByText("IE000BI8OT95")).toBeNull());
    expect((await workspace()).assets.find((a) => a.name === "ETF Fictif Monde")).toMatchObject({ kind: "etf", isin: "IE000BI8OT95", priceSource: "auto" });
    expect(cells(rows()[0]!)[3]).toBe("ETF Fictif Monde");
    await user.selectOptions(dialog.getByLabelText("Associer Action Maison à un titre existant"), existant.id);
    await waitFor(() => expect(dialog.queryByText("Titres non reconnus")).toBeNull());
    expect(cells(rows()[1]!)[3]).toBe("ETF Existant");
    await user.click(dialog.getByRole("button", { name: "Importer 2 opérations" }));
    expect(await screen.findByText("2 opération(s) importée(s).")).toBeTruthy();
    const bought = (await workspace()).transactions;
    expect(bought.every((t) => t.type === "achat")).toBe(true);
    expect(bought.map((t) => [t.amount, t.quantity]).sort()).toEqual([[300, 3], [80, 2]]);
  });

  it("titre sans ISIN créé à la main : cours saisi à la main, type choisi", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    h.file = { name: "ordre.csv", content: ["Date;Opération;Titre;Quantité;Montant", "13/10/2026;Achat;Action Maison;2;-80,00"].join("\n") };
    const { dialog } = await open(user);
    await user.selectOptions(dialog.getByLabelText("Type de Action Maison"), "action");
    await user.click(dialog.getByRole("button", { name: "Créer" }));
    expect(await screen.findByText("Titre créé")).toBeTruthy();
    expect((await workspace()).assets.find((a) => a.name === "Action Maison")).toMatchObject({ kind: "action", isin: null, priceSource: "manuel" });
    // Un type annulé qui s'applique : la liste d'associations proposait ce titre, désormais reconnu.
    await waitFor(() => expect(dialog.queryByText("Titres non reconnus")).toBeNull());
  });

  it("OFX et QIF : titres lus, compte retenu ; versement déjà programmé reconnu, aperçu limité à 300 lignes", async () => {
    const user = userEvent.setup();
    const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    await rpc("assets.upsert", { kind: "etf", name: "ETF Fictif Monde", isin: "IE000BI8OT95", priceSource: "manuel" });
    h.file = {
      name: "titres.ofx",
      content: [
        "<OFX><ACCTID>00001234</ACCTID>",
        "<SECINFO><SECID><UNIQUEID>IE000BI8OT95</UNIQUEID></SECID><SECNAME>ETF Fictif Monde</SECNAME></SECINFO>",
        "<BUYSTOCK><INVBUY><INVTRAN><DTTRADE>20261012</INVTRAN><SECID><UNIQUEID>IE000BI8OT95</UNIQUEID></SECID><UNITS>4<TOTAL>-400.00<COMMISSION>1.00</INVBUY></BUYSTOCK>",
        "<INCOME><DTTRADE>20261015<INCOMETYPE>DIV<TOTAL>12.50<SECID><UNIQUEID>IE000BI8OT95</UNIQUEID></SECID></INCOME>",
        "</OFX>",
      ].join("\n"),
    };
    const ofx = await open(user);
    expect(ofx.dialog.getByText("Fichier OFX")).toBeTruthy();
    expect(ofx.dialog.queryByText(/À quoi correspond chaque colonne/)).toBeNull();
    expect(cells(rows()[0]!).slice(1, 6)).toEqual(["12/10/2026", "Achat", "ETF Fictif Monde", "-400,00 €", "4"]);
    expect(cells(rows()[1]!).slice(2, 5)).toEqual(["Dividende", "ETF Fictif Monde", "+12,50 €"]);
    await user.click(ofx.dialog.getByRole("button", { name: "Importer 2 opérations" }));
    expect(await screen.findByText("2 opération(s) importée(s).")).toBeTruthy();
    await waitFor(async () => expect(await rpc("settings.get", { key: "import.formats" })).toEqual({ "ofx:1234": { accountId: cto.id, defaultType: "auto" } }));
    ofx.view.unmount();

    h.file = { name: "ordres.qif", content: ["!Type:Invst", "D20/10/2026", "NBuy", "YETF Fictif Monde", "Q2", "U-200.00", "^"].join("\n") };
    const qif = await open(user);
    expect(qif.dialog.getByText("Fichier QIF")).toBeTruthy();
    expect(rows()).toHaveLength(1);
    expect(footer()).toMatch(/^1 nouvelle\(s\)/);
    qif.view.unmount();

    // Versement programmé pour le mois en cours : le relevé le retrouve et ne le propose pas par défaut.
    await rpc("plans.set", { accountId: cto.id, fromMonth: today.slice(0, 7), amount: 300 });
    h.file = { name: "releve.csv", content: ["Date;Libellé;Montant", `${frDate(today)};VIREMENT PERMANENT;300,00`].join("\n") };
    const planned = await open(user);
    expect(await within(rows()[0]!).findByText("Déjà programmé")).toBeTruthy();
    expect(planned.dialog.getByRole("button", { name: "Importer 0 opération" }).hasAttribute("disabled")).toBe(true);
    expect(footer()).toMatch(/· 1 déjà comptée\(s\) par un versement programmé/);
    await user.click(within(rows()[0]!).getByRole("checkbox"));
    expect(planned.dialog.getByRole("button", { name: "Importer 1 opération" }).hasAttribute("disabled")).toBe(false);
    planned.view.unmount();

    // Beaucoup de lignes : l'aperçu s'arrête à 300.
    const many = ["Date;Libellé;Montant", ...Array.from({ length: 305 }, (_, i) => `01/10/2026;LIGNE ${i};${i + 1},00`)].join("\n");
    h.file = { name: "gros.csv", content: many };
    await open(user);
    expect(rows()).toHaveLength(300);
    expect(footer()).toContain("aperçu limité aux 300 premières lignes");
  });
});

describe("import Bricks : cas particuliers", () => {
  const HEAD = ["id", "date", "type", "statut", "propriété", "type de contrat", "montant (€)", "prix de la brick (€)"];
  const file = async (name: string, rows: Array<Array<string | number | null>>) => {
    h.binary = { name, bytes: await makeXlsx([HEAD, ...rows]) };
  };
  const platforms = async () => (await workspace()).accounts as never[];
  const open = async (user: ReturnType<typeof userEvent.setup>, onClose: () => void = () => undefined) => {
    const view = show(<BricksImportDialog platforms={await platforms()} onClose={onClose} />);
    await user.click(await screen.findByRole("button", { name: "Choisir le fichier" }));
    return { view, dialog: within(screen.getByRole("dialog", { name: "Importer un fichier Bricks" })) };
  };

  it("impôts du fichier comparés à la fiche de la plateforme, types inconnus signalés, intérêts déjà saisis en conflit à accepter ou non", async () => {
    const user = userEvent.setup();
    const fiche = await institution("Plateforme Fictive", { kind: "crowdlending", offers: { crowdlending: {} }, tax: { report: false, withholds: true, withheldIncomeTax: 0.1, withheldSocial: 0.1 } });
    const a = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks A", institutionId: fiche.id });
    const b = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks B" });
    await rpc("transactions.upsert", { date: "2026-03-10", type: "interets", accountId: a.id, amount: 4 });
    await file("bricks.xlsx", [
      ["d1", "02/01/2026", "Crédit par carte", "Validée", null, null, 1000, null],
      ["r1", "15/03/2026", "Revenus reversés", "Validée", "Projet Un", "loan", 10, null],
      ["t1", "15/03/2026", "Prélèvement à la source", "Validée", null, null, -3, null],
      ["x1", "16/03/2026", "Frais mystère", "Validée", null, null, -1, null],
      ["x2", "17/03/2026", "Crédit par carte", "Refusée", null, null, 50, null],
    ]);
    const onClose = vi.fn();
    const { dialog } = await open(user, onClose);
    expect(await dialog.findByText("bricks.xlsx")).toBeTruthy();
    expect(dialog.getByText(/Types d'opérations inconnus, non importés : Frais mystère\./)).toBeTruthy();
    // Plateforme A : prélève à 20 % d'après sa fiche, le fichier en montre 30 %.
    expect(norm(dialog.getByText(/Taux prélevé d'après le fichier/).textContent)).toBe("Taux prélevé d'après le fichier : 30,0 %, contre 20,0 % réglé sur l'établissement.");
    expect(norm(dialog.getByText(/à examiner/).textContent)).toMatch(/^2 à examiner · 0 déjà à jour · 1 ligne\(s\) annulée\(s\) ou refusée\(s\) ignorée\(s\)\./);
    const conflict = (await dialog.findByText("Conflit")).closest("tr")!;
    expect(conflict.textContent).toContain("Déjà 4 € déclarés à la main ce mois-là");
    const applyButton = () => dialog.getByRole("button", { name: /^Appliquer/ }) as HTMLButtonElement;
    expect(applyButton().textContent).toBe("Appliquer 1 changement");

    // Plateforme B : pas de fiche, donc rien n'est prélevé pour Hamac : avertissement, et plus de conflit.
    await user.selectOptions(dialog.getByLabelText("Plateforme"), b.id);
    expect(norm(dialog.getByText(/Le fichier contient des prélèvements à la source/).textContent)).toContain("30,0 % des revenus");
    expect(dialog.queryByText("Conflit")).toBeNull();
    expect(applyButton().textContent).toBe("Appliquer 2 changements");
    await user.selectOptions(dialog.getByLabelText("Plateforme"), a.id);

    // Cocher le conflit l'applique comme une opération nouvelle ; décocher une ligne l'écarte.
    const deposit = dialog.getByRole("checkbox", { name: "Importer Crédit par carte (Bricks)" }) as HTMLInputElement;
    await user.click(deposit);
    expect(applyButton().disabled).toBe(true);
    expect(applyButton().textContent).toBe("Appliquer 0 changement");
    await user.click(deposit);
    await user.click(dialog.getByRole("checkbox", { name: /^Importer Intérêts de 2026-03/ }));
    expect(applyButton().textContent).toBe("Appliquer 2 changements");
    await user.click(applyButton());
    expect(await dialog.findByText("2 changement(s) appliqué(s).")).toBeTruthy();
    const txs = (await workspace()).transactions;
    expect(txs.map((t) => [t.type, t.amount, t.externalId ?? null]).sort()).toEqual([
      ["interets", 4, null],
      ["interets", 7, "bricks:interets:2026-03"],
      ["versement", 1000, "bricks:d1"],
    ]);
    // Une fois fini, plus de bouton d'application ; fermer prévient le parent.
    expect(dialog.queryByRole("button", { name: /^Appliquer/ })).toBeNull();
    await user.click(dialog.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });

  it("second export : opération qui n'est plus validée à retirer, projet modifié et remboursé ; les cases s'excluent", async () => {
    const user = userEvent.setup();
    const a = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks A" });
    await file("premier.xlsx", [
      ["d1", "02/01/2026", "Crédit par carte", "Validée", null, null, 1000, null],
      ["a1", "05/01/2026", "Achat de bricks", "Validée", "Projet Un", "loan", -300, 10],
    ]);
    const first = await open(user);
    await user.click(first.dialog.getByRole("button", { name: "Appliquer 2 changements" }));
    expect(await first.dialog.findByText("2 changement(s) appliqué(s).")).toBeTruthy();
    first.view.unmount();
    expect((await workspace()).crowdProjects).toMatchObject([{ name: "Projet Un", amount: 300, accountId: a.id }]);

    await file("second.xlsx", [
      ["d1", "02/01/2026", "Crédit par carte", "Annulée", null, null, 1000, null],
      ["a1", "05/01/2026", "Achat de bricks", "Validée", "Projet Un", "loan", -300, 10],
      ["a2", "10/02/2026", "Achat de bricks", "Validée", "Projet Un", "loan", -200, 10],
      ["c1", "20/03/2026", "Remboursement de capital", "Validée", "Projet Un", "loan", 500, null],
    ]);
    const { dialog } = await open(user);
    const retire = (await dialog.findByText("À retirer")).closest("tr")!;
    expect(retire.textContent).toContain("N'est plus validée dans le fichier");
    const projet = dialog.getByText("Projet Un").closest("tr")!;
    expect(within(projet).getByText("Modifié")).toBeTruthy();
    expect(norm(projet.textContent)).toContain("investi 500 €, remboursé 500 €, remboursé en totalité");
    expect(dialog.getByRole("button", { name: "Appliquer 2 changements" })).toBeTruthy();

    // Écarter le projet : seul le retrait de l'opération reste à appliquer.
    const box = within(projet).getByRole("checkbox", { name: "Importer Projet Un" }) as HTMLInputElement;
    await user.click(box);
    expect(box.checked).toBe(false);
    expect(dialog.getByRole("button", { name: "Appliquer 1 changement" })).toBeTruthy();
    await user.click(box);
    await user.click(dialog.getByRole("button", { name: "Appliquer 2 changements" }));
    expect(await dialog.findByText("2 changement(s) appliqué(s).")).toBeTruthy();
    const ws = await workspace();
    expect(ws.transactions).toHaveLength(0);
    expect(ws.crowdProjects[0]).toMatchObject({ name: "Projet Un", amount: 500, repaidCapital: 500, status: "rembourse" });
  });

  it("fichier qui n'est pas un export Bricks, ou pas un classeur : message d'erreur, rien n'est chargé", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "crowdlending", name: "Bricks A" });
    h.binary = { name: "autre.xlsx", bytes: await makeXlsx([["a", "b"], [1, 2]]) };
    const first = await open(user);
    expect(await screen.findByText("Ce fichier ne ressemble pas à un export de transactions Bricks.")).toBeTruthy();
    expect(first.dialog.getByRole("button", { name: "Choisir le fichier" })).toBeTruthy();
    expect(first.dialog.queryByText(/à examiner/)).toBeNull();
    h.binary = { name: "faux.xlsx", bytes: new TextEncoder().encode("ceci n'est pas un classeur") };
    await user.click(first.dialog.getByRole("button", { name: "Choisir le fichier" }));
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')!.textContent!.length).toBeGreaterThan("Ce fichier ne ressemble pas à un export de transactions Bricks.".length));
    expect(first.dialog.queryByText(/à examiner/)).toBeNull();
    // Un fichier sans aucune ligne utile : tout est déjà à jour.
    await file("vide.xlsx", []);
    await user.click(first.dialog.getByRole("button", { name: "Choisir le fichier" }));
    expect(await first.dialog.findByText("Tout est déjà à jour.")).toBeTruthy();
    expect(first.dialog.getByRole("button", { name: "Appliquer 0 changement" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("compositions des ETF (administrateur)", () => {
  it("corriger un lien : saisie en majuscules, ISIN mal formé refusé, annulation, équivalent introuvable signalé", async () => {
    const user = userEvent.setup();
    h.backend.close();
    const market = await testMarket(
      amundiFake({
        LU1681043599: { replication: "Indirect(Swap Based)", name: "Amundi MSCI World Swap UCITS ETF EUR Acc" },
        IE000BI8OT95: { replication: "Direct(Physical)", name: "Amundi Core MSCI World UCITS ETF Acc" },
      }),
    );
    h.backend = await testBackend({ market });
    await market.compositions.ensure("LU1681043599");
    await market.compositions.ensure("IE000BI8OT95");
    await market.compositions.setLink("LU1681043599", "IE000BI8OT95");
    show(<CompositionAdminCard />);
    expect(await screen.findByText("aucun échec")).toBeTruthy();
    expect(screen.getByText(/Toutes les compositions demandées ont été téléchargées/)).toBeTruthy();
    expect(screen.getByText("Amundi Core MSCI World UCITS ETF Acc")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Corriger" }));
    const field = screen.getByLabelText("Nouvel équivalent de LU1681043599") as HTMLInputElement;
    const verify = screen.getByRole("button", { name: "Vérifier" }) as HTMLButtonElement;
    await user.type(field, " ie00 ");
    expect(field.value).toBe("IE00");
    expect(verify.disabled).toBe(true);
    // Entrée sur un ISIN incomplet n'envoie rien.
    await user.type(field, "{Enter}");
    expect(screen.queryByText("Lien corrigé")).toBeNull();
    expect((await market.compositions.allLinks()).map((l) => l.proxyIsin)).toEqual(["IE000BI8OT95"]);
    // Annuler referme la saisie et rend les boutons.
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByLabelText("Nouvel équivalent de LU1681043599")).toBeNull();
    expect(screen.getByRole("button", { name: "Corriger" })).toBeTruthy();

    // Équivalent que personne ne connaît : l'erreur du serveur s'affiche, le lien reste.
    await user.click(screen.getByRole("button", { name: "Corriger" }));
    await user.type(screen.getByLabelText("Nouvel équivalent de LU1681043599"), "FR0011871128");
    await user.click(screen.getByRole("button", { name: "Vérifier" }));
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')!.textContent).not.toBe(""));
    expect(screen.queryByText("Lien corrigé")).toBeNull();
    expect((await market.compositions.allLinks()).map((l) => l.proxyIsin)).toEqual(["IE000BI8OT95"]);
    expect(screen.getByLabelText("Nouvel équivalent de LU1681043599")).toBeTruthy();
  });
});
