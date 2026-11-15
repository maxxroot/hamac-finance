import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { todayIso } from "@/shared/lib/numbers";
import { ToastProvider } from "@/shared/lib/toast";
import { AllocationDialog } from "@/features/settings/dialogs/AllocationDialog";
import { AssetDialog } from "@/features/settings/dialogs/AssetDialog";
import { ContributionSplitCard } from "@/features/journal/components/CustomAllocationCards";
import { Actions } from "@/features/investments/pages/Actions";
import { Compte } from "@/features/accounts/pages/Compte";
import { AutresBiens } from "@/features/other-assets/pages/AutresBiens";
import { Bien } from "@/features/realestate/pages/Bien";
import { Credits } from "@/features/loans/pages/Credits";
import { Crowdlending } from "@/features/investments/pages/Crowdlending";
import { Crypto } from "@/features/investments/pages/Crypto";
import { FondsEuros } from "@/features/accounts/pages/FondsEuros";
import { Immobilier } from "@/features/realestate/pages/Immobilier";
import { Livrets } from "@/features/accounts/pages/Livrets";
import { Obligations } from "@/features/investments/pages/Obligations";
import { choicesFor } from "@/features/entry/dialogs/NewAssetPanel";
import { Parametres } from "@/features/settings/pages/Parametres";

/** Parcours réels : placements, autres biens, immobilier et crédits parlent au vrai backend, sur une base en mémoire. Montants fictifs. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, confirm: true }));

vi.mock("@/shared/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));

// Le dessin SVG demande un navigateur. Le faux graphique rend l'info-bulle calculée par la page : on vérifie ainsi
// ses textes sans dessiner (les couleurs et les axes ne servent qu'au dessin).
vi.mock("@/shared/components/Chart", () => ({
  Chart: ({ option }: { option: { tooltip?: { formatter?: (p: unknown) => string } } }) => (
    <div data-testid="graphique" data-infobulle={option.tooltip?.formatter?.([{ dataIndex: 0 }]) ?? ""} />
  ),
  axisStyle: () => ({}),
  tooltipStyle: () => ({}),
}));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
const workspace = () => rpc<Record<string, any>>("workspace.load");

function show(ui: ReactNode, path = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  h.backend = await testBackend();
  h.confirm = true;
  vi.stubGlobal("confirm", () => h.confirm);
  // Aucun service externe pendant les parcours.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  h.backend.close();
});

const fieldOf = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
/** Texte d'un élément, espaces insécables remplacés par des espaces. */
const texte = (el: Element | null) => (el?.textContent ?? "").replace(/[\u00a0\u202f]/g, " ");
/** Carte (bloc à bords arrondis) dont le titre est ce texte. */
const carteDe = (titre: string, el: HTMLElement = screen.getByText(titre)) => el.closest("div.rounded-2xl") as HTMLElement;
/** Première ligne de tableau portant ce texte (le tableau des positions précède celui des mouvements). */
const ligne = (nom: string | RegExp) => screen.getAllByText(nom)[0]!.closest("tr") as HTMLElement;
/** Date locale AAAA-MM-JJ, comme `todayIso`. */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ilYaJours = (n: number) => iso(new Date(Date.now() - n * 86_400_000));
const dansJours = (n: number) => iso(new Date(Date.now() + n * 86_400_000));
/** Même jour, `n` années plus tard (le 29 février devient le 28, pour rester une date valide). */
const dansAns = (n: number) => {
  const [a, m, j] = todayIso().split("-");
  return `${+a! + n}-${m}-${String(Math.min(+j!, 28)).padStart(2, "0")}`;
};

type Id = { id: string };
const compte = (kind: string, name: string, extra: Record<string, unknown> = {}) => rpc<Id>("accounts.upsert", { kind, name, ...extra });
const titre = (kind: string, name: string, extra: Record<string, unknown> = {}) => rpc<Id>("assets.upsert", { kind, name, priceSource: "manuel", ...extra });
/** Fonds euros créé avec le contrat, son support par défaut. */
const fondsDe = (contrat: Id) => (contrat as Id & { defaultAssetId: string }).defaultAssetId;
const operation = (date: string, type: string, accountId: string, amount: number, extra: Record<string, unknown> = {}) => rpc<Id>("transactions.upsert", { date, type, accountId, amount, ...extra });
const cours = (assetId: string, price: number, date = todayIso()) => rpc("prices.setManual", { assetId, date, price });

describe("pages d'enveloppe sans aucun compte", () => {
  it.each([
    ["Livrets", <Livrets />],
    ["Obligations", <Obligations />],
    ["Crypto", <Crypto />],
    ["Fonds euros", <FondsEuros />],
  ])("%s : la page propose de démarrer", async (_nom, page) => {
    show(page);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });
});

describe("Actions & ETF", () => {
  it("sans compte, la page propose de démarrer", async () => {
    show(<Actions />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });

  it("PEA : positions, parts cibles, achat conseillé, cours manquant puis saisi à la main", async () => {
    const user = userEvent.setup();
    const courtier = await rpc<Id>("institutions.upsert", { name: "Courtier Fictif", kind: "courtier" });
    const pea = await compte("pea", "Mon PEA", { openedOn: "2018-03-01", monthsToInvest: 6, institutionId: courtier.id });
    const monde = await titre("etf", "ETF Monde", { isin: "IE000BI8OT95", targetWeight: 0.7, ter: 0.002 });
    const emergents = await titre("etf", "ETF Émergents", { targetWeight: 0.3 });
    await operation("2025-01-05", "apport_initial", pea.id, 2000);
    await operation("2025-01-06", "achat", pea.id, 1000, { assetId: monde.id, quantity: 10 });
    await operation("2025-01-07", "achat", pea.id, 500, { assetId: emergents.id, quantity: 50 });
    await cours(monde.id, 120);
    show(<Actions />);

    // Le bandeau des comptes : le PEA, son établissement, un lien vers sa page.
    const bandeau = within(await screen.findByRole("navigation", { name: "Comptes concernés" }));
    expect(bandeau.getByRole("link", { name: "Mon PEA" }).getAttribute("href")).toBe(`/comptes/${pea.id}`);
    expect(bandeau.getByText("Courtier Fictif")).toBeTruthy();
    // ETF Monde : 10 parts à 120 € = 1 200 €, au cours saisi ; ETF Émergents : au prix de revient faute de cours.
    const rowMonde = ligne("ETF Monde");
    expect(texte(rowMonde)).toContain("IE000BI8OT95");
    expect(texte(rowMonde)).toContain("Mon PEA");
    expect(texte(rowMonde)).toMatch(/manuel/);
    expect(texte(rowMonde)).toMatch(/70,6 %$/);
    expect(texte(ligne("ETF Émergents"))).toMatch(/prix de revient/);
    expect(screen.getByText(/Cours indisponible pour ETF Émergents/)).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    // Parts cibles : réelle, cible, écart.
    const cibles = within(screen.getByText("Parts cibles").closest("div.rounded-2xl") as HTMLElement);
    expect(texte(cibles.getByText("ETF Monde").closest("tr"))).toMatch(/70,6 %70,0 %\+0,6 %/);
    expect(screen.getByText("Achat conseillé ce mois-ci")).toBeTruthy();
    expect(screen.getByText("sur 6 mois")).toBeTruthy();
    expect(screen.getByText("Si les actions baissent")).toBeTruthy();
    expect(screen.getByText("Frais de gestion des ETF / an")).toBeTruthy();

    // Saisir le cours manquant : l'avertissement disparaît, le cours est enregistré.
    await user.click(within(ligne("ETF Émergents")).getByTitle("Saisir le cours à la main"));
    const dialog = within(await screen.findByRole("dialog"));
    expect((dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(dialog.getByLabelText("Cours"), "12");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.queryByText(/Cours indisponible pour/)).toBeNull());
    const prix = (await workspace()).prices.filter((p: { assetId: string }) => p.assetId === emergents.id);
    expect(prix).toMatchObject([{ price: 12, date: todayIso() }]);
  });

  it("PEA et compte-titres : une ligne par titre et par compte, la part cible sur l'ensemble, le compte mène à sa page", async () => {
    const user = userEvent.setup();
    const pea = await compte("pea", "Mon PEA");
    const cto = await compte("cto", "Mon CTO");
    const monde = await titre("etf", "ETF Monde", { targetWeight: 1 });
    await operation("2025-01-05", "apport_initial", pea.id, 600);
    await operation("2025-01-05", "apport_initial", cto.id, 400);
    await operation("2025-01-06", "achat", pea.id, 600, { assetId: monde.id, quantity: 6 });
    await operation("2025-01-06", "achat", cto.id, 400, { assetId: monde.id, quantity: 4 });
    await cours(monde.id, 100);
    show(
      <Routes>
        <Route path="/actions" element={<Actions />} />
        <Route path="/comptes/:id" element={<Compte />} />
      </Routes>,
      "/actions",
    );
    const table = within((await screen.findAllByRole("table"))[0]!);
    const lignes = table.getAllByRole("row").filter((r) => texte(r).includes("ETF Monde"));
    expect(lignes.map((r) => texte(r))).toEqual([expect.stringMatching(/Mon PEA.*60,0 %$/), expect.stringMatching(/Mon CTO.*40,0 %$/)]);
    // Détenu dans deux comptes : 100 % de la cible, atteinte sur l'ensemble.
    const cibles = within(screen.getByText("Parts cibles").closest("div.rounded-2xl") as HTMLElement);
    expect(texte(cibles.getByText("ETF Monde").closest("tr"))).toMatch(/100,0 %100,0 %0,0 %/);
    // Le nom du compte, dans le tableau, ouvre la page du compte.
    await user.click(within(lignes[1]!).getByRole("link", { name: "Mon CTO" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Mon CTO" })).toBeTruthy();
  });

  it("compte-titres qui ne détient qu'un ETC : affiché avec ses positions", async () => {
    const cto = await compte("cto", "Mon CTO");
    const or = await titre("etc", "iShares Physical Gold ETC", { isin: "IE00B4ND3602" });
    await operation("2025-01-05", "apport_initial", cto.id, 1000);
    await operation("2025-01-06", "achat", cto.id, 600, { assetId: or.id, quantity: 10 });
    await cours(or.id, 68);
    show(<Actions />);

    expect(texte(await waitFor(() => ligne("iShares Physical Gold ETC")))).toContain("IE00B4ND3602");
    expect(screen.queryByText("aucune action")).toBeNull();
  });

  it("le tri des colonnes réordonne les lignes, et un clic sur la ligne déplie l'évolution du titre", async () => {
    const user = userEvent.setup();
    const pea = await compte("pea", "Mon PEA");
    const a = await titre("etf", "ETF Alpha");
    const b = await titre("etf", "ETF Bêta");
    await operation("2025-01-05", "apport_initial", pea.id, 3000);
    await operation("2025-01-06", "achat", pea.id, 1000, { assetId: a.id, quantity: 10 });
    await operation("2025-01-06", "achat", pea.id, 2000, { assetId: b.id, quantity: 20 });
    await cours(a.id, 100);
    await cours(b.id, 100);
    show(<Actions />);
    await screen.findAllByText("ETF Alpha");
    const noms = () => within(screen.getAllByRole("table")[0]!).getAllByRole("row").map((r) => texte(r)).filter((t) => /ETF (Alpha|Bêta)/.test(t)).map((t) => (t.includes("Alpha") ? "Alpha" : "Bêta"));
    const colonne = (nom: string) => within(screen.getAllByRole("table")[0]!).getByRole("columnheader", { name: new RegExp(`^${nom}$`) });
    await user.click(within(colonne("Valeur")).getByRole("button"));
    const premier = noms();
    await user.click(within(colonne("Valeur")).getByRole("button"));
    expect(noms()).toEqual([...premier].reverse());
    // Chaque colonne trie, le plus grand d'abord au premier clic : Alpha a investi 1 000 €, Bêta 2 000 €.
    await user.click(within(colonne("Investi")).getByRole("button"));
    expect(colonne("Investi").getAttribute("aria-sort")).toBe("descending");
    expect(noms()).toEqual(["Bêta", "Alpha"]);
    await user.click(within(colonne("Investi")).getByRole("button"));
    expect(colonne("Investi").getAttribute("aria-sort")).toBe("ascending");
    expect(noms()).toEqual(["Alpha", "Bêta"]);
    for (const nom of ["Titre", "Compte", "Parts", "PRU", "Cours", "Plus-value", "Plus-value \\(%\\)", "Part"]) {
      await user.click(within(colonne(nom)).getByRole("button"));
      expect(noms()).toHaveLength(2);
    }

    await user.click(within(ligne("ETF Alpha")).getByRole("button", { name: /Afficher le détail : ETF Alpha/ }));
    expect(await screen.findByText(/L'évolution apparaîtra après un mois d'historique|Valeur totale :/)).toBeTruthy();
    await user.click(within(ligne("ETF Alpha")).getByRole("button", { name: /Masquer le détail : ETF Alpha/ }));
    expect(screen.queryByText(/L'évolution apparaîtra après un mois d'historique/)).toBeNull();
  });

  it("compte-titres sans action : carte compacte avec son établissement et un bouton d'achat réglé sur ce compte", async () => {
    const user = userEvent.setup();
    const courtier = await rpc<Id>("institutions.upsert", { name: "Courtier Fictif", kind: "courtier" });
    const vide = await compte("cto", "CTO obligations", { institutionId: courtier.id });
    const plein = await compte("cto", "CTO actions");
    const etf = await titre("etf", "ETF Monde");
    await operation("2025-01-05", "versement", vide.id, 800);
    await operation("2025-01-05", "versement", plein.id, 500);
    await operation("2025-01-06", "achat", plein.id, 500, { assetId: etf.id, quantity: 5 });
    show(<Actions />);
    const bandeau = within(await screen.findByRole("navigation", { name: "Comptes concernés" }));
    const carte = bandeau.getByRole("link", { name: "CTO obligations" }).closest("div.rounded-2xl") as HTMLElement;
    expect(texte(carte)).toContain("Courtier Fictif");
    expect(texte(carte)).toContain("aucune action");
    expect(texte(carte)).toMatch(/espèces\s*800/);
    expect(texte(ligne("ETF Monde"))).toContain("CTO actions");
    // Pas de PEA : la page propose d'en créer un.
    expect(screen.getByText(/Pas encore de PEA/)).toBeTruthy();
    // « Acheter des actions ou ETF » ouvre la saisie réglée sur ce compte.
    await user.click(within(carte).getByRole("button", { name: "Acheter des actions ou ETF" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouvelle opération" }));
    expect((dialog.getByLabelText(/^Compte/) as HTMLSelectElement).value).toBe(vide.id);
  });

  it("assurance-vie investie en ETF : elle apparaît avec les actions, valorisée au cours saisi", async () => {
    const av = await compte("assurance_vie", "Mon assurance-vie");
    const etf = await titre("etf", "ETF Monde UC");
    await operation("2025-01-05", "versement", av.id, 1000);
    await operation("2025-01-06", "achat", av.id, 1000, { assetId: etf.id, quantity: 10 });
    await cours(etf.id, 110);
    show(<Actions />);
    expect(texte(await waitFor(() => ligne("ETF Monde UC")))).toMatch(/Mon assurance-vie.*1 100/);
  });
});

describe("Page d'un compte", () => {
  const page = (id: string) =>
    show(
      <Routes>
        <Route path="/comptes/:id" element={<Compte />} />
        <Route path="/comptes" element={<p>Liste des comptes</p>} />
      </Routes>,
      `/comptes/${id}`,
    );

  it("assurance-vie : fonds euros et unités de compte réunis, répartition par classe, caractéristiques du contrat", async () => {
    const assureur = await rpc<Id>("institutions.upsert", { name: "Assureur Fictif", kind: "assureur" });
    const av = await compte("assurance_vie", "Mon contrat", { openedOn: "2015-06-01", institutionId: assureur.id, beneficiaryClause: true });
    const etf = await titre("etf", "ETF Monde UC", { isin: "IE000BI8OT95" });
    await operation("2025-01-05", "versement", av.id, 1000);
    await operation("2025-01-06", "achat", av.id, 400, { assetId: etf.id, quantity: 4 });
    await cours(etf.id, 150);
    page(av.id);

    expect(await screen.findByRole("heading", { level: 1, name: "Mon contrat" })).toBeTruthy();
    expect(screen.getByText(/Assurance-vie · Assureur Fictif · ouvert le 01\/06\/2015/)).toBeTruthy();
    // 600 € au fonds euros, 4 parts à 150 € : 1 200 €, moitié-moitié.
    const repartition = within(screen.getByText("Répartition par classe d'actifs").closest("div.rounded-2xl") as HTMLElement);
    expect(repartition.getByRole("link", { name: "Fonds euros" }).getAttribute("href")).toBe("/fonds-euros");
    expect(repartition.getByRole("link", { name: "Actions" }).getAttribute("href")).toBe("/actions");
    expect(texte(ligne("ETF Monde UC"))).toMatch(/Actions.*600.*50,0 %$/);
    const fonds = screen.getAllByRole("row").find((r) => /Fonds euros/.test(texte(r)) && /—/.test(texte(r)))!;
    expect(texte(fonds)).toMatch(/600.*50,0 %$/);
    expect(screen.getByText("Fiscalité allégée (8 ans)")).toBeTruthy();
    expect(screen.getByText("depuis le 01/06/2023")).toBeTruthy();
    expect(within(screen.getByText("Caractéristiques").closest("div.rounded-2xl") as HTMLElement).getByText("rédigée")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mouvements" })).toBeTruthy();
  });

  it("PEA : l'achat conseillé et la grille de courtage sont sur sa page", async () => {
    const pea = await compte("pea", "Mon PEA", { openedOn: "2024-01-15", monthsToInvest: 4 });
    const etf = await titre("etf", "ETF Monde", { targetWeight: 1 });
    await operation("2025-01-05", "apport_initial", pea.id, 2000);
    await operation("2025-01-06", "achat", pea.id, 1000, { assetId: etf.id, quantity: 10 });
    page(pea.id);
    expect(await screen.findByText("Achat conseillé ce mois-ci")).toBeTruthy();
    expect(screen.getByText("Frais par défaut")).toBeTruthy();
    // Ouvert en 2024 : la fiscalité allégée viendra dans 5 ans.
    expect(screen.getByText("15/01/2029")).toBeTruthy();
    // Les espèces non investies ont leur ligne dans la composition.
    expect(texte(screen.getAllByRole("row").find((r) => texte(r).startsWith("Espèces"))!)).toMatch(/1 000/);
  });

  it("compte inconnu : un message et un lien vers Mes comptes", async () => {
    await compte("pea", "Mon PEA");
    page("inconnu");
    expect(await screen.findByText("Ce compte n'existe pas ou a été supprimé.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Revenir à Mes comptes" }).getAttribute("href")).toBe("/comptes");
  });
});

describe("Livrets", () => {
  it("sans livret, la page propose d'en créer un", async () => {
    await compte("pea", "Mon PEA");
    show(<Livrets />);
    expect(await screen.findByText(/Aucun livret pour l'instant/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter un livret" })).toBeTruthy();
  });

  it("totaux, taux moyen, plafond dépassé et ordre de remplissage ; tri et évolution d'un livret", async () => {
    const user = userEvent.setup();
    const banque = await rpc<Id>("institutions.upsert", { name: "Banque Fictive", kind: "banque" });
    const lep = await compte("livret", "Mon épargne", { livretType: "LEP", institutionId: banque.id, rate: 0.025, depositCeiling: 10_000, role: "Précaution", sortOrder: 1 });
    const livretA = await compte("livret", "Livret A", { livretType: "LIVRET_A", rate: 0.015, depositCeiling: 1_000, sortOrder: 2 });
    await operation("2025-01-05", "apport_initial", lep.id, 6_000);
    await operation("2025-01-05", "apport_initial", livretA.id, 1_200);
    show(<Livrets />);

    expect(await screen.findByText("Total des livrets")).toBeTruthy();
    expect(screen.getByText("Taux moyen pondéré")).toBeTruthy();
    expect(screen.getByText(`Intérêts estimés ${todayIso().slice(0, 4)}`)).toBeTruthy();
    const rowLep = ligne("Mon épargne");
    // Nom différent du type : le type est rappelé ; l'établissement et le rôle sont affichés.
    expect(texte(rowLep)).toMatch(/Mon épargne · .*(LEP|populaire)/i);
    expect(texte(rowLep)).toContain("Banque Fictive");
    expect(texte(rowLep)).toContain("Précaution");
    expect(texte(rowLep)).toMatch(/2,50 %/);
    // Livret A : 1 200 € pour 1 000 € de plafond, marge négative expliquée au survol.
    const rowA = ligne("Livret A");
    expect(texte(rowA)).toMatch(/-200/);
    expect(within(rowA).getByTitle(/Au-delà du plafond de dépôt/)).toBeTruthy();
    expect(screen.getByText(/Ordre de remplissage : Mon épargne \(10 000 €\) → Livret A \(1 000 €\)/)).toBeTruthy();

    // Tri : le plus gros solde d'abord au premier clic, l'inverse au second.
    const livrets = () => within(screen.getAllByRole("table")[0]!).getAllByRole("row").map((r) => texte(r)).filter((t) => /Mon épargne|Livret A/.test(t)).map((t) => (t.startsWith("Mon épargne") ? "épargne" : "A"));
    const entete = (nom: string) => within(screen.getAllByRole("table")[0]!).getByRole("columnheader", { name: new RegExp(`^${nom}$`) });
    await user.click(within(entete("Solde")).getByRole("button"));
    expect(livrets()).toEqual(["épargne", "A"]);
    await user.click(within(entete("Solde")).getByRole("button"));
    expect(livrets()).toEqual(["A", "épargne"]);
    for (const nom of ["Livret", "Établissement", "Taux actuel", "Plafond", "Versement mensuel", "Marge avant plafond", "Intérêts \\d{4}", "Intérêts encaissés"]) {
      await user.click(within(entete(nom)).getByRole("button"));
      expect(livrets()).toHaveLength(2);
    }

    // Un clic sur la ligne déplie l'évolution du livret.
    await user.click(within(ligne("Livret A")).getByRole("button", { name: /Afficher le détail : Livret A/ }));
    expect(await screen.findByText(/L'évolution apparaîtra après un mois d'historique|Valeur totale :/)).toBeTruthy();
  });

  it("historique des taux : un nouveau taux est enregistré, daté, puis supprimable", async () => {
    const user = userEvent.setup();
    const a = await compte("livret", "Livret A", { livretType: "LIVRET_A", rate: 0.03 });
    const b = await compte("livret", "LDDS", { livretType: "LDDS", rate: 0.03 });
    await operation("2025-01-05", "apport_initial", a.id, 1_000);
    await operation("2025-01-05", "apport_initial", b.id, 500);
    show(<Livrets />);
    await screen.findByText("Historique des taux");
    // Pas de taux sans valeur saisie.
    expect((screen.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Livret"), b.id);
    fireEvent.change(fieldOf("Nouveau taux à partir du"), { target: { value: "2026-02-01" } });
    await user.type(fieldOf("Taux"), "2,4");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).accountRates).toEqual(expect.arrayContaining([expect.objectContaining({ accountId: b.id, fromDate: "2026-02-01", rate: 0.024 })])));
    // Le champ est vidé après l'enregistrement, et la ligne apparaît dans l'historique.
    await waitFor(() => expect(fieldOf("Taux").value).toBe(""));
    const ligneTaux = within(carteDe("Historique des taux")).getAllByRole("row").find((tr) => /LDDS.*01\/02\/2026/.test(texte(tr)))!;
    expect(texte(ligneTaux)).toMatch(/2,40 %/);
    await user.click(within(ligneTaux).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).accountRates.some((r: { fromDate: string }) => r.fromDate === "2026-02-01")).toBe(false));
  });
});

describe("Crypto", () => {
  it("sans plateforme, la page propose d'en ajouter une, sans position ni vente", async () => {
    await compte("pea", "Mon PEA");
    show(<Crypto />);
    expect(await screen.findByText(/Aucune plateforme crypto/)).toBeTruthy();
    expect(screen.getByText("Aucune position.")).toBeTruthy();
    expect(screen.getByText("Aucune vente.")).toBeTruthy();
    expect(screen.getByText("Aucune vente imposable.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter une plateforme" })).toBeTruthy();
  });

  it("achats, vente contre euros, impôt estimé, cours manquant puis saisi, évolution", async () => {
    const user = userEvent.setup();
    const plateforme = await compte("crypto", "Plateforme Fictive");
    const btc = await titre("crypto", "Bitcoin");
    const eth = await titre("crypto", "Ether");
    await operation("2025-01-05", "versement", plateforme.id, 5_000);
    await operation("2025-01-06", "achat", plateforme.id, 3_000, { assetId: btc.id, quantity: 0.1 });
    await operation("2025-01-07", "achat", plateforme.id, 1_000, { assetId: eth.id, quantity: 2 });
    await operation("2025-03-01", "vente", plateforme.id, 2_500, { assetId: btc.id, quantity: 0.05 });
    await cours(btc.id, 60_000);
    show(<Crypto />);

    expect(await screen.findByText("Si tout était vendu aujourd'hui")).toBeTruthy();
    expect(screen.getByText("Euros sur la plateforme")).toBeTruthy();
    // Bitcoin : 0,05 reste à 60 000 € ; Ether sans cours est valorisé à son prix d'achat.
    const btcRow = ligne("Bitcoin");
    expect(texte(btcRow)).toContain("Plateforme Fictive");
    expect(screen.getByText(/Cours non disponible pour Ether/)).toBeTruthy();
    expect(texte(ligne("Ether"))).toMatch(/indisponible/);
    // La vente de 2 500 € dépasse le seuil d'exonération : l'année est imposable.
    const ventes = screen.getByText("Ventes contre des euros").parentElement as HTMLElement;
    expect(within(ventes).getByText("01/03/2025")).toBeTruthy();
    expect(screen.getByText("Imposable")).toBeTruthy();
    expect(screen.getByText("Plus-value latente (portefeuille global)")).toBeTruthy();
    expect(screen.getByText("Impôt estimé")).toBeTruthy();
    expect(screen.getByText("Valeur nette après impôt")).toBeTruthy();
    expect(screen.getByText(/déjà arrivé plusieurs fois/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Évolution/ }));
    expect(await screen.findByText(/L'évolution apparaîtra après un mois d'historique|Valeur totale :/)).toBeTruthy();
    await user.click(within(ligne("Bitcoin")).getByRole("button", { name: /Afficher le détail : Bitcoin/ }));

    await user.click(within(ligne("Ether")).getByTitle("Saisir le cours à la main"));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Cours"), "700");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.queryByText(/Cours non disponible pour/)).toBeNull());
    expect((await workspace()).prices.some((p: { assetId: string; price: number }) => p.assetId === eth.id && p.price === 700)).toBe(true);

    // Chaque colonne trie.
    const tete = (nom: string) => within(screen.getAllByRole("table")[0]!).getByRole("columnheader", { name: new RegExp(`^${nom}$`) });
    await user.click(within(tete("Valeur")).getByRole("button"));
    expect(tete("Valeur").getAttribute("aria-sort")).toBe("descending");
    for (const nom of ["Crypto", "Plateforme", "Quantité", "Prix de revient unitaire", "Investi", "Cours", "Plus-value latente", "\\(%\\)"]) {
      await user.click(within(tete(nom)).getByRole("button"));
      expect(within(screen.getAllByRole("table")[0]!).getAllByRole("row")).toHaveLength(4);
    }
  });

  it("achat sans versement : le solde en euros négatif est signalé ; sous le seuil, aucun impôt n'est estimé", async () => {
    const plateforme = await compte("crypto", "Plateforme Fictive");
    const btc = await titre("crypto", "Bitcoin");
    await operation("2025-01-06", "achat", plateforme.id, 200, { assetId: btc.id, quantity: 0.01 });
    await cours(btc.id, 30_000);
    show(<Crypto />);
    expect(await screen.findByText(/Négatif : un versement manque dans le journal/)).toBeTruthy();
    // Valeur 300 € pour 200 € d'achat : plus-value latente, mais sous le seuil d'exonération.
    const carte = screen.getByText("Impôt estimé").closest("div") as HTMLElement;
    expect(texte(carte)).toMatch(/0,00 €/);
  });
});

describe("Fonds euros", () => {
  it("sans contrat, la page propose d'en créer un", async () => {
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    show(<FondsEuros />);
    expect(await screen.findByText(/Aucun contrat d'assurance-vie/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ajouter un contrat" })).toBeTruthy();
  });

  it("fiche du contrat : ancienneté, règle des 8 ans, clause, frais et taux moyen servi", async () => {
    const assureur = await rpc<Id>("institutions.upsert", { name: "Assureur Fictif", kind: "assureur", offers: { assurance_vie: { entryFee: 0.01, euroFee: 0.007 } } });
    const av = await compte("assurance_vie", "Contrat principal", { institutionId: assureur.id, openedOn: dansAns(-3).replace(/-\d\d-\d\d$/, "-01-15"), beneficiaryClause: true });
    await operation("2023-01-05", "versement", av.id, 1_000);
    await rpc("fundRates.set", { accountId: av.id, assetId: fondsDe(av), year: 2023, rate: 0.025 });
    await rpc("fundRates.set", { accountId: av.id, assetId: fondsDe(av), year: 2024, rate: 0.035 });
    await operation("2023-12-31", "interets", av.id, 25);
    show(<FondsEuros />);
    expect(await screen.findByRole("heading", { name: /^Contrat principal/ })).toBeTruthy();
    expect(texte(screen.getByRole("heading", { name: /^Contrat principal/ }))).toContain("Assureur Fictif");
    expect(screen.getByText(/ans? et \d+ mois/)).toBeTruthy();
    // Moins de 8 ans : la date d'allègement est future.
    expect(screen.getByText(/\(8 ans\)/)).toBeTruthy();
    expect(screen.getByText("rédigée")).toBeTruthy();
    expect(texte(screen.getByText("Garantie FGAP").nextElementSibling)).toMatch(/^marge de .* sous 70 000 €$/);
    expect(texte(screen.getByText("Frais").nextElementSibling)).toBe("versements 1,00 % · gestion 0,70 % / an");
    // Taux moyen servi : (2,5 + 3,5) / 2 = 3,0 %.
    const dd = screen.getByText("Taux moyen servi").nextElementSibling as HTMLElement;
    expect(texte(dd)).toMatch(/^3,0+ %/);
    // Taux servis : les intérêts saisis de l'année sont rappelés.
    expect(texte(ligne("2023"))).toMatch(/25,00 €/);
  });

  it("contrat sans date ni assureur : les informations manquantes sont signalées ; un contrat de plus de 8 ans est allégé", async () => {
    await compte("assurance_vie", "Contrat sans fiche");
    await compte("assurance_vie", "Vieux contrat", { openedOn: "2010-06-15" });
    show(<FondsEuros />);
    expect(await screen.findByRole("heading", { name: /^Contrat sans fiche/ })).toBeTruthy();
    expect(screen.getByText("renseigner la date d'ouverture")).toBeTruthy();
    expect(screen.getAllByText("à rédiger")).toHaveLength(2);
    expect(screen.getAllByText("à renseigner dans Paramètres › Établissements").length).toBeGreaterThan(0);
    expect(screen.getByText(/depuis le 15\/06\/2018/)).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Aucun taux saisi.")).toHaveLength(2);
  });

  it("relevé de l'assureur : l'écart avec le calcul est signalé, puis la concordance", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal", { openedOn: "2020-01-15" });
    await operation("2024-01-05", "versement", av.id, 1_000);
    show(<FondsEuros />);
    expect(await screen.findByText(/Relevez la valeur sur le site de l'assureur/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Enregistrer le relevé" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(fieldOf("Le"), { target: { value: "2024-06-01" } });
    await user.type(fieldOf("Valeur relevée"), "1300");
    await user.click(screen.getByRole("button", { name: "Enregistrer le relevé" }));
    expect(await screen.findByText(/Relevé du 01\/06\/2024/)).toBeTruthy();
    expect(await screen.findByText(/Écart de\s+à la date du relevé/)).toBeTruthy();
    expect((await workspace()).statements).toMatchObject([{ accountId: av.id, date: "2024-06-01", value: 1300 }]);

    // Un relevé conforme au calcul remplace l'avertissement par la coche.
    fireEvent.change(fieldOf("Le"), { target: { value: "2024-07-01" } });
    await user.type(fieldOf("Valeur relevée"), "1000");
    await user.click(screen.getByRole("button", { name: "Enregistrer le relevé" }));
    expect(await screen.findByText(/Concorde avec le calcul/)).toBeTruthy();
  });

  it("taux servis : ajout d'une année, refus tant que le taux manque, puis suppression", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal", { openedOn: "2020-01-15" });
    await operation("2023-01-05", "versement", av.id, 1_000);
    show(<FondsEuros />);
    const carte = carteDe("Taux servis", await screen.findByText("Taux servis"));
    const ajouter = within(carte).getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
    const annee = within(carte).getByLabelText("Année") as HTMLInputElement;
    expect(annee.value).toBe(String(+todayIso().slice(0, 4) - 1));
    await user.clear(annee);
    await user.type(annee, "2023");
    await user.type(within(carte).getByLabelText("Taux"), "2,6");
    await user.click(ajouter);
    await waitFor(async () => expect((await workspace()).fundRates).toMatchObject([{ accountId: av.id, year: 2023, rate: 0.026 }]));
    const row = (await within(carte).findByText("2023")).closest("tr") as HTMLElement;
    expect(texte(row)).toMatch(/2,6 %/);
    await user.click(within(row).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).fundRates).toEqual([]));
    expect(await within(carte).findByText("Aucun taux saisi.")).toBeTruthy();
  });

  it("chaque fonds euros du contrat a son solde, ses intérêts et ses taux ; un second se crée depuis la page", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal", { openedOn: "2020-01-15" });
    await operation("2024-01-05", "versement", av.id, 1_000);
    await operation("2024-12-31", "interets", av.id, 30);
    show(<FondsEuros />);
    const defaut = carteDe("Fonds euros (Contrat principal)", await screen.findByText("Fonds euros (Contrat principal)"));
    expect(within(defaut).getByText("support par défaut")).toBeTruthy();
    expect(texte(within(defaut).getByText("Solde").nextElementSibling)).toBe("1 030,00 €");
    expect(texte(within(defaut).getByText("Intérêts reçus").nextElementSibling)).toBe("30,00 €");

    // « Verser sur un autre fonds euros » : le support est créé avec le versement.
    await user.click(screen.getByRole("button", { name: "Verser sur un autre fonds euros" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nom du fonds euros"), "Euro Croissance Fictif");
    await user.type(within(dialog).getByLabelText("Montant"), "500");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    // Son nom figure aussi dans les mouvements : on prend la carte du fonds.
    const second = (await screen.findAllByText("Euro Croissance Fictif")).map((el) => carteDe("", el)).find((c) => c && within(c).queryByText("Solde"))!;
    expect(within(second).queryByText("support par défaut")).toBeNull();
    expect(texte(within(second).getByText("Solde").nextElementSibling)).toBe("500,00 €");
    const ws = await workspace();
    const fund = (ws.assets as Array<{ id: string; name: string; kind: string }>).find((a) => a.name === "Euro Croissance Fictif")!;
    expect(fund.kind).toBe("fonds_euros");
    expect((ws.transactions as Array<{ amount: number }>).find((t) => t.amount === 500)).toMatchObject({ type: "versement", accountId: av.id, assetId: fund.id });
    // Le fonds par défaut n'a pas bougé.
    expect(texte(within(defaut).getByText("Solde").nextElementSibling)).toBe("1 030,00 €");
  });

  it("arbitrage : du fonds euros vers une unité de compte, sans passer par les espèces", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal", { openedOn: "2020-01-15" });
    const etf = await rpc<Id>("assets.upsert", { kind: "etf", name: "ETF Monde Fictif" });
    await operation("2024-01-05", "versement", av.id, 1_000);
    show(<FondsEuros />);
    await user.click(await screen.findByRole("button", { name: "Arbitrage" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Support cédé"), fondsDe(av));
    // Un fonds euros se compte en euros : pas de quantité cédée.
    expect(within(dialog).queryByLabelText("Quantité cédée")).toBeNull();
    await user.selectOptions(within(dialog).getByLabelText("Support reçu"), etf.id);
    await user.type(within(dialog).getByLabelText("Quantité reçue"), "4");
    await user.type(within(dialog).getByLabelText("Valeur de l'échange"), "400");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () =>
      expect((await workspace()).transactions.find((t: { type: string }) => t.type === "arbitrage")).toMatchObject({ accountId: av.id, assetId: fondsDe(av), quantity: null, counterAssetId: etf.id, counterQuantity: 4, amount: 400 }),
    );
    const defaut = carteDe("Fonds euros (Contrat principal)", (await screen.findAllByText("Fonds euros (Contrat principal)"))[0]);
    expect(texte(within(defaut).getByText("Solde").nextElementSibling)).toBe("600,00 €");
  });

  it("le bouton d'évolution du contrat déplie son historique", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal");
    await operation("2024-01-05", "versement", av.id, 1_000);
    show(<FondsEuros />);
    await user.click(await screen.findByRole("button", { name: /Évolution/ }));
    expect(await screen.findByText(/L'évolution apparaîtra après un mois d'historique|Valeur totale :/)).toBeTruthy();
  });
});

/** Un backend dont les sites de cours sont simulés (OpenFIGI, Euronext, CoinGecko), pour la recherche de titres. */
async function avecReseau(reponses: { down?: boolean; obligation?: "etat" | "entreprise" | "aucun" } = {}) {
  const figi = (body: Record<string, unknown>, mapping: boolean) => {
    if (mapping) {
      const isin = (body as unknown as Array<{ idValue: string }>)[0]!.idValue;
      if (isin === "FR0099999991") return [{ data: [{ name: "FRANCE (GOVT OF)", ticker: "FRTR 3 05/25/33 OAT", exchCode: "FP", securityType2: "Govt", marketSector: "Govt" }] }];
      if (isin === "FR0099999992") return [{ data: [{ name: "Société Fictive SA", ticker: "SOCF 4.5 09/01/30 EMTN", exchCode: "FP", securityType2: "Corp", marketSector: "Corp" }] }];
      if (isin === "FR0099999993") return [{ data: [{ name: "FONDS FICTIF ETF", ticker: "FFE", exchCode: "FP", securityType: "ETP", securityType2: "ETP" }] }];
      return [{ warning: "No identifier found." }];
    }
    return body.exchCode === "FP" ? { data: [{ name: "SOCIÉTÉ FICTIVE", ticker: "SOCF", exchCode: "FP", securityType2: "Common Stock", marketSector: "Equity" }] } : { data: [] };
  };
  const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    if (reponses.down) return new Response("panne", { status: 500 });
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.includes("openfigi.com/v3/mapping")) return Response.json(figi(body, true));
    if (url.includes("openfigi.com/v3/search")) return Response.json(figi(body, false));
    if (url.includes("instrumentSearch")) return Response.json([{ isin: "FR0099999994", mic: "XPAR", label: "<a href='x'>Société Fictive</a><span class='symbol'>SOCF</span>", link: "/en/product/equities/FR0099999994-XPAR" }]);
    if (url.includes("coingecko.com/api/v3/search")) return Response.json({ coins: [{ id: "bitcoin", symbol: "btc", name: "Bitcoin" }] });
    return new Response("introuvable", { status: 404 });
  };
  h.backend.close();
  h.backend = await testBackend({ fetcher });
}

describe("Obligations", () => {
  it("sans compte-titres, la page propose d'en créer un ; une ligne prévue n'a pas de lien d'achat", async () => {
    const user = userEvent.setup();
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    await rpc("bondPlans.upsert", { accountId: null, label: "À choisir", targetYear: 2034, nominal: 5_000, comment: "Échéance vers 2034" });
    show(<Obligations />);
    expect(await screen.findByText(/Les obligations se détiennent dans un compte-titres/)).toBeTruthy();
    expect(screen.getByText("Prochaine échéance").nextElementSibling?.textContent).toBe("—");
    const row = ligne("À choisir");
    expect(texte(row)).toContain("Échéance vers 2034");
    expect(texte(row)).toContain("vers 2034");
    expect(texte(row)).toContain("Prévue");
    expect(within(row).queryByTitle("Saisir l'achat")).toBeNull();
    // La ligne prévue se supprime.
    await user.click(within(row).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).bondPlans).toEqual([]));
    expect(await screen.findByText(/Aucune obligation\. Prévoyez vos achats/)).toBeTruthy();
  });

  it("échelle d'obligations : détenues, prévue, échue ; coupons, rendement, tri et évolution", async () => {
    const user = userEvent.setup();
    const courtier = await rpc<Id>("institutions.upsert", { name: "Courtier Fictif", kind: "courtier" });
    const cto = await compte("cto", "CTO obligations", { institutionId: courtier.id });
    const oat = await titre("obligation", "OAT 3 % mai 2033", { priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, bondKind: "etat", issuer: "République française", isin: "FR0099999991" });
    const societe = await titre("obligation", "Société Fictive 4,5 % septembre 2030", { priceSource: "modele", couponRate: 0.045, maturityDate: "2030-09-01", couponFrequency: 2, nextCouponDate: dansJours(40), bondKind: "entreprise", issuer: "Société Fictive" });
    const echue = await titre("obligation", "OAT 1 % mai 2023", { priceSource: "modele", couponRate: 0.01, maturityDate: "2023-05-25", couponFrequency: 1, bondKind: "etat", issuer: "République française" });
    await operation("2021-03-01", "versement", cto.id, 40_000);
    await operation("2021-03-02", "achat", cto.id, 2_900, { assetId: echue.id, quantity: 3_000 });
    await operation("2024-03-01", "achat", cto.id, 9_800, { assetId: oat.id, quantity: 10_000 });
    await operation("2024-03-02", "achat", cto.id, 5_100, { assetId: societe.id, quantity: 5_000 });
    await rpc("bondPlans.upsert", { accountId: cto.id, label: "Ligne longue", targetYear: 2036, nominal: 8_000, comment: "À choisir en 2026" });
    show(<Obligations />);

    expect(await screen.findByText("Nominal détenu")).toBeTruthy();
    expect(texte(screen.getByText("Nominal détenu").nextElementSibling)).toMatch(/15 ?000/);
    // Obligation détenue : nom, échéance et taux du coupon, sans sous-ligne (ni type, ni ISIN, ni date du prochain coupon).
    const rowOat = ligne("OAT 3 % mai 2033");
    expect(texte(rowOat)).toContain("Détenue");
    expect(texte(rowOat)).toMatch(/3,00 %/);
    expect(texte(rowOat)).not.toContain("FR0099999991");
    expect(texte(rowOat)).not.toMatch(/le 25\/05\/\d{4}/);
    // Échue : barrée, avec son état.
    const rowEchue = ligne("OAT 1 % mai 2023");
    expect(texte(rowEchue)).toContain("Échue");
    // Ligne prévue : lien vers la saisie de l'achat pré-rempli, et détail.
    const rowPlan = ligne("Ligne longue");
    expect(texte(rowPlan)).toContain("À choisir en 2026");
    expect(texte(rowPlan)).toContain("Prévue");
    expect(within(rowPlan).getByTitle("Saisir l'achat").getAttribute("href")).toBe(`/journal?nouveau=1&compte=${cto.id}&type=achat&titre=nouveau`);
    // Espèces en attente au-dessus du seuil : de quoi acheter une ligne.
    expect(screen.getByText("De quoi acheter une ligne")).toBeTruthy();
    expect(screen.getByText(/coupon le .* brut/)).toBeTruthy();
    expect(screen.getByText(/Valeur « détenue jusqu'à l'échéance »/)).toBeTruthy();
    // Acompte sur les coupons cette année : retenu par le courtier, réglable dans la page Impôts.
    expect(screen.getByText(/Acompte de 12,8 % sur les intérêts en \d{4}/).textContent).toMatch(/Courtier Fictif retenu/);

    // Tri de l'échelle.
    const tete = (nom: string) => within(screen.getAllByRole("table")[0]!).getByRole("columnheader", { name: new RegExp(`^${nom}$`) });
    const ordre = () => within(screen.getAllByRole("table")[0]!).getAllByRole("row").map((r) => texte(r)).filter((t) => /^(OAT 3|Société)/.test(t)).map((t) => t.slice(0, 3));
    expect(ordre()).toEqual(["Soc", "OAT"]);
    await user.click(within(tete("Échéance")).getByRole("button"));
    expect(ordre()).toEqual(["OAT", "Soc"]);
    for (const nom of ["Obligation", "Coupon", "Nominal", "Coût \\(frais compris\\)", "Valeur", "Plus-value \\(%\\)", "Rendement à l'échéance", "Âge à l'échéance", "Reste"]) {
      await user.click(within(tete(nom)).getByRole("button"));
      expect(ordre()).toHaveLength(2);
    }
    await user.click(within(ligne("OAT 3 % mai 2033")).getByRole("button", { name: /Afficher le détail/ }));
    expect(await screen.findByText(/L'évolution apparaîtra après un mois d'historique|Valeur totale :/)).toBeTruthy();
    // Ligne dépliée : prix d'achat, coupon couru, coupons perçus, performance cumulée, rendement net (ces deux derniers aussi en tuile).
    for (const t of ["Prix d'achat", "Coupon couru"]) expect(screen.getByText(t)).toBeTruthy();
    // Coupon annuel : 3 % de 10 000 € de nominal, un détachement par an.
    expect(texte(screen.getByText("Coupon annuel").parentElement)).toMatch(/300,00\s?€/);
    expect(screen.getByText("brut, 1 détachement par an")).toBeTruthy();
    expect(screen.getAllByText("Rendement net de fiscalité").length).toBe(2);
    expect(screen.getAllByText("Performance cumulée").length).toBe(2);
  });

  it("compte-titres mixte : seules ses obligations et leurs mouvements ; un compte-titres d'actions n'y figure pas", async () => {
    const mixte = await compte("cto", "CTO Trade Republic");
    const actions = await compte("cto", "CTO actions");
    const oat = await titre("obligation", "OAT 3 % mai 2033", { priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, bondKind: "etat", issuer: "République française" });
    const total = await titre("action", "TotalEnergies", { isin: "FR0000120271" });
    await operation("2024-01-05", "versement", mixte.id, 3_000);
    await operation("2024-03-01", "achat", mixte.id, 980, { assetId: oat.id, quantity: 1_000 });
    await operation("2024-03-02", "achat", mixte.id, 550, { assetId: total.id, quantity: 10 });
    await operation("2024-01-05", "versement", actions.id, 7_000);
    show(<Obligations />);

    // Espèces du seul compte qui détient des obligations : 3 000 − 980 − 550.
    expect(await screen.findByText("Espèces en attente")).toBeTruthy();
    expect(texte(screen.getByText("Espèces en attente").nextElementSibling)).toMatch(/1 ?470/);
    // Mouvements : l'achat de l'OAT, ni l'action ni les versements.
    const mouvements = texte(screen.getByRole("heading", { name: "Mouvements des obligations" }).closest("div")!.parentElement);
    expect(mouvements).toContain("OAT 3 % mai 2033");
    expect(mouvements).not.toContain("TotalEnergies");
    expect(mouvements).not.toContain("Versement");
  });

  it("chiffres et graphiques : coupons à saisir, impôts au survol, échelle avec l'âge en plan retraite", async () => {
    const cto = await compte("cto", "CTO obligations");
    const oat = await titre("obligation", "OAT 3 % mai 2033", { priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, bondKind: "etat", issuer: "République française" });
    const societe = await titre("obligation", "Société Fictive 4 % mars 2031", { priceSource: "modele", couponRate: 0.04, maturityDate: "2031-03-01", couponFrequency: 1, bondKind: "entreprise", issuer: "Société Fictive" });
    const echue = await titre("obligation", "OAT 1 % mai 2023", { priceSource: "modele", couponRate: 0.01, maturityDate: "2023-05-25", couponFrequency: 1, bondKind: "etat" });
    await operation("2021-03-01", "versement", cto.id, 40_000);
    await operation("2021-03-02", "achat", cto.id, 2_900, { assetId: echue.id, quantity: 3_000 });
    await operation("2022-05-25", "interets", cto.id, 30, { assetId: echue.id });
    await operation("2023-05-25", "interets", cto.id, 30, { assetId: echue.id });
    await operation("2024-05-26", "achat", cto.id, 9_600, { assetId: oat.id, quantity: 10_000 });
    await operation("2024-03-02", "achat", cto.id, 5_000, { assetId: societe.id, quantity: 5_000 });
    show(<Obligations />);

    expect(await screen.findByText("Rendement net de fiscalité")).toBeTruthy();
    // Au survol : fiscalité restant due, coupons et primes de remboursement séparés.
    const impots = screen.getByRole("tooltip");
    expect(texte(impots)).toMatch(/Sur les coupons/);
    expect(texte(impots)).toMatch(/Sur les primes de remboursement/);
    expect(screen.getByText("Flux à 12 mois")).toBeTruthy();
    expect(screen.getByText("Performance cumulée")).toBeTruthy();
    // Coupons des lignes en cours jamais saisis ; l'OAT échue a les siens (sauf celui de mai 2021).
    expect(texte(screen.getByText("Coupons perçus").parentElement)).toMatch(/coupons non saisis/);
    // Ligne échue : rendement réalisé, coupons perçus.
    expect(texte(ligne("OAT 1 % mai 2023"))).toMatch(/réalisé/);
    expect(texte(ligne("OAT 1 % mai 2023"))).toMatch(/de coupons perçus/);
    // Six graphiques ; l'échelle commence à l'année en cours, avec l'âge.
    const graphiques = screen.getAllByTestId("graphique");
    expect(graphiques).toHaveLength(6);
    const annee = new Date().getFullYear();
    expect(graphiques.some((g) => new RegExp(`${annee} · \\d+ ans`).test(g.getAttribute("data-infobulle") ?? ""))).toBe(true);
    expect(screen.getByText(/Premier émetteur/)).toBeTruthy();
  });

  it("gestion de patrimoine : ni colonne d'âge, ni âge sur l'échelle, ni conseil de sécurisation", async () => {
    const cto = await compte("cto", "CTO obligations");
    const oat = await titre("obligation", "OAT 3 % mai 2033", { priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, bondKind: "etat" });
    await operation("2024-03-01", "versement", cto.id, 20_000);
    await operation("2024-03-01", "achat", cto.id, 9_800, { assetId: oat.id, quantity: 10_000 });
    await rpc("bondPlans.upsert", { accountId: cto.id, label: "Ligne longue", targetYear: 2036, nominal: 8_000, comment: "" });
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, goal: "patrimoine" } });
    show(<Obligations />);

    expect(await screen.findByText("Nominal détenu")).toBeTruthy();
    const table = screen.getAllByRole("table")[0]!;
    expect(within(table).queryByRole("columnheader", { name: /Âge à l'échéance/ })).toBeNull();
    expect(texte(ligne("Ligne longue"))).not.toMatch(/\d+ ans/);
    expect(screen.queryByText(/âge de sécurisation/)).toBeNull();
    expect(screen.getAllByTestId("graphique").every((g) => !/ ans/.test(g.getAttribute("data-infobulle") ?? ""))).toBe(true);
  });

  it("prévoir un achat : le formulaire attend ses trois champs, puis ajoute la ligne", async () => {
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 100);
    show(<Obligations />);
    const ajouter = (await screen.findByRole("button", { name: "Ajouter" })) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
    await user.type(fieldOf("Libellé"), "Ligne à choisir");
    await user.type(fieldOf("Échéance visée"), "2035");
    expect(ajouter.disabled).toBe(true);
    await user.type(fieldOf("Nominal"), "6000");
    await user.click(ajouter);
    await waitFor(async () => expect((await workspace()).bondPlans).toMatchObject([{ label: "Ligne à choisir", targetYear: 2035, nominal: 6000, accountId: cto.id }]));
    // Le formulaire est vidé pour la ligne suivante.
    await waitFor(() => expect(fieldOf("Libellé").value).toBe(""));
    expect(texte(ligne("Ligne à choisir"))).toContain("vers 2035");
  });
});

describe("Nouveau titre à l'achat (NewAssetPanel)", () => {
  /** Ouvre « Nouvelle opération » depuis la page Obligations ou Actions, puis choisit « Nouveau titre ». */
  async function nouveauTitre(page: ReactNode, user: ReturnType<typeof userEvent.setup>, choix: RegExp) {
    show(page);
    await user.click(await screen.findByRole("button", { name: "Nouvelle opération" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouvelle opération" }));
    await user.selectOptions(dialog.getByLabelText("Titre"), dialog.getByRole("option", { name: choix }));
    return dialog;
  }

  it("compte-titres : mêmes choix que les autres comptes, sans obligation proposée d'office", () => {
    expect(choicesFor("cto")[0]).toMatchObject({ kind: "etf" });
    expect(choicesFor("cto").map((c) => c.label)).toEqual(["ETF", "ETC (matières premières)", "Action", "OAT (État)", "Obligation d'entreprise", "Fonds / OPCVM", "SCPI"]);
    expect(choicesFor("cto", ["obligation"])[0]).toMatchObject({ kind: "obligation", bondKind: "etat" });
  });

  it("OAT : le nom suit le coupon et l'échéance, les champs manquants sont listés, puis titre et achat sont créés", async () => {
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);

    // Seules les obligations sont proposées, l'OAT d'abord, avec l'émetteur déjà renseigné.
    expect(dialog.getByRole("button", { name: "OAT (État)" }).getAttribute("aria-pressed")).toBe("true");
    expect(dialog.queryByRole("button", { name: "ETF" })).toBeNull();
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("République française");
    // Enregistrer trop tôt affiche ce qui manque.
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await dialog.findByText(/Indiquez le taux du coupon\. Indiquez l'échéance\. Donnez un nom au titre\./)).toBeTruthy();
    expect(dialog.getByText("Généré automatiquement.")).toBeTruthy();

    await user.type(dialog.getByLabelText("Taux du coupon (nominal)"), "3");
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "2033-05" } });
    // Une OAT est remboursée le 25 du mois ; le nom est composé.
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("OAT 3 % mai 2033");
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "fr12");
    expect((dialog.getByLabelText("ISIN (facultatif)") as HTMLInputElement).value).toBe("FR12");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await dialog.findByText(/ISIN invalide \(12 caractères\)\./)).toBeTruthy();
    await user.clear(dialog.getByLabelText("ISIN (facultatif)"));
    await user.selectOptions(dialog.getByLabelText("Coupons"), "2");
    fireEvent.change(dialog.getByLabelText("Prochain coupon (facultatif)"), { target: { value: "2033-11-25" } });

    await user.type(dialog.getByLabelText("Nominal"), "10000");
    await user.type(dialog.getByLabelText("Prix (% du nominal)"), "98");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    // Le serveur refuse un prochain coupon postérieur à l'échéance : le message s'affiche et la fenêtre reste ouverte.
    expect(await screen.findByText("La date du prochain coupon doit précéder l'échéance.")).toBeTruthy();
    expect((await workspace()).assets).toEqual([]);
    fireEvent.change(dialog.getByLabelText("Prochain coupon (facultatif)"), { target: { value: "2032-11-25" } });
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).assets).toMatchObject([{ kind: "obligation", bondKind: "etat", issuer: "République française", name: "OAT 3 % mai 2033", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 2, nextCouponDate: "2032-11-25", priceSource: "modele", isin: null }]));
    const ws = await workspace();
    expect(ws.transactions.find((t: { type: string }) => t.type === "achat")).toMatchObject({ accountId: cto.id, assetId: ws.assets[0].id, quantity: 10_000 });
    expect((await screen.findAllByText("OAT 3 % mai 2033")).length).toBeGreaterThan(0);
  });

  it("obligation d'entreprise : l'émetteur est exigé et nomme le titre ; changer de type ajuste l'émetteur et le jour d'échéance", async () => {
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "2030-09" } });
    await user.type(dialog.getByLabelText("Taux du coupon (nominal)"), "4,5");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("OAT 4,5 % septembre 2030");
    // Passer à une obligation d'entreprise : l'émetteur de l'État est retiré, l'échéance passe au 1er du mois.
    await user.click(dialog.getByRole("button", { name: "Obligation d'entreprise" }));
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("");
    expect(dialog.getByLabelText("Émetteur").getAttribute("placeholder")).toBe("ex. TotalEnergies");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await dialog.findByText(/Indiquez l'émetteur\./)).toBeTruthy();
    await user.type(dialog.getByLabelText("Émetteur"), "Société Fictive");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Société Fictive 4,5 % septembre 2030");
    // Retour à l'OAT : l'émetteur de l'État revient.
    await user.click(dialog.getByRole("button", { name: "OAT (État)" }));
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("République française");
    await user.click(dialog.getByRole("button", { name: "Obligation d'entreprise" }));
    // Un nom saisi à la main n'est plus remplacé.
    await user.clear(dialog.getByLabelText("Nom"));
    await user.type(dialog.getByLabelText("Nom"), "Mon obligation");
    expect(dialog.queryByText("Généré automatiquement.")).toBeNull();
    await user.type(dialog.getByLabelText("Émetteur"), "Société Fictive");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Mon obligation");
  });

  it("une obligation déjà connue est reconnue : on peut la reprendre au lieu d'en créer une seconde", async () => {
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    await titre("obligation", "OAT 3 % mai 2033", { priceSource: "modele", couponRate: 0.03, maturityDate: "2033-05-25", couponFrequency: 1, bondKind: "etat", issuer: "République française" });
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    await user.type(dialog.getByLabelText("Taux du coupon (nominal)"), "3");
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "2033-05" } });
    expect(await dialog.findByText(/Déjà dans vos titres/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Utiliser ce titre" }));
    // Le panneau de création disparaît et le titre existant est choisi.
    expect(dialog.queryByText("Nouveau titre")).toBeNull();
    expect((dialog.getByLabelText("Titre") as HTMLSelectElement).selectedOptions[0]!.textContent).toMatch(/OAT 3 % mai 2033/);
  });

  it("recherche par ISIN : l'OAT trouvée remplit coupon, échéance et émetteur", async () => {
    await avecReseau();
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    const chercher = dialog.getByTitle("Rechercher et pré-remplir") as HTMLButtonElement;
    expect(chercher.disabled).toBe(true);
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "FR0099999991");
    await user.click(chercher);
    const resultat = await dialog.findByRole("button", { name: /FRTR 3 05\/25\/33/ });
    expect(texte(resultat)).toContain("Obligation");
    await user.click(resultat);
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("OAT 3 % mai 2033");
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("République française");
    expect((dialog.getByLabelText("Taux du coupon (nominal)") as HTMLInputElement).value).toMatch(/^3/);
    expect((dialog.getByLabelText("Échéance") as HTMLInputElement).value).toBe("2033-05");
    // La liste de résultats est refermée.
    expect(dialog.queryByRole("button", { name: /FRTR 3 05\/25\/33/ })).toBeNull();
  });

  it("recherche par ISIN : une obligation d'entreprise reprend l'émetteur trouvé ; un ISIN inconnu ne donne rien", async () => {
    await avecReseau();
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "FR0099999992");
    await user.click(dialog.getByTitle("Rechercher et pré-remplir"));
    await user.click(await dialog.findByRole("button", { name: /SOCF 4.5 09\/01\/30/ }));
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("Société Fictive SA");
    expect((dialog.getByLabelText("Échéance") as HTMLInputElement).value).toBe("2030-09");
    await user.clear(dialog.getByLabelText("ISIN (facultatif)"));
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "FR0000000000");
    await user.click(dialog.getByTitle("Rechercher et pré-remplir"));
    expect(await dialog.findByText("Aucun résultat : remplissez les champs à la main.")).toBeTruthy();
  });

  it("recherche avec un nom trop long : le refus du serveur est affiché au lieu d'être perdu", async () => {
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    fireEvent.change(dialog.getByLabelText("Nom"), { target: { value: "Obligation à très long nom ".repeat(4) } });
    await user.click(dialog.getByTitle("Rechercher et pré-remplir"));
    expect(await dialog.findByText("Entrée invalide")).toBeTruthy();
  });

  it("recherche en panne : le message du fournisseur est affiché", async () => {
    await avecReseau({ down: true });
    const user = userEvent.setup();
    const cto = await compte("cto", "CTO obligations");
    await operation("2024-01-05", "versement", cto.id, 20_000);
    const dialog = await nouveauTitre(<Obligations />, user, /Nouvelle obligation/);
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "FR0099999991");
    await user.click(dialog.getByTitle("Rechercher et pré-remplir"));
    expect(await dialog.findByText(/Réponse 500 de api\.openfigi\.com/)).toBeTruthy();
  });

  it("action ou ETF au PEA : la recherche par nom propose les actions seulement, et le titre créé suit sa source de cours", async () => {
    await avecReseau();
    const user = userEvent.setup();
    const pea = await compte("pea", "Mon PEA");
    await operation("2024-01-05", "apport_initial", pea.id, 5_000);
    const dialog = await nouveauTitre(<Actions />, user, /Nouveau titre/);
    // Dans un PEA : ETF, action et fonds, pas d'obligation.
    expect(dialog.getByRole("button", { name: "ETF" }).getAttribute("aria-pressed")).toBe("true");
    expect(dialog.getByRole("button", { name: "Action" })).toBeTruthy();
    expect(dialog.queryByRole("button", { name: "OAT (État)" })).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Action" }));
    await user.type(dialog.getByLabelText("Nom"), "fictive");
    await user.click(dialog.getByTitle("Rechercher et pré-remplir"));
    // OpenFIGI et Euronext répondent ; le bitcoin de CoinGecko n'est pas proposé dans un PEA.
    const choix = await dialog.findAllByRole("button", { name: /Société Fictive|SOCIÉTÉ FICTIVE/i });
    expect(choix.length).toBeGreaterThan(0);
    expect(dialog.queryByRole("button", { name: /Bitcoin/ })).toBeNull();
    await user.click(choix[0]!);
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toMatch(/Société Fictive|SOCIÉTÉ FICTIVE/i);
    await user.type(dialog.getByLabelText("Quantité"), "10");
    await user.type(dialog.getByLabelText("Prix par unité"), "50");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).assets).toMatchObject([{ kind: "action", priceSource: "auto" }]));
    expect((await workspace()).transactions.find((t: { type: string }) => t.type === "achat")).toMatchObject({ accountId: pea.id, quantity: 10 });
  });

  it("titre sans ISIN ni symbole : cours saisi à la main ; ISIN saisi en minuscules : cours automatique", async () => {
    const user = userEvent.setup();
    const pea = await compte("pea", "Mon PEA");
    await operation("2024-01-05", "apport_initial", pea.id, 5_000);
    const dialog = await nouveauTitre(<Actions />, user, /Nouveau titre/);
    await user.type(dialog.getByLabelText("Nom"), "ETF sans code");
    await user.type(dialog.getByLabelText("Quantité"), "4");
    await user.type(dialog.getByLabelText("Prix par unité"), "25");
    await user.click(dialog.getByRole("button", { name: "Enregistrer et saisir une autre" }));
    await waitFor(async () => expect((await workspace()).assets).toMatchObject([{ name: "ETF sans code", isin: null, priceSource: "manuel" }]));
    // « Enregistrer et saisir une autre » garde la fenêtre ouverte, sur le titre créé.
    expect(await screen.findByRole("dialog", { name: "Nouvelle opération" })).toBeTruthy();
    await user.selectOptions(within(screen.getByRole("dialog")).getByLabelText("Titre"), within(screen.getByRole("dialog")).getByRole("option", { name: /Nouveau titre/ }));
    const panneau = within(screen.getByRole("dialog"));
    await user.type(panneau.getByLabelText("Nom"), "ETF avec ISIN");
    await user.type(panneau.getByLabelText("ISIN (facultatif)"), "ie00b4l5y983");
    expect((panneau.getByLabelText("ISIN (facultatif)") as HTMLInputElement).value).toBe("IE00B4L5Y983");
    await user.type(panneau.getByLabelText("Quantité"), "2");
    await user.type(panneau.getByLabelText("Prix par unité"), "40");
    await user.click(panneau.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).assets.map((a: { name: string; priceSource: string; isin: string | null }) => [a.name, a.priceSource, a.isin]).sort()).toEqual([["ETF avec ISIN", "auto", "IE00B4L5Y983"], ["ETF sans code", "manuel", null]]));
  });

  it("ETF déjà détenu : la création d'un titre au même ISIN propose de le reprendre", async () => {
    const user = userEvent.setup();
    const pea = await compte("pea", "Mon PEA");
    await operation("2024-01-05", "apport_initial", pea.id, 5_000);
    await titre("etf", "ETF existant", { isin: "IE00B4L5Y983" });
    const dialog = await nouveauTitre(<Actions />, user, /Nouveau titre/);
    await user.type(dialog.getByLabelText("ISIN (facultatif)"), "IE00B4L5Y983");
    expect(await dialog.findByText(/Déjà dans vos titres/)).toBeTruthy();
    expect(dialog.getByText("ETF existant")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Utiliser ce titre" }));
    expect((dialog.getByLabelText("Titre") as HTMLSelectElement).selectedOptions[0]!.textContent).toMatch(/ETF existant/);
  });
});


/** Une classe d'actifs créée par l'utilisateur (Paramètres › Répartition), à 0 % de cible. */
async function classeUtilisateur(label: string) {
  const ws = await workspace();
  const id = crypto.randomUUID();
  await rpc("params.update", { ...ws.params, customClasses: [...ws.params.customClasses, { id, label, color: "#2a8a86" }], targets: [...ws.params.targets, { key: id, inAllocation: true, target: 0, expectedReturn: null }] });
  return id;
}

describe("Autres biens", () => {
  it("sans bien : le tableau est vide, les sources de l'impôt à la vente sont citées", async () => {
    show(<AutresBiens />);
    expect(await screen.findByText(/Aucun bien\. Ajoutez vos pièces d'or/)).toBeTruthy();
    expect(screen.getByText(/Impôt à la vente : règles vérifiées le/)).toBeTruthy();
    expect(document.querySelectorAll('a[href^="http"][target="_blank"]').length).toBeGreaterThan(0);
  });

  it("tableau des biens : type, part, estimation, vente rapide et impôt ; détail par régime et estimations", async () => {
    const user = userEvent.setup();
    const or = await rpc<Id>("otherAssets.upsert", { kind: "metal", name: "Pièces d'or", value: 5_000, valueDate: "2025-06-01", purchasePrice: 3_000, purchaseDate: "2015-06-01", quickSaleDiscount: 0.05, saleDelayMonths: 0, comment: "Dans le coffre" });
    await rpc("otherAssets.upsert", { kind: "vehicule", name: "Voiture", value: 12_000, valueDate: "2025-01-01", depreciation: 0.15, quickSaleDiscount: 0.15, saleDelayMonths: 1 });
    await rpc("otherAssets.upsert", { kind: "societe", name: "Parts de société", value: 40_000, share: 0.5, quickSaleDiscount: 0.3, saleDelayMonths: 12, purchasePrice: 10_000, purchaseDate: "2018-01-01" });
    await rpc("otherAssets.upsert", { kind: "pret", name: "Prêt à un proche", value: 0, loanPrincipal: 5_000, loanRate: 0.02, loanTermMonths: 24, loanFirstPayment: "2025-01-05" });
    await rpc("otherAssets.upsert", { kind: "compte_courant", name: "Compte courant d'associé", value: 2_000, saleDelayMonths: 12 });
    await rpc("otherAssets.upsert", { kind: "objet", name: "Tableau vendu", value: 900, archived: true });
    show(<AutresBiens />);

    expect(await screen.findAllByText("Valeur détenue")).toBeTruthy();
    expect(screen.getByText("En cas de vente rapide")).toBeTruthy();
    expect(screen.getByText("Impôt si tout était vendu")).toBeTruthy();
    const rowOr = ligne("Pièces d'or");
    expect(texte(rowOr)).toContain("estimé le 01/06/2025");
    expect(texte(rowOr)).toContain("immédiat");
    expect(texte(ligne("Voiture"))).toContain("1 mois");
    expect(texte(ligne("Prêt à un proche"))).toContain("selon l'échéancier");
    // Un bien archivé reste listé, sans impôt estimé.
    expect(texte(ligne("Tableau vendu"))).toContain("—");
    expect(texte(ligne("Parts de société"))).toMatch(/50 %/);

    // Détail : impôt si vendu aujourd'hui, par régime.
    await user.click(within(rowOr).getByRole("button", { name: /Afficher le détail : Pièces d'or/ }));
    expect(await screen.findByText("Impôt si vendu aujourd'hui")).toBeTruthy();
    expect(screen.getByText("Dans le coffre")).toBeTruthy();
    expect(screen.getByText(/\(actuelle\)/)).toBeTruthy();
    expect(screen.getByText("le plus avantageux")).toBeTruthy();

    // Estimations : le bouton attend une valeur ; l'estimation ajoutée devient la valeur du bien, puis se supprime.
    const ajouter = screen.getByRole("button", { name: "Ajouter l'estimation" }) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
    fireEvent.change(fieldOf("Date"), { target: { value: "2026-03-01" } });
    await user.type(fieldOf("Valeur du bien entier"), "6000");
    await user.click(ajouter);
    // La plus récente devient la valeur du bien ; l'ancienne passe dans l'historique, d'où elle se supprime.
    expect(await screen.findByText("Estimation enregistrée")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).otherAssets.find((a: Id) => a.id === or.id)).toMatchObject({ value: 6000, valueDate: "2026-03-01" }));
    const suppr = await screen.findByRole("button", { name: "Supprimer l'estimation du 01/06/2025" });
    await waitFor(() => expect(fieldOf("Valeur du bien entier").value).toBe(""));
    await user.click(suppr);
    await waitFor(async () => expect((await workspace()).otherAssetValues).toEqual([]));
    expect(await screen.findByText("Estimation supprimée")).toBeTruthy();
    // Un clic sur la ligne la referme.
    await user.click(within(rowOr).getByRole("button", { name: /Masquer le détail : Pièces d'or/ }));
    expect(screen.queryByText("Impôt si vendu aujourd'hui")).toBeNull();
  });

  it("détail d'un prêt à échéancier : pas d'estimations à saisir ; d'un bien archivé : pas d'impôt", async () => {
    const user = userEvent.setup();
    await rpc("otherAssets.upsert", { kind: "pret", name: "Prêt à un proche", value: 0, loanPrincipal: 5_000, loanRate: 0.02, loanTermMonths: 24, loanFirstPayment: "2025-01-05" });
    await rpc("otherAssets.upsert", { kind: "objet", name: "Tableau vendu", value: 900, archived: true });
    show(<AutresBiens />);
    await user.click(within(await screen.findByText("Prêt à un proche").then((x) => x.closest("tr") as HTMLElement)).getByRole("button", { name: /Afficher le détail/ }));
    expect(await screen.findByText("Impôt si vendu aujourd'hui")).toBeTruthy();
    expect(screen.queryByText("Estimations")).toBeNull();
    await user.click(within(ligne("Tableau vendu")).getByRole("button", { name: /Afficher le détail/ }));
    expect(await screen.findByText("Bien archivé.")).toBeTruthy();
  });

  it("suppression : confirmée, le bien disparaît ; refusée, il reste", async () => {
    const user = userEvent.setup();
    await rpc("otherAssets.upsert", { kind: "objet", name: "Tableau", value: 900 });
    show(<AutresBiens />);
    h.confirm = false;
    await user.click(within(await screen.findByText("Tableau").then((x) => x.closest("tr") as HTMLElement)).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).otherAssets).toHaveLength(1);
    h.confirm = true;
    await user.click(within(ligne("Tableau")).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).otherAssets).toEqual([]));
    expect(await screen.findByText(/Aucun bien\./)).toBeTruthy();
  });

  it("nouveau bien : or avec décote et délai habituels, enregistré avec son prix d'achat", async () => {
    const user = userEvent.setup();
    show(<AutresBiens />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    const ajouter = dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(ajouter.disabled).toBe(true);
    // L'or propose 5 % de décote et une vente immédiate.
    expect((dialog.getByLabelText("Décote en cas de vente rapide") as HTMLInputElement).value).toBe("5");
    expect((dialog.getByLabelText("Délai pour vendre ou récupérer l'argent (mois)") as HTMLInputElement).value).toBe("0");
    await user.type(dialog.getByLabelText("Nom"), "Pièces d'or");
    await user.type(dialog.getByLabelText("Valeur estimée"), "5000");
    await user.type(dialog.getByLabelText("Prix d'achat"), "3000");
    fireEvent.change(dialog.getByLabelText("Date d'achat"), { target: { value: "2016-04-01" } });
    // La part détenue reste entre 1 % et 100 %.
    const part = dialog.getByLabelText("Part détenue") as HTMLInputElement;
    await user.clear(part);
    await user.type(part, "50");
    await user.type(dialog.getByLabelText("Commentaire"), "Au coffre");
    expect(ajouter.disabled).toBe(false);
    await user.click(ajouter);
    await waitFor(async () => expect((await workspace()).otherAssets).toMatchObject([{ kind: "metal", name: "Pièces d'or", value: 5000, purchasePrice: 3000, purchaseDate: "2016-04-01", share: 0.5, quickSaleDiscount: 0.05, saleDelayMonths: 0, comment: "Au coffre", archived: false }]));
    expect(await screen.findByText("Pièces d'or")).toBeTruthy();
  });

  it("le type propose ses réglages : véhicule (baisse de valeur), prêt à échéancier (somme calculée), parts de société (démembrement)", async () => {
    const user = userEvent.setup();
    show(<AutresBiens />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    await user.selectOptions(dialog.getByLabelText("Type"), "vehicule");
    expect((dialog.getByLabelText("Baisse de valeur par an") as HTMLInputElement).value).toBe("15");
    expect(dialog.getByText("Une voiture perd souvent 15 % par an.")).toBeTruthy();
    expect((dialog.getByLabelText("Délai pour vendre ou récupérer l'argent (mois)") as HTMLInputElement).value).toBe("1");

    await user.selectOptions(dialog.getByLabelText("Type"), "pret");
    expect(dialog.getByText(/Échéancier \(facultatif\)/)).toBeTruthy();
    expect(dialog.getByLabelText("Somme encore due")).toBeTruthy();
    expect(dialog.queryByLabelText("Baisse de valeur par an")).toBeNull();
    // Un échéancier complet remplace la saisie de la somme due.
    await user.type(dialog.getByLabelText("Somme prêtée"), "5000");
    await user.type(dialog.getByLabelText("Taux annuel"), "2");
    await user.type(dialog.getByLabelText("Durée (mois)"), "24");
    expect(dialog.getByLabelText("Somme encore due")).toBeTruthy();
    fireEvent.change(dialog.getByLabelText("Première échéance"), { target: { value: "2025-02-05" } });
    expect(dialog.queryByLabelText("Somme encore due")).toBeNull();
    await user.type(dialog.getByLabelText("Nom"), "Prêt à un proche");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).otherAssets).toMatchObject([{ kind: "pret", loanPrincipal: 5000, loanRate: 0.02, loanTermMonths: 24, loanFirstPayment: "2025-02-05" }]));
    expect(await screen.findByText(/selon l'échéancier/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Nouveau bien" }));
    const second = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    await user.selectOptions(second.getByLabelText("Type"), "societe");
    await user.type(second.getByLabelText("Nom"), "Parts de société");
    // Démembrement : il faut de quoi évaluer l'usufruit avant d'enregistrer.
    await user.selectOptions(second.getByLabelText("Droit détenu"), "nue_propriete");
    expect((second.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(second.getByLabelText("Naissance de l'usufruitier"), { target: { value: "1950-01-01" } });
    expect((second.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(false);
    // Revenir à un autre type remet la pleine propriété.
    await user.selectOptions(second.getByLabelText("Type"), "objet");
    expect(second.queryByLabelText("Droit détenu")).toBeNull();
  });

  it("classe d'actifs : le bien peut être rattaché à une classe, dans ou hors de l'allocation", async () => {
    const user = userEvent.setup();
    const classe = await classeUtilisateur("Métaux précieux");
    show(<AutresBiens />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    expect(dialog.queryByLabelText("Allocation cible")).toBeNull();
    await user.type(dialog.getByLabelText("Nom"), "Lingot");
    await user.selectOptions(await dialog.findByLabelText("Classe d'actifs"), classe);
    await user.selectOptions(dialog.getByLabelText("Allocation cible"), "out");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).otherAssets).toMatchObject([{ name: "Lingot", classId: classe, inAllocation: false }]));
  });

  it("modification : le bien se corrige, puis s'archive ; changer le type garde les réglages existants", async () => {
    const user = userEvent.setup();
    const bien = await rpc<Id>("otherAssets.upsert", { kind: "metal", name: "Pièces d'or", value: 5_000, quickSaleDiscount: 0.05, saleDelayMonths: 0 });
    show(<AutresBiens />);
    await user.click(within(await screen.findByText("Pièces d'or").then((x) => x.closest("tr") as HTMLElement)).getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bien" }));
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Pièces d'or");
    await user.selectOptions(dialog.getByLabelText("Type"), "objet");
    // À la modification, le type ne remplace pas la décote déjà réglée.
    expect((dialog.getByLabelText("Décote en cas de vente rapide") as HTMLInputElement).value).toBe("5");
    await user.clear(dialog.getByLabelText("Nom"));
    await user.type(dialog.getByLabelText("Nom"), "Bijoux");
    await user.click(dialog.getByLabelText(/Archivé : ne compte plus/));
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).otherAssets).toMatchObject([{ id: bien.id, kind: "objet", name: "Bijoux", archived: true }]));
  });

  it("Annuler ferme la fenêtre sans rien enregistrer", async () => {
    const user = userEvent.setup();
    show(<AutresBiens />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    await user.type(dialog.getByLabelText("Nom"), "Brouillon");
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await workspace()).otherAssets).toEqual([]);
  });
});

describe("Fiche d'un titre (AssetDialog)", () => {
  const ouvrir = (props: { asset?: Parameters<typeof AssetDialog>[0]["asset"]; defaultKind?: Parameters<typeof AssetDialog>[0]["defaultKind"] } = {}, onClose = vi.fn()) => {
    show(<AssetDialog open onClose={onClose} {...props} />);
    return { onClose, dialog: within(screen.getByRole("dialog")) };
  };

  it("ETF : ISIN en majuscules, symbole, fournisseur sur adresse JSON ; les réglages inutiles sont écartés à l'enregistrement", async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = ouvrir();
    expect(dialog.getByText("Nouveau titre", { selector: "h2, h3, [id]" })).toBeTruthy();
    const enregistrer = dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(enregistrer.disabled).toBe(true);
    await user.type(dialog.getByLabelText("Nom"), "Mon ETF");
    await user.type(dialog.getByLabelText("ISIN"), "ie00b4l5y983");
    expect((dialog.getByLabelText("ISIN") as HTMLInputElement).value).toBe("IE00B4L5Y983");
    expect(enregistrer.disabled).toBe(false);
    // Cours automatique : symbole et fournisseur, dont « Adresse (JSON) » qui demande chemin et adresse.
    await user.type(dialog.getByLabelText("Symbole chez le fournisseur"), "MONETF.PA");
    expect(dialog.queryByLabelText("Adresse (JSON)")).toBeNull();
    const fournisseurs = within(dialog.getByLabelText("Fournisseur")).getAllByRole("option").map((o) => o.textContent);
    expect(fournisseurs).toHaveLength(6);
    await user.selectOptions(dialog.getByLabelText("Fournisseur"), "url");
    // (fireEvent : « {isin} » serait lu comme une touche par la saisie clavier.)
    fireEvent.change(dialog.getByLabelText("Adresse (JSON)"), { target: { value: "  https://exemple.fr/cours/{isin}  " } });
    await user.type(dialog.getByLabelText("Chemin du prix dans la réponse"), " data.0.close ");
    await user.type(dialog.getByLabelText("Part cible parmi les actions"), "40");
    await user.type(dialog.getByLabelText("Frais de gestion annuels (TER)"), "0,2");
    await user.click(enregistrer);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).assets).toMatchObject([{ kind: "etf", name: "Mon ETF", isin: "IE00B4L5Y983", symbol: "MONETF.PA", priceSource: "auto", priceProvider: "url", priceUrl: "https://exemple.fr/cours/{isin}", pricePath: "data.0.close", targetWeight: 0.4, ter: 0.002 }]);
  });

  it("source « saisi à la main » : le cours daté d'aujourd'hui est enregistré, sans fournisseur ni adresse", async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = ouvrir();
    await user.type(dialog.getByLabelText("Nom"), "Fonds maison");
    await user.selectOptions(dialog.getByLabelText("Fournisseur"), "url");
    await user.selectOptions(dialog.getByLabelText("Source du cours"), "manuel");
    expect(dialog.queryByLabelText("Fournisseur")).toBeNull();
    const cours = dialog.getByLabelText("Cours");
    await user.type(cours, "12,5");
    await user.clear(cours);
    await user.type(cours, "25");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).assets).toMatchObject([{ name: "Fonds maison", priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, manualPrice: 25, manualPriceDate: todayIso() }]);
  });

  it("le type change les champs : obligation (calculée), SCPI (à la main seulement), crypto et action (fournisseurs adaptés)", async () => {
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    await user.selectOptions(dialog.getByLabelText("Type"), "action");
    expect(within(dialog.getByLabelText("Fournisseur")).getAllByRole("option").map((o) => o.textContent)).toHaveLength(5);
    await user.selectOptions(dialog.getByLabelText("Type"), "crypto");
    expect(dialog.getByText("Identifiant CoinGecko, ex. bitcoin.")).toBeTruthy();
    expect(dialog.queryByLabelText("Part cible parmi les actions")).toBeNull();
    expect(within(dialog.getByLabelText("Fournisseur")).getAllByRole("option")).toHaveLength(3);
    await user.selectOptions(dialog.getByLabelText("Type"), "scpi");
    expect(within(dialog.getByLabelText("Source du cours")).getAllByRole("option")).toHaveLength(1);
    expect(dialog.getByLabelText("Cours")).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Type"), "obligation");
    expect(within(dialog.getByLabelText("Source du cours")).getAllByRole("option")).toHaveLength(2);
    expect(dialog.getByText(/Valeur calculée : prix d'achat amorti/)).toBeTruthy();
    expect(dialog.queryByLabelText("Part cible parmi les actions")).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Source du cours"), "manuel");
    expect(dialog.getByLabelText("Cours (% du nominal)")).toBeTruthy();
  });

  it("obligation : type État ou entreprise, échéance au 25 ou au 1er, émetteur et coupons enregistrés", async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = ouvrir({ defaultKind: "obligation" });
    expect((dialog.getByLabelText("Type d'obligation") as HTMLSelectElement).value).toBe("etat");
    await user.type(dialog.getByLabelText("Nom"), "Obligation fictive");
    await user.type(dialog.getByLabelText("Coupon annuel"), "4");
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "2031-03" } });
    await user.type(dialog.getByLabelText("Émetteur"), "République française");
    // Passer à une obligation d'entreprise retire l'émetteur de l'État et ramène l'échéance au 1er du mois.
    await user.selectOptions(dialog.getByLabelText("Type d'obligation"), "entreprise");
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("");
    expect(dialog.getByText("Mois et année.")).toBeTruthy();
    await user.type(dialog.getByLabelText("Émetteur"), "Société Fictive");
    await user.selectOptions(dialog.getByLabelText("Type d'obligation"), "etat");
    // Retour à l'État : l'émetteur saisi est gardé, l'échéance revient au 25.
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toBe("Société Fictive");
    await user.selectOptions(dialog.getByLabelText("Type d'obligation"), "entreprise");
    await user.selectOptions(dialog.getByLabelText("Coupons"), "4");
    fireEvent.change(dialog.getByLabelText("Prochain coupon (facultatif)"), { target: { value: "2026-12-01" } });
    // Vider l'échéance l'efface.
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "" } });
    fireEvent.change(dialog.getByLabelText("Échéance"), { target: { value: "2031-03" } });
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).assets).toMatchObject([{ kind: "obligation", bondKind: "entreprise", issuer: "Société Fictive", couponRate: 0.04, maturityDate: "2031-03-01", couponFrequency: 4, nextCouponDate: "2026-12-01", priceSource: "modele" }]);
  });

  it("modification : titre pré-rempli sans recherche, classe d'actifs et allocation choisies", async () => {
    const user = userEvent.setup();
    const classe = await classeUtilisateur("Métaux précieux");
    const etf = await titre("etf", "ETF existant", { isin: "IE00B4L5Y983", targetWeight: 0.5 });
    const ws = await workspace();
    const asset = ws.assets.find((a: Id) => a.id === etf.id);
    const { onClose, dialog } = ouvrir({ asset });
    expect(dialog.getByText("Modifier « ETF existant »")).toBeTruthy();
    expect(dialog.queryByPlaceholderText(/Rechercher par nom ou ISIN/)).toBeNull();
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("ETF existant");
    await user.selectOptions(await dialog.findByLabelText("Classe d'actifs"), classe);
    await user.selectOptions(dialog.getByLabelText("Allocation cible"), "in");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).assets.find((a: Id) => a.id === etf.id)).toMatchObject({ classId: classe, inAllocation: true, targetWeight: 0.5 });
  });

  it("une erreur du serveur (ISIN invalide) est affichée et la fenêtre reste ouverte", async () => {
    const user = userEvent.setup();
    const { onClose, dialog } = ouvrir();
    await user.type(dialog.getByLabelText("Nom"), "ETF");
    await user.type(dialog.getByLabelText("ISIN"), "XX");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Entrée invalide")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect((await workspace()).assets).toEqual([]);
  });

  it("recherche : l'action trouvée remplit nom, symbole et source ; un ETF reprend son ISIN", async () => {
    await avecReseau();
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    const recherche = dialog.getByPlaceholderText(/Rechercher par nom ou ISIN/);
    const bouton = dialog.getByRole("button", { name: "Rechercher" }) as HTMLButtonElement;
    expect(bouton.disabled).toBe(true);
    await user.type(recherche, "fictive");
    expect(bouton.disabled).toBe(false);
    await user.click(bouton);
    // Euronext, OpenFIGI et CoinGecko répondent : action cotée à Paris et crypto.
    expect(await dialog.findByRole("button", { name: /Bitcoin/ })).toBeTruthy();
    const action = await dialog.findAllByRole("button", { name: /Société Fictive/i });
    await user.click(action[0]!);
    expect(dialog.queryByRole("button", { name: /Bitcoin/ })).toBeNull();
    // « SOCIÉTÉ FICTIVE » (tout en majuscules) est remis en casse de titre.
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Société Fictive");
    expect((dialog.getByLabelText("Type") as HTMLSelectElement).value).toBe("action");
    expect((dialog.getByLabelText("Symbole chez le fournisseur") as HTMLInputElement).value).toMatch(/^SOCF/);
    expect((dialog.getByLabelText("Source du cours") as HTMLSelectElement).value).toBe("auto");
  });

  it("recherche d'un ISIN : obligation d'État calculée, action sans symbole saisie à la main, crypto par identifiant", async () => {
    await avecReseau();
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    const recherche = dialog.getByPlaceholderText(/Rechercher par nom ou ISIN/);
    await user.type(recherche, "FR0099999991{Enter}");
    await user.click(await dialog.findByRole("button", { name: /FRTR 3 05\/25\/33/ }));
    expect((dialog.getByLabelText("Type") as HTMLSelectElement).value).toBe("obligation");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("FRTR 3 05/25/33");
    expect((dialog.getByLabelText("Échéance") as HTMLInputElement).value).toBe("2033-05");
    expect((dialog.getByLabelText("Source du cours") as HTMLSelectElement).value).toBe("modele");
    expect((dialog.getByLabelText("Émetteur") as HTMLInputElement).value).toMatch(/FRANCE/);
    expect((dialog.getByLabelText("ISIN") as HTMLInputElement).value).toBe("FR0099999991");

    await user.clear(recherche);
    await user.type(recherche, "bitcoin");
    await user.click(dialog.getByRole("button", { name: "Rechercher" }));
    await user.click(await dialog.findByRole("button", { name: /Bitcoin/ }));
    expect((dialog.getByLabelText("Type") as HTMLSelectElement).value).toBe("crypto");
    expect((dialog.getByLabelText("Symbole chez le fournisseur") as HTMLInputElement).value).toBe("bitcoin");
  });

  it("recherche sans résultat ou en panne : le message explique, la fiche reste à remplir à la main", async () => {
    await avecReseau({ down: true });
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    await user.type(dialog.getByPlaceholderText(/Rechercher par nom ou ISIN/), "introuvable");
    await user.click(dialog.getByRole("button", { name: "Rechercher" }));
    expect(await dialog.findByText(/Euronext : .*CoinGecko : .*OpenFIGI : /)).toBeTruthy();
    expect(dialog.getByText("Aucun résultat : remplissez la fiche à la main.")).toBeTruthy();
  });

  it("recherche refusée par le serveur (texte trop long) : le message s'affiche", async () => {
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    fireEvent.change(dialog.getByPlaceholderText(/Rechercher par nom ou ISIN/), { target: { value: "x".repeat(90) } });
    await user.click(dialog.getByRole("button", { name: "Rechercher" }));
    expect(await dialog.findByText("Entrée invalide")).toBeTruthy();
    expect(dialog.getByText("Aucun résultat : remplissez la fiche à la main.")).toBeTruthy();
  });

  it("changer de type garde le nom et l'ISIN saisis", async () => {
    const user = userEvent.setup();
    const { dialog } = ouvrir();
    await user.type(dialog.getByLabelText("Nom"), "Mon titre");
    await user.type(dialog.getByLabelText("ISIN"), "FR0000120271");
    await user.selectOptions(dialog.getByLabelText("Type"), "action");
    expect((dialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Mon titre");
    expect((dialog.getByLabelText("ISIN") as HTMLInputElement).value).toBe("FR0000120271");
  });
});

describe("Allocations personnalisées", () => {
  const regle = (id: string, extra: Record<string, unknown> = {}) => ({ id, label: "", target: { kind: "type", accountKind: "livret" }, share: 0.2, limit: null, overflowTo: null, ...extra });

  it("une ligne sur un compte précis, avec limite et destination, est transmise telle quelle", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal");
    await compte("livret", "Ancien livret", { livretType: "AUTRE", archived: true });
    const onSave = vi.fn();
    const onClose = vi.fn();
    const ws = await workspace();
    const autre = regle("autre", { label: "Livrets de précaution" });
    show(<AllocationDialog open rule={null} rules={[autre] as never} accounts={ws.accounts} onClose={onClose} onSave={onSave} />);
    const dialog = within(screen.getByRole("dialog", { name: "Nouvelle allocation" }));
    // Les comptes archivés ne sont pas proposés.
    const cibles = within(dialog.getByLabelText("Vise")).getAllByRole("option").map((o) => o.textContent);
    expect(cibles).toContain("Contrat principal");
    expect(cibles).not.toContain("Ancien livret");
    await user.selectOptions(dialog.getByLabelText("Vise"), `compte:${av.id}`);
    await user.type(dialog.getByLabelText("Nom (facultatif)"), "Mon contrat");
    const part = dialog.getByLabelText("Part");
    await user.clear(part);
    await user.type(part, "30");
    // La limite ouvre le montant (10 000 € proposés) et la destination.
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "verse");
    const montant = dialog.getByLabelText("Montant versé à atteindre") as HTMLInputElement;
    expect(montant.value).toMatch(/^10.?000/);
    await user.clear(montant);
    await user.type(montant, "15000");
    await user.selectOptions(dialog.getByLabelText("Ensuite, la part va"), "autre");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({ label: "Mon contrat", target: { kind: "compte", accountId: av.id }, share: 0.3, limit: { basis: "verse", amount: 15_000 }, overflowTo: "autre" });
    expect(onClose).toHaveBeenCalled();
  });

  it("limite sur la valeur : libellés adaptés ; une limite à zéro, ou des parts au-delà de 100 %, sont refusées avec la raison", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    show(<AllocationDialog open rule={null} rules={[regle("a", { share: 0.9 }), regle("b", { share: 0.05 })] as never} accounts={[]} onClose={() => undefined} onSave={onSave} />);
    const dialog = within(screen.getByRole("dialog"));
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "valeur");
    expect(dialog.getByLabelText("Valeur à atteindre")).toBeTruthy();
    expect(dialog.getByText("Valeur actuelle, intérêts et plus-values compris.")).toBeTruthy();
    // 90 % + 5 % + 20 % = 115 % : refusé.
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(await dialog.findByText(/dépassent 100 %/)).toBeTruthy();
    const part = dialog.getByLabelText("Part");
    await user.clear(part);
    await user.type(part, "5");
    await user.clear(dialog.getByLabelText("Valeur à atteindre"));
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(await dialog.findByText(/Indiquez le montant de la limite/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    // Retirer la limite remet l'option « sans fin ».
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "");
    expect(dialog.queryByLabelText("Valeur à atteindre")).toBeNull();
  });

  it("modification d'une ligne : titre et bouton adaptés, destination retirée avec la limite", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const modifiee = regle("a", { label: "Livrets", limit: { basis: "verse", amount: 5_000 }, overflowTo: "b" });
    show(<AllocationDialog open rule={modifiee as never} rules={[modifiee, regle("b", { label: "Assurance-vie", target: { kind: "type", accountKind: "assurance_vie" } })] as never} accounts={[]} onClose={() => undefined} onSave={onSave} />);
    const dialog = within(screen.getByRole("dialog", { name: "Modifier l'allocation" }));
    // La ligne modifiée n'est pas proposée comme destination d'elle-même.
    expect(within(dialog.getByLabelText("Ensuite, la part va")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Aux autres lignes, au prorata", "À « Assurance-vie »"]);
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "");
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    expect(onSave.mock.calls[0]![0]).toMatchObject({ id: "a", limit: null, overflowTo: null });
  });
});

describe("Ma répartition cible et allocations dans Paramètres", () => {
  it("rendement attendu d'une classe, d'une classe personnalisée, couleur, retrait et case « Inclus »", async () => {
    const user = userEvent.setup();
    const livret = await compte("livret", "Livret A", { livretType: "LIVRET_A", rate: 0.03 });
    await operation("2025-01-05", "apport_initial", livret.id, 1_000);
    show(<Parametres />);
    await user.click(await screen.findByRole("tab", { name: "Répartition" }));
    // Le taux moyen des livrets sert de repère pour la classe Précaution.
    expect(await screen.findByText(/Moyenne actuelle : 3 %/)).toBeTruthy();
    // Une classe fixe : le rendement va dans les hypothèses du plan.
    const champ = await screen.findByLabelText("Rendement attendu de Livrets");
    await user.clear(champ);
    await user.type(champ, "2,5");

    await user.click(screen.getByRole("button", { name: "Ajouter une classe" }));
    const nom = await screen.findByLabelText("Nom de la classe");
    await user.type(nom, "Or physique");
    fireEvent.change(screen.getByLabelText("Couleur de Or physique"), { target: { value: "#aa3322" } });
    const rendementClasse = screen.getByLabelText("Rendement attendu de Or physique");
    await user.type(rendementClasse, "3");
    // La répartition ne peut pas dépasser 100 % : 10 points passent des actions à la nouvelle classe.
    const actions = fieldOf("Cible de Actions");
    const avant = Number(actions.value.replace(",", "."));
    await user.clear(actions);
    await user.type(actions, String(avant - 10));
    await user.type(screen.getByLabelText("Cible de Or physique"), "10");
    // Décocher « Inclus » grise la cible de la classe.
    const ligneClasse = screen.getByLabelText("Cible de Or physique").closest("tr") as HTMLElement;
    expect((screen.getByLabelText("Cible de Or physique") as HTMLInputElement).disabled).toBe(false);
    await user.click(within(ligneClasse).getByRole("checkbox", { name: "Inclus" }));
    expect((screen.getByLabelText("Cible de Or physique") as HTMLInputElement).disabled).toBe(true);
    await user.click(within(ligneClasse).getByRole("checkbox", { name: "Inclus" }));
    await user.click(await screen.findByRole("button", { name: /Enregistrer/ }));
    await waitFor(async () => expect((await workspace()).params.customClasses).toMatchObject([{ label: "Or physique", color: "#aa3322" }]));
    const params = (await workspace()).params;
    expect(Object.values(params.returns)).toContain(0.025);
    expect(params.targets.find((l: { key: string }) => l.key === params.customClasses[0].id)).toMatchObject({ expectedReturn: 0.03, inAllocation: true, target: 0.1 });

    // Retirer la classe supprime aussi sa ligne de cible.
    await user.click(await screen.findByRole("button", { name: "Supprimer Or physique" }));
    expect(screen.queryByLabelText("Cible de Or physique")).toBeNull();
  });

  it("une classe sans nom est signalée ; la répartition au-delà de 100 % est refusée", async () => {
    const user = userEvent.setup();
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    show(<Parametres />);
    await user.click(await screen.findByRole("tab", { name: "Répartition" }));
    await user.click(await screen.findByRole("button", { name: "Ajouter une classe" }));
    await user.click(await screen.findByRole("button", { name: /Enregistrer/ }));
    expect(await screen.findByText(/Donnez un nom à cette classe/)).toBeTruthy();
    expect((await workspace()).params.customClasses).toEqual([]);
  });

  it("allocations personnalisées : ajout, ligne qui renvoie vers une autre, modification, suppression", async () => {
    const user = userEvent.setup();
    const av = await compte("assurance_vie", "Contrat principal");
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    show(<Parametres />);
    await user.click(await screen.findByRole("tab", { name: "Répartition" }));
    expect(await screen.findByText(/Aucune pour l'instant/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ajouter une allocation" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await user.selectOptions(dialog.getByLabelText("Limite (facultative)"), "verse");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    const ligneAllocation = (nom: string) => screen.getAllByText(nom).map((e) => e.closest("tr")).find((tr) => tr && within(tr).queryByText("Versements")) as HTMLElement;
    await waitFor(() => expect(ligneAllocation("Livrets")).toBeTruthy());
    expect(texte(ligneAllocation("Livrets"))).toMatch(/jusqu'à .* versés/);
    expect(screen.getByText("aux autres lignes")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ajouter une allocation" }));
    dialog = within(await screen.findByRole("dialog", { name: "Nouvelle allocation" }));
    await user.selectOptions(dialog.getByLabelText("Vise"), `compte:${av.id}`);
    const part = dialog.getByLabelText("Part");
    await user.clear(part);
    await user.type(part, "30");
    await user.type(dialog.getByLabelText("Nom (facultatif)"), "Mon contrat");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText("Mon contrat")).toBeTruthy();
    expect(texte(screen.getByText(/Parts des versements :/))).toMatch(/Parts des versements : 50 ?(,0)? %/);

    // Modifier la première ligne pour qu'elle renvoie vers la seconde.
    const premiere = screen.getAllByRole("button", { name: "Modifier" })[0]!;
    await user.click(premiere);
    dialog = within(await screen.findByRole("dialog", { name: "Modifier l'allocation" }));
    await user.selectOptions(dialog.getByLabelText("Ensuite, la part va"), (dialog.getByRole("option", { name: /Mon contrat/ }) as HTMLOptionElement).value);
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("vers « Mon contrat »")).toBeTruthy();

    // Supprimer la ligne de destination libère la première.
    const ligneContrat = screen.getByText("Mon contrat").closest("tr") as HTMLElement;
    await user.click(within(ligneContrat).getByRole("button", { name: "Supprimer" }));
    expect(screen.queryByText("Mon contrat")).toBeNull();
    expect(await screen.findByText("aux autres lignes")).toBeTruthy();
    // Un double clic sur une ligne l'ouvre en modification.
    await user.dblClick(ligneAllocation("Livrets"));
    expect(await screen.findByRole("dialog", { name: "Modifier l'allocation" })).toBeTruthy();
  });
});

describe("Répartition conseillée des versements", () => {
  const rejouer = (id: string, extra: Record<string, unknown> = {}) => ({ id, label: "", target: { kind: "type", accountKind: "livret" }, share: 0.5, limit: null, overflowTo: null, ...extra });
  const regles = async (rules: unknown[]) => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, customAllocations: rules });
  };

  it("sans ligne définie, rien n'est affiché", async () => {
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    const { container } = show(<ContributionSplitCard />);
    await new Promise((r) => setTimeout(r, 100));
    expect(container.textContent).toBe("");
  });

  it("lignes sans versement programmé : la carte invite à programmer", async () => {
    await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    await regles([rejouer("a")]);
    show(<ContributionSplitCard />);
    expect(await screen.findByText("Programmez des versements pour voir la répartition conseillée.")).toBeTruthy();
  });

  it("parts conseillées et programmées, écart, limite en cours ou atteinte, reste sans consigne", async () => {
    const livret = await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    const av = await compte("assurance_vie", "Contrat principal");
    const pea = await compte("pea", "Mon PEA");
    await operation("2025-01-05", "apport_initial", livret.id, 3_000);
    await operation("2025-01-05", "apport_initial", av.id, 500);
    await rpc("plans.set", { accountId: livret.id, fromMonth: "2025-01", amount: 300 });
    await rpc("plans.set", { accountId: av.id, fromMonth: "2025-01", amount: 100 });
    await rpc("plans.set", { accountId: pea.id, fromMonth: "2025-01", amount: 100 });
    await regles([
      rejouer("livrets", { label: "Précaution", share: 0.4, limit: { basis: "verse", amount: 10_000 } }),
      rejouer("av", { target: { kind: "compte", accountId: av.id }, share: 0.2, limit: { basis: "valeur", amount: 400 }, overflowTo: "livrets" }),
    ]);
    show(<ContributionSplitCard />);
    expect(await screen.findByText("Répartition conseillée des versements")).toBeTruthy();
    // 500 € programmés ce mois-ci ; la limite de l'assurance-vie (400 €) est atteinte (500 € de valeur) et sa part va aux livrets.
    const lignePrecaution = screen.getByText("Précaution").closest("tr") as HTMLElement;
    expect(texte(lignePrecaution)).toMatch(/60,0 %/);
    expect(texte(lignePrecaution)).toMatch(/ € \/ 10 000 €/);
    expect(texte(lignePrecaution)).toContain("versés");
    const ligneAv = screen.getByText("Contrat principal").closest("tr") as HTMLElement;
    expect(within(ligneAv).getByText(/limite atteinte/)).toBeTruthy();
    // Il reste 40 % sans consigne sur 500 € : 200 € à répartir librement.
    expect(screen.getByText(/par mois sans consigne : à répartir librement/)).toBeTruthy();
  });

  it("une ligne sans limite affiche « sans fin » ; une limite en valeur affiche l'avancement", async () => {
    const livret = await compte("livret", "Livret A", { livretType: "LIVRET_A" });
    const pea = await compte("pea", "Mon PEA");
    await operation("2025-01-05", "apport_initial", livret.id, 1_000);
    await rpc("plans.set", { accountId: livret.id, fromMonth: "2025-01", amount: 200 });
    await rpc("plans.set", { accountId: pea.id, fromMonth: "2025-01", amount: 300 });
    await regles([rejouer("livrets", { share: 0.4 }), rejouer("pea", { target: { kind: "type", accountKind: "pea" }, share: 0.6, limit: { basis: "valeur", amount: 8_000 } })]);
    show(<ContributionSplitCard />);
    const sansFin = await screen.findByText("sans fin");
    expect(sansFin).toBeTruthy();
    const lignePea = screen.getByText("PEA").closest("tr") as HTMLElement;
    expect(texte(lignePea)).toContain("de valeur");
    expect(lignePea.querySelector('div[style*="width"]')).toBeTruthy();
  });
});

/** Un bien, avec ou sans crédit rattaché : base commune des parcours immobilier et crédits. */
const bien = (extra: Record<string, unknown> = {}) => rpc<Id>("properties.upsert", { kind: "residence_principale", name: "Maison", value: 300_000, valueDate: "2024-05-01", purchasePrice: 250_000, purchaseDate: "2019-06-01", ...extra });
const pret = (extra: Record<string, unknown> = {}) => rpc<Id>("loans.upsert", { kind: "immobilier", name: "Prêt maison", principal: 200_000, rate: 0.03, termMonths: 240, firstPayment: dansAns(-3), ...extra });

describe("Immobilier", () => {
  it("sans bien : le tableau est vide et propose d'ajouter une résidence", async () => {
    show(<Immobilier />);
    expect(await screen.findByText(/Aucun bien\. Ajoutez votre résidence/)).toBeTruthy();
    expect(screen.getByText("Biens immobiliers")).toBeTruthy();
    expect(screen.getByText("SCPI")).toBeTruthy();
  });

  it("biens, parts, démembrement, vente et allocation ; SCPI détenues sur les comptes", async () => {
    const user = userEvent.setup();
    const maison = await bien({ share: 0.5, inAllocation: true });
    await bien({ name: "Nue-propriété", kind: "autre", value: 100_000, valueDate: null, dismemberment: "nue_propriete", usufructBirthDate: "1950-01-01" });
    const vendu = await bien({ name: "Studio vendu", kind: "locatif", value: 120_000, valueDate: null });
    await rpc("properties.sell", { id: vendu.id, saleDate: "2025-09-01", salePrice: 130_000, saleFees: 3_000, closeLoans: true });
    const cto = await compte("cto", "CTO immobilier");
    const scpi = await titre("scpi", "SCPI Fictive", { inAllocation: true });
    const scpiHors = await titre("scpi", "SCPI Prudente");
    await operation("2025-01-05", "versement", cto.id, 3_000);
    await operation("2025-01-06", "achat", cto.id, 1_000, { assetId: scpi.id, quantity: 10 });
    await operation("2025-01-06", "achat", cto.id, 800, { assetId: scpiHors.id, quantity: 8 });
    await cours(scpi.id, 110);
    await cours(scpiHors.id, 100);
    show(<Immobilier />);

    expect(await screen.findByRole("link", { name: "Maison" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maison" }).getAttribute("href")).toBe(`/immobilier/${maison.id}`);
    const rowMaison = ligne("Maison");
    expect(texte(rowMaison)).toContain("estimé le 01/05/2024");
    expect(texte(rowMaison)).toMatch(/50,0 %/);
    expect(texte(rowMaison)).toContain("Inclus");
    const rowVendu = ligne("Studio vendu");
    expect(texte(rowVendu)).toContain("vendu le 01/09/2025");
    expect(texte(rowVendu)).toContain("Hors");
    // SCPI : un tableau à part, avec le compte qui les détient et leur statut d'allocation.
    const rowScpi = ligne("SCPI Fictive");
    expect(texte(rowScpi)).toContain("CTO immobilier");
    expect(texte(rowScpi)).toContain("Inclus");
    expect(texte(ligne("SCPI Prudente"))).toContain("Hors");
    // Nue-propriété : la part évaluée d'après l'âge de l'usufruitier est rappelée sous la part détenue.
    expect(texte(ligne("Nue-propriété"))).toMatch(/nue-propriété \d+(,\d)? %/);

    // Fiche du bien : grande fenêtre de présentation, qui se ferme.
    await user.click(within(rowMaison).getByRole("button", { name: "Fiche du bien Maison" }));
    const fiche = within(await screen.findByRole("dialog", { name: "Fiche du bien" }));
    expect(fiche.getByRole("heading", { name: "Maison" })).toBeTruthy();
    // Deux boutons « Fermer » : la croix de la fenêtre et celui du pied.
    await user.click(fiche.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fiche du bien" })).toBeNull());
  });

  it("modifier ou supprimer un bien : la suppression se confirme", async () => {
    const user = userEvent.setup();
    const maison = await bien();
    show(<Immobilier />);
    await user.click(within(await screen.findByRole("link", { name: "Maison" }).then((x) => x.closest("tr") as HTMLElement)).getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bien" }));
    await user.clear(dialog.getByLabelText("Nom"));
    await user.type(dialog.getByLabelText("Nom"), "Maison de famille");
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === maison.id)).toMatchObject({ name: "Maison de famille" }));
    h.confirm = false;
    const row = (await screen.findByRole("link", { name: "Maison de famille" })).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).properties).toHaveLength(1);
    h.confirm = true;
    await user.click(within(row).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).properties).toEqual([]));
  });

  it("nouveau bien depuis la page : la fenêtre s'ouvre vide", async () => {
    const user = userEvent.setup();
    show(<Immobilier />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    expect(await screen.findByRole("dialog", { name: "Nouveau bien" })).toBeTruthy();
  });
});

describe("Fiche de bien : formulaire d'achat (PropertyDialog)", () => {
  it("le montant des frais de notaire revient à l'estimation sur demande ; sans prix, le coût complet est expliqué", async () => {
    const user = userEvent.setup();
    show(<Immobilier />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    await user.type(dialog.getByLabelText("Prix d'achat (facultatif)"), "200000");
    const notaire = dialog.getByLabelText("Frais de notaire") as HTMLInputElement;
    await waitFor(() => expect(notaire.value).toMatch(/\d/));
    const estimation = notaire.value;
    await user.clear(notaire);
    await user.type(notaire, "1000");
    await user.click(dialog.getByRole("button", { name: "Reprendre l'estimation" }));
    await waitFor(() => expect(notaire.value).toBe(estimation));
    expect(dialog.getByText(/Estimés d'après le prix/)).toBeTruthy();
    // Sans prix d'achat mais avec des frais : le coût complet attend le prix.
    await user.clear(dialog.getByLabelText("Prix d'achat (facultatif)"));
    await waitFor(() => expect(dialog.queryByText(/Coût d'achat complet/)).toBeNull());
    await user.type(dialog.getByLabelText("Frais d'agence"), "5000");
    expect(await dialog.findByText("Indiquez le prix d'achat pour obtenir le coût d'achat complet.")).toBeTruthy();
  });

  it("bien détenu via une SCI : la société se choisit ; le démembrement exige de quoi évaluer l'usufruit", async () => {
    const user = userEvent.setup();
    const sci = await rpc<Id>("companies.upsert", { name: "SCI Fictive", share: 0.25 });
    show(<Immobilier />);
    await user.click(await screen.findByRole("button", { name: "Nouveau bien" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bien" }));
    expect(dialog.queryByLabelText("Société")).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Statut"), "sci");
    expect(dialog.getByLabelText("Société")).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Société"), sci.id);
    expect(dialog.getByText("Part détenue par la SCI")).toBeTruthy();
    expect(within(dialog.getByLabelText("Société")).getByRole("option", { name: /SCI Fictive \(25 % des parts\)/ })).toBeTruthy();
    await user.type(dialog.getByLabelText("Nom"), "Appartement en SCI");
    await user.selectOptions(dialog.getByLabelText("Droit détenu"), "usufruit");
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dialog.getByLabelText("Naissance de l'usufruitier"), { target: { value: "1960-03-01" } });
    // Allocation du bien et classe d'actifs.
    await user.selectOptions(dialog.getByLabelText("Allocation cible"), "in");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).properties).toMatchObject([{ name: "Appartement en SCI", ownership: "sci", companyId: sci.id, dismemberment: "usufruit", usufructBirthDate: "1960-03-01", inAllocation: true }]));
  });

  it("sans société choisie, une SCI propose d'en créer une ; classe d'actifs et archivage à la modification", async () => {
    const user = userEvent.setup();
    const classe = await classeUtilisateur("Immobilier papier");
    const b = await bien({ ownership: "sci_familiale" });
    show(<Immobilier />);
    await user.click(within(await screen.findByRole("link", { name: "Maison" }).then((x) => x.closest("tr") as HTMLElement)).getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bien" }));
    expect(dialog.getByText(/Créez d'abord la SCI dans la page Immobilier/)).toBeTruthy();
    await user.selectOptions(await dialog.findByLabelText("Classe d'actifs"), classe);
    await user.click(dialog.getByLabelText("Archivé (ne compte plus dans le patrimoine)"));
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === b.id)).toMatchObject({ classId: classe, archived: true }));
  });
});

describe("Crédits", () => {
  it("sans crédit : un tableau vide, et aucune carte d'analyse", async () => {
    show(<Credits />);
    expect(await screen.findByText("Aucun crédit en cours.")).toBeTruthy();
    expect(screen.queryByText("Poids des crédits")).toBeNull();
    expect(screen.queryByText("Rembourser par avance ou placer ?")).toBeNull();
  });

  it("crédits en cours : part à charge, assurance, relevé de la banque, bien rattaché ; archivés listés et rétablissables", async () => {
    const user = userEvent.setup();
    const maison = await bien();
    await pret({ propertyId: maison.id, share: 0.5, insuranceMode: "montant", insurance: 40 });
    await pret({ kind: "consommation", name: "Voiture", principal: 9_000, rate: 0.05, termMonths: 48, firstPayment: dansAns(-1), insuranceMode: "capital_initial", insuranceRate: 0.004, manualBalance: 4_000, manualBalanceDate: ilYaJours(20) });
    await pret({ name: "Ancien prêt", principal: 10_000, termMonths: 24, archived: true });
    show(<Credits />);

    expect(await screen.findByText("Capital restant dû", { selector: "div,span,dt,th" }).catch(() => screen.getAllByText("Capital restant dû")[0])).toBeTruthy();
    const rowMaison = ligne("Prêt maison");
    expect(texte(rowMaison)).toContain("Maison");
    expect(texte(rowMaison)).toContain("dont assurance");
    expect(texte(rowMaison)).toContain("à votre charge");
    const rowVoiture = ligne("Voiture");
    expect(texte(rowVoiture)).toContain("d'après relevé");
    expect(texte(rowVoiture)).toMatch(/assurance 0,40 %/);
    // Crédit soldé : listé à part avec son montant.
    expect(screen.getByText("Crédits archivés")).toBeTruthy();
    const rowArchive = screen.getAllByText("Ancien prêt").map((x) => x.closest("tr") as HTMLElement).find((tr) => tr && texte(tr).includes("10 000"))!;
    expect(rowArchive).toBeTruthy();
    // Un crédit archivé s'ouvre en modification, où il se rétablit.
    await user.click(within(rowArchive).getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le crédit" }));
    await user.click(dialog.getByLabelText(/Archivé \(soldé/));
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).loans.find((l: { name: string }) => l.name === "Ancien prêt")).toMatchObject({ archived: false }));
  });

  it("nouveau crédit depuis la page : enregistré et ajouté au tableau", async () => {
    const user = userEvent.setup();
    show(<Credits />);
    await user.click(await screen.findByRole("button", { name: "Nouveau crédit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau crédit" }));
    await user.type(dialog.getByLabelText("Nom"), "Prêt relais");
    const montant = dialog.getByLabelText("Montant emprunté");
    await user.clear(montant);
    await user.type(montant, "50000");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    expect((await screen.findAllByText("Prêt relais")).length).toBeGreaterThan(0);
    expect((await workspace()).loans).toMatchObject([{ name: "Prêt relais", principal: 50_000, kind: "immobilier" }]);
  });

  it("suppression d'un crédit : refusée, il reste ; confirmée, il disparaît", async () => {
    const user = userEvent.setup();
    await pret({ name: "Prêt travaux", kind: "travaux", principal: 15_000, termMonths: 60 });
    show(<Credits />);
    h.confirm = false;
    await user.click(within((await screen.findAllByText("Prêt travaux"))[0]!.closest("tr") as HTMLElement).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).loans).toHaveLength(1);
    h.confirm = true;
    await user.click(within(ligne("Prêt travaux")).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).loans).toEqual([]));
    expect(await screen.findByText("Aucun crédit en cours.")).toBeTruthy();
  });

  it("détail d'un crédit : coût année par année (capital, intérêts, assurance) et remboursements anticipés", async () => {
    const user = userEvent.setup();
    await pret({ insuranceMode: "montant", insurance: 30 });
    show(<Credits />);
    await user.click(within((await screen.findAllByText("Prêt maison"))[0]!.closest("tr") as HTMLElement).getByRole("button", { name: /Afficher le détail : Prêt maison/ }));
    expect(await screen.findByText(/Capital sur toute la durée/)).toBeTruthy();
    expect(screen.getByText(/Intérêts sur toute la durée/)).toBeTruthy();
    expect(screen.getByText(/Assurance sur toute la durée/)).toBeTruthy();
    // L'info-bulle du graphique détaille la première année : capital, intérêts, assurance, total et reste dû.
    const infobulle = screen.getByTestId("graphique").getAttribute("data-infobulle")!;
    expect(infobulle).toContain(String(+todayIso().slice(0, 4) - 3));
    for (const mot of ["Capital", "Intérêts", "Assurance", "Total :", "Reste dû fin"]) expect(infobulle).toContain(mot);
    // Détail par année : repliable, une ligne par année.
    await user.click(screen.getByText("Voir le détail par année"));
    const tableau = (screen.getByText("Voir le détail par année").closest("details") as HTMLElement).querySelector("table")!;
    expect(within(tableau).getAllByRole("row").length).toBeGreaterThan(5);

    // Remboursements anticipés : aucun, puis ajout, puis suppression.
    expect(screen.getByText("Aucun.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Remboursement anticipé" }));
    const enregistrer = dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(enregistrer.disabled).toBe(true);
    await user.type(dialog.getByLabelText("Capital remboursé"), "20000");
    await user.type(dialog.getByLabelText("Indemnité (facultative)"), "300");
    await user.selectOptions(dialog.getByLabelText("Ensuite"), "mensualite");
    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2025-06-05" } });
    await user.click(enregistrer);
    await waitFor(async () => expect((await workspace()).loans[0].prepayments).toMatchObject([{ date: "2025-06-05", amount: 20000, fee: 300, mode: "mensualite" }]));
    const remboursement = (await screen.findByText(/05\/06\/2025 · Réduire la mensualité/)).closest("div") as HTMLElement;
    expect(texte(remboursement)).toContain("indemnité");
    await user.click(screen.getByRole("button", { name: "Supprimer le remboursement du 05/06/2025" }));
    await waitFor(async () => expect((await workspace()).loans[0].prepayments).toEqual([]));
    expect(await screen.findByText("Aucun.")).toBeTruthy();
  });

  it("un crédit sans assurance n'affiche que le capital et les intérêts dans l'info-bulle", async () => {
    const user = userEvent.setup();
    await pret({ termMonths: 36, firstPayment: dansAns(-1) });
    show(<Credits />);
    await user.click(within((await screen.findAllByText("Prêt maison"))[0]!.closest("tr") as HTMLElement).getByRole("button", { name: /Afficher le détail/ }));
    const infobulle = (await screen.findByTestId("graphique")).getAttribute("data-infobulle")!;
    expect(infobulle).toContain("Intérêts");
    expect(infobulle).not.toContain("Assurance");
  });

  it("remboursement anticipé : une indemnité vide ne bloque pas, Annuler ferme sans rien enregistrer", async () => {
    const user = userEvent.setup();
    await pret();
    show(<Credits />);
    await user.click(within((await screen.findAllByText("Prêt maison"))[0]!.closest("tr") as HTMLElement).getByRole("button", { name: /Afficher le détail/ }));
    await user.click(await screen.findByRole("button", { name: "Ajouter" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Remboursement anticipé" }));
    await user.type(dialog.getByLabelText("Indemnité (facultative)"), "50");
    await user.clear(dialog.getByLabelText("Indemnité (facultative)"));
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await workspace()).loans[0].prepayments).toEqual([]);
    // Rouvert, le formulaire est remis à zéro.
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    dialog = within(await screen.findByRole("dialog", { name: "Remboursement anticipé" }));
    expect((dialog.getByLabelText("Capital remboursé") as HTMLInputElement).value).toBe("");
  });
});

describe("Poids des crédits et « rembourser ou placer ? »", () => {
  const revenus = async (netMonthlyIncome: number) => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, netMonthlyIncome } });
  };

  it("sans revenus renseignés, la carte renvoie vers Paramètres ; chaque bien montre la part encore due", async () => {
    const maison = await bien({ value: 300_000 });
    await pret({ propertyId: maison.id });
    show(<Credits />);
    expect(await screen.findByText("Poids des crédits")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Indiquez vos revenus nets/ }).getAttribute("href")).toBe("/parametres");
    expect(screen.getByText("Part de chaque bien encore due à la banque")).toBeTruthy();
    const barre = screen.getByRole("img", { name: /% encore dû/ });
    expect(Number(/(\d+) %/.exec(barre.getAttribute("aria-label")!)![1])).toBeGreaterThan(0);
    // Taux assurance comprise et intérêts restants, crédit par crédit.
    const carte = carteDe("Poids des crédits");
    expect(within(carte).getByText("Taux assurance comprise")).toBeTruthy();
    expect(within(carte).getByText("Intérêts restants")).toBeTruthy();
  });

  it("avec les revenus : taux d'effort, signalé en rouge au-delà de 35 %, sans alerte en dessous", async () => {
    await pret({ insuranceMode: "montant", insurance: 50 });
    await revenus(1_000);
    const premiere = show(<Credits />);
    const effort = async () => (await screen.findByText("Taux d'effort")).nextElementSibling as HTMLElement;
    expect(texte(await effort())).toContain("les banques prêtent jusqu'à 35 %");
    expect((await effort()).className).toContain("text-negative");
    premiere.unmount();
    await revenus(20_000);
    show(<Credits />);
    expect((await effort()).className).not.toContain("text-negative");
    expect(texte(await effort())).toContain("des revenus nets");
  });

  it("comparaison : rembourser ou placer selon le taux, le mode et l'indemnité ; « autre taux » libre", async () => {
    const user = userEvent.setup();
    await pret({ name: "Prêt A", rate: 0.04 });
    await pret({ name: "Prêt B", rate: 0.01, kind: "travaux", principal: 30_000, termMonths: 120, firstPayment: dansAns(-1) });
    show(<Credits />);
    const carte = carteDe("Rembourser par avance ou placer ?", await screen.findByText("Rembourser par avance ou placer ?"));
    const c = within(carte);
    // Crédit à 4 % : rembourser rapporte plus qu'un fonds en euros.
    expect(await c.findByText(/Rembourser vous laisse environ/)).toBeTruthy();
    expect(c.getByText(/Placer devient plus intéressant au-delà de/)).toBeTruthy();
    expect(c.getByText(/fin du crédit le .* mois de moins/)).toBeTruthy();
    expect(within(c.getByLabelText("Crédit")).getAllByRole("option").map((o) => texte(o))).toEqual(["Prêt A (4,0 %)", "Prêt B (1,0 %)"]);

    // Mensualité réduite plutôt que durée.
    await user.selectOptions(c.getByLabelText("Après le remboursement"), "mensualite");
    expect(await c.findByText(/mensualité ramenée à/)).toBeTruthy();
    // Crédit à 1 % et placement à 8 % : placer fait mieux.
    await user.selectOptions(c.getByLabelText("Crédit"), within(c.getByLabelText("Crédit")).getAllByRole("option")[1]!.getAttribute("value")!);
    await user.selectOptions(c.getByLabelText("Placement de comparaison"), "autre");
    const rendement = c.getByLabelText("Rendement net par an");
    await user.clear(rendement);
    await user.type(rendement, "8");
    expect(await c.findByText(/Placer vous laisse environ/)).toBeTruthy();
    // Retour à un placement de la liste : le taux est repris du plan.
    const options = within(c.getByLabelText("Placement de comparaison")).getAllByRole("option");
    expect(options.at(-1)!.textContent).toBe("Autre taux");
    await user.selectOptions(c.getByLabelText("Placement de comparaison"), options[0]!.getAttribute("value")!);
    expect((c.getByLabelText("Rendement net par an") as HTMLInputElement).value).not.toBe("8");
    // L'indemnité suit le plafond légal tant qu'elle n'est pas saisie ; la saisir recalcule.
    const indemnite = c.getByLabelText("Indemnité de la banque") as HTMLInputElement;
    expect(c.getByText(/selon la loi|Selon votre contrat/)).toBeTruthy();
    await user.clear(indemnite);
    await user.type(indemnite, "0");
    expect(indemnite.value).toBe("0");
    // Une somme minuscule : les deux options se valent.
    const somme = c.getByLabelText("Somme disponible");
    await user.clear(somme);
    await user.type(somme, "1");
    expect(await c.findByText("Les deux options se valent.")).toBeTruthy();
    // Sans somme, pas de résultat.
    await user.clear(somme);
    await waitFor(() => expect(c.queryByText("Les deux options se valent.")).toBeNull());
    expect(c.queryByText(/Rembourser :/)).toBeNull();
  });

  it("crédit soldé (plus aucune échéance) : pas de comparaison proposée", async () => {
    await pret({ name: "Prêt terminé", termMonths: 12, firstPayment: dansAns(-5) });
    show(<Credits />);
    expect((await screen.findAllByText("Prêt terminé")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Rembourser par avance ou placer ?")).toBeNull();
  });
});

describe("Formulaire de crédit (LoanDialog)", () => {
  it("assurance au taux, différé, bien concerné et part ; le capital relevé exige sa date", async () => {
    const user = userEvent.setup();
    const maison = await bien();
    await bien({ name: "Appartement", kind: "locatif" });
    show(<Credits />);
    await user.click(await screen.findByRole("button", { name: "Nouveau crédit" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau crédit" }));
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(dialog.getByLabelText("Nom"), "Prêt maison");
    const montant = dialog.getByLabelText("Montant emprunté");
    await user.clear(montant);
    await user.type(montant, "120000");
    // Biens proposés pour un crédit immobilier.
    expect(within(dialog.getByLabelText("Bien concerné (facultatif)")).getAllByRole("option").map((o) => o.textContent).sort()).toEqual(["Appartement", "Aucun", "Maison"]);
    await user.selectOptions(dialog.getByLabelText("Bien concerné (facultatif)"), maison.id);
    // Assurance au taux : le champ du montant mensuel est remplacé.
    expect(dialog.getByLabelText("Montant par mois")).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Assurance basée sur"), "capital_restant");
    expect(dialog.queryByLabelText("Montant par mois")).toBeNull();
    await user.type(dialog.getByLabelText("Taux annuel de l'assurance"), "0,3");
    // Différé : le type apparaît dès le premier mois.
    expect(dialog.queryByLabelText("Type de différé")).toBeNull();
    await user.clear(dialog.getByLabelText("Différé (mois)"));
    await user.type(dialog.getByLabelText("Différé (mois)"), "6");
    await user.selectOptions(dialog.getByLabelText("Type de différé"), "total");
    // Un différé aussi long que le crédit est refusé.
    const duree = dialog.getByLabelText("Durée (mois)");
    await user.clear(duree);
    await user.type(duree, "6");
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    await user.clear(duree);
    await user.type(duree, "240");
    // Capital relevé sans date : message et bouton bloqué.
    await user.type(dialog.getByLabelText("Capital restant dû"), "100000");
    expect(dialog.getByText("Indiquez le capital et sa date.")).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(dialog.getByLabelText("À la date du"), { target: { value: ilYaJours(10) } });
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).loans).toMatchObject([{ name: "Prêt maison", propertyId: maison.id, principal: 120_000, insuranceMode: "capital_restant", insuranceRate: 0.003, deferredMonths: 6, deferredKind: "total", termMonths: 240, manualBalance: 100_000 }]));
  });
});

describe("Crowdlending : classement et fenêtres", () => {
  it("les projets en défaut passent avant ceux en retard, en cours puis remboursés ; fermer l'import ne change rien", async () => {
    const user = userEvent.setup();
    const c = await compte("crowdlending", "Plateforme Fictive");
    await operation("2024-01-02", "versement", c.id, 10_000);
    const projet = (name: string, extra: Record<string, unknown>) => rpc("crowdProjects.upsert", { accountId: c.id, name, amount: 1_000, rate: 0.08, startDate: "2024-02-01", termMonths: 24, ...extra });
    await projet("Projet remboursé", { status: "rembourse", statusDate: "2025-01-15", repaidCapital: 1_000 });
    await projet("Projet en cours", {});
    await projet("Projet en retard", { status: "retard", statusDate: "2025-06-01" });
    await projet("Projet en défaut", { status: "defaut", statusDate: "2025-07-01", expectedRecovery: 300 });
    show(<Crowdlending />);
    await screen.findByText("Projet en défaut");
    const ordre = () => screen.getAllByText(/^Projet (en|remb)/).map((x) => x.childNodes[0]!.textContent);
    expect(ordre()).toEqual(["Projet en défaut", "Projet en retard", "Projet en cours", "Projet remboursé"]);
    // Le projet en défaut ne compte que pour la part récupérable.
    expect(texte(ligne("Projet en défaut"))).toMatch(/compté 300/);

    await user.click(screen.getByRole("button", { name: "Importer un fichier Bricks" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await workspace()).crowdProjects).toHaveLength(4);
  });
});

const pageBien = (id: string, onglet?: string) =>
  show(
    <Routes>
      <Route path="/immobilier/:id" element={<Bien />} />
    </Routes>,
    `/immobilier/${id}${onglet ? `?onglet=${onglet}` : ""}`,
  );
const locatif = (extra: Record<string, unknown> = {}) => bien({ kind: "locatif", name: "Studio", value: 120_000, purchasePrice: 100_000, ...extra });
const bail = (propertyId: string, extra: Record<string, unknown> = {}) => rpc<Id>("leases.upsert", { propertyId, kind: "vide", startDate: dansAns(-2), durationMonths: 36, rent: 800, charges: 50, deposit: 800, ...extra });

describe("Bien : vente, annulation de vente, modification", () => {
  it("un bien inconnu est signalé, avec un retour vers Immobilier", async () => {
    pageBien("inconnu");
    expect(await screen.findByRole("heading", { name: "Bien introuvable" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Immobilier/ }).getAttribute("href")).toBe("/immobilier");
  });

  it("vente refusée avant la date d'achat, puis enregistrée avec le crédit soldé ; la vente s'annule sur confirmation", async () => {
    const user = userEvent.setup();
    const studio = await bien({ name: "Studio", kind: "locatif", purchasePrice: 100_000, purchaseDate: "2020-01-01" });
    await pret({ propertyId: studio.id, principal: 60_000, termMonths: 120, firstPayment: "2020-03-05" });
    pageBien(studio.id);
    await user.click(await screen.findByRole("button", { name: "Vendre" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Vendre « Studio »" }));
    const enregistrer = dialog.getByRole("button", { name: "Enregistrer la vente" }) as HTMLButtonElement;
    expect(enregistrer.disabled).toBe(true);
    // Date avant l'achat : refusée avec la raison, et aucun bilan n'est calculé.
    fireEvent.change(dialog.getByLabelText("Date de vente"), { target: { value: "2019-01-01" } });
    expect(dialog.getByText("Avant la date d'achat.")).toBeTruthy();
    await user.type(dialog.getByLabelText("Prix de vente"), "140000");
    expect(enregistrer.disabled).toBe(true);
    expect(dialog.queryByText(/avant impôt/)).toBeNull();
    fireEvent.change(dialog.getByLabelText("Date de vente"), { target: { value: "2025-09-01" } });
    expect(await dialog.findByText(/restant après remboursement du crédit/)).toBeTruthy();
    const avecCredit = texte(dialog.getByText(/avant impôt/).closest("p"));
    // Décocher « Solder les crédits » garde le crédit dans le reste.
    await user.click(dialog.getByLabelText("Solder les crédits rattachés à cette date"));
    expect(texte(dialog.getByText(/avant impôt/).closest("p"))).not.toBe(avecCredit);
    await user.click(dialog.getByLabelText("Solder les crédits rattachés à cette date"));
    await user.type(dialog.getByLabelText("Frais de vente"), "2000");
    await user.click(enregistrer);
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === studio.id)).toMatchObject({ salePrice: 140_000, saleDate: "2025-09-01", saleFees: 2_000, archived: true }));
    // Un bien vendu n'a plus ses chiffres de patrimoine, mais un bilan de vente dans l'onglet Finances.
    await user.click(await screen.findByRole("tab", { name: "Finances" }));
    expect(await screen.findByText("Bilan de la vente")).toBeTruthy();
    expect(screen.getByText("Vendu le 01/09/2025")).toBeTruthy();

    // Annuler la vente : refusé d'abord, puis confirmé.
    h.confirm = false;
    await user.click(screen.getByRole("button", { name: "Annuler la vente" }));
    expect((await workspace()).properties.find((p: Id) => p.id === studio.id)).toMatchObject({ archived: true });
    h.confirm = true;
    await user.click(screen.getByRole("button", { name: "Annuler la vente" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === studio.id)).toMatchObject({ archived: false, salePrice: null }));
    expect(await screen.findByRole("button", { name: "Vendre" })).toBeTruthy();
  });

  it("bien sans prix d'achat : le gain à la vente est « inconnu » ; la fiche se modifie depuis sa page", async () => {
    const user = userEvent.setup();
    const terrain = await bien({ name: "Terrain", kind: "autre", purchasePrice: null, purchaseDate: null, value: 50_000 });
    pageBien(terrain.id);
    await user.click(await screen.findByRole("button", { name: "Vendre" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Vendre « Terrain »" }));
    await user.type(dialog.getByLabelText("Prix de vente"), "55000");
    expect(await dialog.findByText("inconnu sans prix d'achat")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Modifier" }));
    const form = within(await screen.findByRole("dialog", { name: "Modifier le bien" }));
    await user.clear(form.getByLabelText("Nom"));
    await user.type(form.getByLabelText("Nom"), "Terrain constructible");
    await user.click(form.getByRole("button", { name: "Valider" }));
    expect(await screen.findByRole("heading", { name: "Terrain constructible" })).toBeTruthy();
    // Pas de crédit : le tableau l'explique ; pas de location pour un bien qui n'est pas locatif.
    expect(screen.getByText(/Rattachez-en un depuis la page/)).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Location" })).toBeNull();
  });

  it("travaux d'amélioration : le coût total les inclut, avec un détail dans l'achat", async () => {
    const maison = await bien();
    await rpc("propertyExpenses.upsert", { propertyId: maison.id, date: "2023-05-10", category: "travaux", amount: 20_000, label: "Extension", improvement: true });
    pageBien(maison.id, "finances");
    expect(await screen.findByText("Travaux d'amélioration depuis l'achat")).toBeTruthy();
    expect(screen.getAllByText("Coût total").length).toBeGreaterThan(0);
    expect(screen.getByText("Amélioration")).toBeTruthy();
  });
});

describe("Bien : dépenses", () => {
  it("catégorie travaux améliorante, dépense annuelle bornée, modification, puis suppression confirmée", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    pageBien(studio.id, "finances");
    expect(await screen.findByText(/Aucune dépense\. Ajoutez la taxe foncière/)).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: /Nouvelle dépense/ }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouvelle dépense" }));
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.queryByLabelText(/Améliore le bien/)).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Catégorie"), "travaux");
    await user.type(dialog.getByLabelText("Libellé (facultatif)"), "Rénovation cuisine");
    fireEvent.change(dialog.getByLabelText("Date"), { target: { value: "2024-03-10" } });
    await user.type(dialog.getByLabelText("Montant"), "4500");
    await user.click(dialog.getByLabelText(/Améliore le bien/));
    // Une dépense annuelle peut s'arrêter une année donnée ; décocher « chaque année » retire cette borne.
    await user.click(dialog.getByLabelText("Chaque année, à la même date"));
    await user.type(dialog.getByLabelText("Dernière année (facultative)"), "2027");
    await user.click(dialog.getByLabelText("Chaque année, à la même date"));
    expect(dialog.queryByLabelText("Dernière année (facultative)")).toBeNull();
    await user.click(dialog.getByLabelText("Chaque année, à la même date"));
    await user.type(dialog.getByLabelText("Dernière année (facultative)"), "2027");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).propertyExpenses).toMatchObject([{ propertyId: studio.id, category: "travaux", amount: 4500, label: "Rénovation cuisine", date: "2024-03-10", improvement: true, yearly: true, untilYear: 2027 }]));
    const row = (await screen.findByText("Rénovation cuisine")).closest("tr") as HTMLElement;
    expect(texte(row)).toContain("Amélioration");
    expect(texte(row)).toContain("Chaque année jusqu'en 2027");

    // Modification : le montant change.
    await user.click(within(row).getByRole("button", { name: "Modifier" }));
    dialog = within(await screen.findByRole("dialog", { name: "Modifier la dépense" }));
    await user.clear(dialog.getByLabelText("Montant"));
    await user.type(dialog.getByLabelText("Montant"), "5000");
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).propertyExpenses).toMatchObject([{ amount: 5000 }]));

    // Une dépense annuelle sans borne affiche « Chaque année » ; la suppression se confirme.
    await user.click(await screen.findByRole("button", { name: /Nouvelle dépense/ }));
    dialog = within(await screen.findByRole("dialog", { name: "Nouvelle dépense" }));
    await user.type(dialog.getByLabelText("Montant"), "900");
    await user.click(dialog.getByLabelText("Chaque année, à la même date"));
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).propertyExpenses).toHaveLength(2));
    h.confirm = false;
    const ligneTaxe = (await screen.findByText("Chaque année")).closest("tr") as HTMLElement;
    await user.click(within(ligneTaxe).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).propertyExpenses).toHaveLength(2);
    h.confirm = true;
    await user.click(within(ligneTaxe).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).propertyExpenses).toHaveLength(1));
  });
});

describe("Bien : bail, loyers et quittances", () => {
  it("bail en cours : garant, assurance, dépôt, loyers à revoir ; nouveau loyer, évolution, suppression d'un loyer", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    const b = await bail(studio.id, { renters: [{ lastName: "Locataire fictif" }], guarantees: [{ kind: "caution", name: "Garant fictif", until: dansAns(3) }], tenantInsuranceUntil: dansJours(200), reminders: false });
    pageBien(studio.id, "location");
    expect(await screen.findByText(/· Locataire fictif/)).toBeTruthy();
    expect(screen.getByText("Caution d'une personne")).toBeTruthy();
    expect(screen.getByText(/^Garant fictif, jusqu'au /)).toBeTruthy();
    expect(screen.getByText("Assurance du locataire jusqu'au")).toBeTruthy();
    expect(screen.getByText("Désactivés")).toBeTruthy();
    expect(screen.getByText(/Dépôt de garantie \(à restituer\)/)).toBeTruthy();

    // Anniversaire dépassé sans révision : la révision est proposée, et se referme sans rien changer.
    await user.click(await screen.findByRole("button", { name: "Réviser le loyer" }));
    expect(await screen.findByRole("dialog", { name: "Révision annuelle du loyer" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Révision annuelle du loyer" })).toBeNull());
    expect((await workspace()).leaseRents).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Nouveau loyer" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau loyer" }));
    expect(dialog.queryByText(/ne peut pas être augmenté/)).toBeNull();
    // Le formulaire reprend le loyer et les charges actuels ; un loyer nul est refusé.
    expect((dialog.getByLabelText("Loyer hors charges") as HTMLInputElement).value).toMatch(/^800/);
    expect((dialog.getByLabelText("Charges") as HTMLInputElement).value).toMatch(/^50/);
    const loyer = dialog.getByLabelText("Loyer hors charges");
    await user.clear(loyer);
    expect((dialog.getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(loyer, "850");
    await user.clear(dialog.getByLabelText("Charges"));
    await user.type(dialog.getByLabelText("Charges"), "60");
    fireEvent.change(dialog.getByLabelText("À partir de"), { target: { value: `${+todayIso().slice(0, 4) - 1}-01` } });
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).leaseRents).toMatchObject([{ leaseId: b.id, rent: 850, charges: 60, fromMonth: `${+todayIso().slice(0, 4) - 1}-01` }]));
    expect(await screen.findByText("Évolution du loyer")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: /^Supprimer le loyer de / }));
    await waitFor(async () => expect((await workspace()).leaseRents).toEqual([]));
    expect(screen.queryByText("Évolution du loyer")).toBeNull();
  });

  it("révision bloquée par une note DPE F : l'avertissement est affiché à l'anniversaire et dans le nouveau loyer", async () => {
    const user = userEvent.setup();
    const studio = await locatif({ dpe: "F", dpeDate: "2024-01-10" });
    await bail(studio.id);
    pageBien(studio.id, "location");
    expect(await screen.findByText(/avec une note DPE F ou G, le loyer ne peut pas être révisé/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nouveau loyer" }));
    expect(await screen.findByText(/Avec une note DPE F ou G, le loyer ne peut pas être augmenté/)).toBeTruthy();
  });

  it("dépôt rendu avec retenue, congé du locataire et départ réel : le bail se modifie, ses échéances se recalculent", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    const b = await bail(studio.id, { kind: "vide", renters: [{ lastName: "Locataire fictif" }] });
    pageBien(studio.id, "location");
    await user.click(await screen.findByRole("button", { name: "Modifier ou donner congé" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bail" }));
    // Congé du propriétaire proposé pour un bail vide ; un congé sans date est complété par la date du jour.
    expect(dialog.getByRole("option", { name: "Donné par le propriétaire" })).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Congé"), "locataire");
    expect((dialog.getByLabelText("Reçu le") as HTMLInputElement).value).toBe(todayIso());
    // Préavis : 3 mois ou 1 mois pour un bail vide.
    await user.selectOptions(dialog.getByLabelText("Préavis"), "1");
    fireEvent.change(dialog.getByLabelText("Départ réel (facultatif)"), { target: { value: dansJours(30) } });
    // Dépôt rendu : la date et le motif de retenue apparaissent selon le montant.
    await user.type(dialog.getByLabelText("Dépôt rendu"), "600");
    expect((dialog.getByLabelText("Rendu le") as HTMLInputElement).value).toBe(todayIso());
    await user.type(dialog.getByLabelText("Motif de la retenue"), "Peinture");
    // Changer de congé réinitialise le préavis ; le retirer efface la date.
    await user.selectOptions(dialog.getByLabelText("Congé"), "proprietaire");
    expect(dialog.queryByLabelText("Préavis")).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Congé"), "");
    expect(dialog.queryByLabelText("Reçu le")).toBeNull();
    await user.selectOptions(dialog.getByLabelText("Congé"), "locataire");
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).leases.find((l: Id) => l.id === b.id)).toMatchObject({ noticeBy: "locataire", noticeDate: todayIso(), depositReturned: 600, depositReason: "Peinture", actualEnd: dansJours(30) }));
    expect(await screen.findByText(/Dépôt rendu le/)).toBeTruthy();
    expect(screen.getByText("Retenue : Peinture")).toBeTruthy();
    expect(screen.getByText("Fin du bail")).toBeTruthy();
  });

  it("baux précédents listés à part : modification et suppression confirmée ; un bail qui chevauche est refusé", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    await bail(studio.id, { startDate: "2016-01-01", durationMonths: 36, actualEnd: "2018-12-31", renters: [{ lastName: "Ancien locataire" }] });
    const courant = await bail(studio.id, { renters: [{ lastName: "Locataire actuel" }] });
    pageBien(studio.id, "location");
    expect(await screen.findByText("Autres baux")).toBeTruthy();
    const ancien = screen.getByText(/Ancien locataire/).closest("tr") as HTMLElement;
    expect(texte(ancien)).toContain("01/01/2016");
    expect(texte(ancien)).toContain("31/12/2018");
    await user.click(within(ancien).getByRole("button", { name: "Modifier" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bail" }));
    // Prolonger l'ancien bail jusqu'au bail actuel : refusé, avec la raison.
    fireEvent.change(dialog.getByLabelText("Départ réel (facultatif)"), { target: { value: dansJours(-10) } });
    expect(await dialog.findByText(/Ce logement a déjà un bail sur cette période/)).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Valider" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(dialog.getByRole("button", { name: "Annuler" }));
    h.confirm = false;
    await user.click(within(ancien).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).leases).toHaveLength(2);
    h.confirm = true;
    await user.click(within(ancien).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).leases.map((l: Id) => l.id)).toEqual([courant.id]));
    // Le bail en cours se supprime aussi, sur confirmation : la carte repasse à « Aucun bail ».
    // Le premier « Supprimer » de la page est celui de la carte du bail, avant la carte des lots.
    h.confirm = false;
    await user.click(screen.getAllByRole("button", { name: "Supprimer" })[0]!);
    expect((await workspace()).leases).toHaveLength(1);
    h.confirm = true;
    await user.click(screen.getAllByRole("button", { name: "Supprimer" })[0]!);
    expect(await screen.findByText(/Aucun bail\. Ajoutez-en un/)).toBeTruthy();
  });

  it("loyers d'un bail ancien : rien n'est reçu sans pointage ; une année se valide d'un coup, un mois se détaille", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    const debut = +todayIso().slice(0, 4) - 2;
    const b = await bail(studio.id, { startDate: `${debut}-03-01`, durationMonths: 72 });
    pageBien(studio.id, "location");
    const annees = await screen.findByLabelText("Année des loyers");
    expect(within(annees).getAllByRole("option").length).toBeGreaterThanOrEqual(3);
    await user.selectOptions(annees, String(debut));
    expect(screen.getByText(`mars ${debut}`, { exact: false })).toBeTruthy();
    // Suivi strict : sans pointage, aucune quittance, et les mois échus sont « non reçus ».
    expect(screen.queryAllByRole("link", { name: /^Quittance de / })).toHaveLength(0);
    expect(screen.getAllByText("Non reçu")).toHaveLength(10);
    // Rattraper l'année : confirmation refusée, puis acceptée.
    h.confirm = false;
    await user.click(screen.getByRole("button", { name: `Valider l'année ${debut}` }));
    expect((await workspace()).rentPayments).toHaveLength(0);
    h.confirm = true;
    await user.click(screen.getByRole("button", { name: `Valider l'année ${debut}` }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(10));
    expect((await workspace()).rentPayments[0]).toMatchObject({ leaseId: b.id, month: `${debut}-03`, date: `${debut}-03-01`, amount: 850 });
    const quittances = await screen.findAllByRole("link", { name: /^Quittance de / });
    expect(quittances[0]!.getAttribute("href")).toMatch(new RegExp(`/impression/quittance/${b.id}/`));
    expect(screen.queryByRole("button", { name: `Valider l'année ${debut}` })).toBeNull();

    // L'année suivante : un paiement partiel par l'aide au logement, supprimé, puis le mois remis.
    await user.selectOptions(screen.getByLabelText("Année des loyers"), String(debut + 1));
    await user.click(screen.getByRole("button", { name: `Détail du loyer de janvier ${debut + 1}` }));
    let dialog = within(await screen.findByRole("dialog", { name: `Loyer de janvier ${debut + 1}` }));
    expect(dialog.getByText(/Rien n'a encore été pointé/)).toBeTruthy();
    expect((dialog.getByLabelText("Reçu le") as HTMLInputElement).value).toBe(`${debut + 1}-01-01`);
    const montant = dialog.getByLabelText("Montant reçu");
    await user.clear(montant);
    await user.type(montant, "300");
    await user.selectOptions(dialog.getByLabelText("Moyen"), "caf");
    await user.type(dialog.getByLabelText("Commentaire (facultatif)"), "Aide au logement");
    await user.click(dialog.getByRole("button", { name: "Enregistrer le paiement" }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(11));
    expect(await dialog.findByText("Reçu en partie")).toBeTruthy();
    expect(dialog.getByText(/Aide au logement \(CAF\) · Aide au logement/)).toBeTruthy();
    // Le reste dû est proposé pour le paiement suivant.
    expect((dialog.getByLabelText("Montant reçu") as HTMLInputElement).value).toMatch(/^550/);
    await user.click(dialog.getByRole("button", { name: `Supprimer le paiement du 01/01/${debut + 1}` }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(10));
    await user.click(dialog.getByLabelText(/Mois remis au locataire/));
    await waitFor(async () => expect((await workspace()).rentWaivers).toMatchObject([{ leaseId: b.id, month: `${debut + 1}-01` }]));
    await user.type(await dialog.findByLabelText("Motif de la remise"), "Travaux");
    await user.click(dialog.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).rentWaivers).toMatchObject([{ comment: "Travaux" }]));
    expect(dialog.queryByRole("button", { name: "Enregistrer le paiement" })).toBeNull();
    await user.click(dialog.getByLabelText(/Mois remis au locataire/));
    await waitFor(async () => expect((await workspace()).rentWaivers).toEqual([]));
    await user.keyboard("{Escape}");
    // Un mois se pointe aussi d'un clic, au reste dû.
    await user.click(screen.getByRole("button", { name: `Marquer reçu le loyer de février ${debut + 1}` }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(11));
    dialog = within(document.body);
    expect(dialog.getAllByText("Reçu").length).toBeGreaterThan(0);
  });

  it("nouveau bail : dépôt au-delà du plafond signalé, révision et rappels désactivables, type adapté", async () => {
    const user = userEvent.setup();
    const studio = await locatif();
    pageBien(studio.id, "location");
    expect(await screen.findByText(/Aucun bail\. Ajoutez-en un/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nouveau bail" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Nouveau bail" }));
    expect(dialog.queryByLabelText("Congé")).toBeNull();
    await user.type(dialog.getByLabelText("Loyer hors charges"), "800");
    // Le dépôt suit le plafond légal tant qu'il n'est pas saisi ; au-delà, un avertissement apparaît.
    const depot = dialog.getByLabelText("Dépôt de garantie (caution)");
    await user.clear(depot);
    await user.type(depot, "5000");
    expect(await dialog.findByText(/Au-delà du maximum légal de/)).toBeTruthy();
    // Bail vide : la révision annuelle et son trimestre de référence se règlent ; bail mobilité : plus de révision ni de dépôt.
    expect(dialog.getByLabelText("Trimestre de référence de l'indice")).toBeTruthy();
    await user.click(dialog.getByLabelText("Le bail prévoit une révision annuelle du loyer"));
    expect(dialog.queryByLabelText("Trimestre de référence de l'indice")).toBeNull();
    await user.click(dialog.getByLabelText("Le bail prévoit une révision annuelle du loyer"));
    await user.selectOptions(dialog.getByLabelText("Trimestre de référence de l'indice"), "3");
    await user.click(dialog.getByLabelText(/Me rappeler les échéances de ce bail/));
    // Locataires : une ligne vide au départ ; une ligne commencée sans nom bloque l'enregistrement.
    await user.type(dialog.getByLabelText("E-mail (facultatif)"), "locataire@example.org");
    expect(await dialog.findByText(/Indiquez le prénom ou le nom de chaque locataire/)).toBeTruthy();
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(dialog.getByLabelText("Prénom"), "Camille");
    await user.type(dialog.getByLabelText("Nom"), "Fictive");
    // Une deuxième ligne laissée vide est ignorée.
    await user.click(dialog.getByRole("button", { name: "Ajouter un locataire" }));
    await user.click(dialog.getByRole("button", { name: "Ajouter un locataire" }));
    await user.click(dialog.getByRole("button", { name: "Retirer le locataire 3" }));
    expect(dialog.getAllByLabelText("Prénom")).toHaveLength(2);
    await user.click(dialog.getByRole("button", { name: "Ajouter une garantie" }));
    await user.click(dialog.getByRole("button", { name: "Retirer la garantie 1" }));
    expect(dialog.getByText(/Aucune garantie/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Ajouter une garantie" }));
    await user.selectOptions(dialog.getByLabelText("Type"), "visale");
    await user.type(dialog.getByLabelText("Organisme"), "Visale (fictif)");
    await user.type(dialog.getByLabelText("Propriétaire (facultatif)"), "Propriétaire fictif");
    await user.type(dialog.getByLabelText("Adresse du propriétaire (facultative)"), "1 rue Fictive");
    fireEvent.change(dialog.getByLabelText("Assurance du locataire valable jusqu'au"), { target: { value: dansJours(90) } });
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).leases).toMatchObject([{ propertyId: studio.id, kind: "vide", rent: 800, deposit: 5000, irlQuarter: 3, reminders: false, landlord: "Propriétaire fictif", landlordAddress: "1 rue Fictive", revisable: true }]));
    const ws = await workspace();
    expect(ws.renters).toMatchObject([{ firstName: "Camille", lastName: "Fictive", email: "locataire@example.org" }]);
    expect(ws.leaseGuarantees).toMatchObject([{ kind: "visale", name: "Visale (fictif)" }]);
    expect(ws.lots).toMatchObject([{ propertyId: studio.id, name: "Logement", kind: "logement" }]);
  });

  it("changer le type d'un bail avec congé du propriétaire efface ce congé, impossible pour un bail mobilité", async () => {
    const user = userEvent.setup();
    const studio = await locatif({ rentalMode: "meuble" });
    const b = await bail(studio.id, { kind: "meuble", durationMonths: 12 });
    pageBien(studio.id, "location");
    await user.click(await screen.findByRole("button", { name: "Modifier ou donner congé" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bail" }));
    await user.selectOptions(dialog.getByLabelText("Congé"), "proprietaire");
    expect(dialog.getByLabelText("Reçu le")).toBeTruthy();
    await user.selectOptions(dialog.getByLabelText("Type de bail"), "mobilite");
    expect((dialog.getByLabelText("Congé") as HTMLSelectElement).value).toBe("");
    expect(dialog.queryByRole("option", { name: "Donné par le propriétaire" })).toBeNull();
    expect(dialog.getByText(/Interdit pour un bail mobilité|Au-delà du maximum légal/)).toBeTruthy();
    // Bail mobilité : pas de révision annuelle proposée.
    expect(dialog.queryByLabelText("Le bail prévoit une révision annuelle du loyer")).toBeNull();
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).leases.find((l: Id) => l.id === b.id)).toMatchObject({ kind: "mobilite", noticeBy: null, noticeDate: null }));
  });
});

describe("Bien : lots et colocation par chambre", () => {
  it("chambres ajoutées une à une, un bail par chambre, locataire repris, lot loué archivé plutôt que supprimé", async () => {
    const user = userEvent.setup();
    const maison = await locatif({ name: "Maison", rentalMode: "chambres" });
    pageBien(maison.id, "location");
    expect(await screen.findByText("Ajoutez les chambres du bien pour y rattacher leurs baux.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nouveau bail" })).toBeNull();

    // Deux chambres : la nature et le nom sont proposés, le loyer espéré est facultatif.
    await user.click(screen.getByRole("button", { name: "Ajouter un lot" }));
    let lotDialog = within(await screen.findByRole("dialog", { name: "Nouveau lot" }));
    expect((lotDialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Chambre 1");
    await user.type(lotDialog.getByLabelText("Loyer espéré (facultatif)"), "450");
    await user.type(lotDialog.getByLabelText("Surface en m² (facultative)"), "12");
    await user.click(lotDialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).lots).toMatchObject([{ name: "Chambre 1", kind: "chambre", targetRent: 450, surface: 12 }]));
    await user.click(screen.getByRole("button", { name: "Ajouter un lot" }));
    lotDialog = within(await screen.findByRole("dialog", { name: "Nouveau lot" }));
    expect((lotDialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Chambre 2");
    // Changer de nature renomme un lot dont le nom n'a pas été touché.
    await user.selectOptions(lotDialog.getByLabelText("Nature"), "parking");
    expect((lotDialog.getByLabelText("Nom") as HTMLInputElement).value).toBe("Parking ou box");
    await user.selectOptions(lotDialog.getByLabelText("Nature"), "chambre");
    await user.click(lotDialog.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText("Bail · Chambre 2")).toBeTruthy();
    expect(screen.getByText("Bail · Chambre 1")).toBeTruthy();
    expect(screen.getAllByText("Jamais loué")).toHaveLength(2);

    // Bail étudiant sur la première chambre.
    await user.click(screen.getAllByRole("button", { name: "Nouveau bail" })[0]!);
    let dialog = within(await screen.findByRole("dialog", { name: "Nouveau bail · Chambre 1" }));
    await user.selectOptions(dialog.getByLabelText("Type de bail"), "etudiant");
    await user.type(dialog.getByLabelText("Loyer hors charges"), "450");
    await user.type(dialog.getByLabelText("Prénom"), "Alice");
    await user.type(dialog.getByLabelText("Nom"), "Fictive");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).leases).toHaveLength(1));
    expect(await screen.findByText("Alice Fictive")).toBeTruthy();
    expect(screen.getByText("Loué")).toBeTruthy();

    // Même locataire, repris, sur la seconde chambre.
    await user.click(screen.getAllByRole("button", { name: "Nouveau bail" })[1]!);
    dialog = within(await screen.findByRole("dialog", { name: "Nouveau bail · Chambre 2" }));
    await user.type(dialog.getByLabelText("Loyer hors charges"), "420");
    await user.selectOptions(dialog.getByLabelText("Reprendre un locataire déjà saisi"), dialog.getByRole("option", { name: "Alice Fictive" }));
    expect(dialog.getAllByLabelText("Prénom")).toHaveLength(1);
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).leaseRenters).toHaveLength(2));
    const ws = await workspace();
    expect(ws.renters).toHaveLength(1);
    expect(new Set(ws.leases.map((l: { lotId: string }) => l.lotId)).size).toBe(2);
    // Plusieurs lots loués : la liste des loyers dit de quel lot il s'agit.
    await waitFor(() => expect(screen.getAllByRole("columnheader", { name: "Lot" })).toHaveLength(2));

    // Un lot loué ne se supprime pas : on propose de l'archiver.
    // La ligne du lot, dans la carte des lots (la liste des loyers cite aussi la chambre).
    const ligneDuLot = () => screen.getAllByText("Chambre 1").map((x) => x.closest("tr")).find((tr) => tr && within(tr).queryByRole("button", { name: "Supprimer" })) as HTMLElement;
    const ligne = ligneDuLot();
    h.confirm = true;
    await user.click(within(ligne).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).lots.find((l: { name: string }) => l.name === "Chambre 1")).toMatchObject({ archived: true }));
    await user.click(await screen.findByRole("button", { name: "Afficher les lots archivés (1)" }));
    expect(screen.getByText("Archivé")).toBeTruthy();
    const archivee = ligneDuLot();
    await user.click(within(archivee).getByRole("button", { name: "Modifier" }));
    lotDialog = within(await screen.findByRole("dialog", { name: "Modifier chambre 1" }));
    expect((lotDialog.getByLabelText("Nature") as HTMLSelectElement).disabled).toBe(true);
    await user.click(lotDialog.getByLabelText(/Archiver/));
    await user.click(lotDialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).lots.every((l: { archived: boolean }) => !l.archived)).toBe(true));
  });

  it("un lot jamais loué se supprime ; le mode de location se choisit sur la fiche du bien", async () => {
    const user = userEvent.setup();
    const maison = await locatif({ name: "Maison" });
    await rpc("lots.upsert", { propertyId: maison.id, name: "Cave", kind: "cave" });
    pageBien(maison.id, "location");
    const ligne = (await screen.findAllByText("Cave"))[0]!.closest("tr") as HTMLElement;
    h.confirm = true;
    await user.click(within(ligne).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).lots).toEqual([]));
    await user.click(screen.getByRole("button", { name: /Modifier$/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Modifier le bien" }));
    await user.selectOptions(dialog.getByLabelText("Mode de location"), "colocation");
    expect(dialog.getByText("Un seul bail signé par tous les colocataires.")).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === maison.id)).toMatchObject({ rentalMode: "colocation" }));
    expect(await screen.findByText(/Colocation, un bail pour tous\./)).toBeTruthy();
  });
});

describe("Bien : finances, fiche descriptive et documents", () => {
  it("estimations, dépenses, revenus et documents du bien sont repris dans les onglets et la fiche", async () => {
    const user = userEvent.setup();
    const studio = await locatif({ city: "Ville fictive", surface: 30, dpe: "D", dpeDate: "2024-01-10" });
    await bail(studio.id);
    await rpc("propertyValues.add", { propertyId: studio.id, date: "2025-01-01", value: 125_000 });
    await rpc("propertyExpenses.upsert", { propertyId: studio.id, date: "2025-02-01", category: "assurance", amount: 300, label: "Assurance propriétaire" });
    await rpc("propertyIncomes.upsert", { propertyId: studio.id, date: "2025-03-01", category: "indemnite", amount: 150, label: "Indemnité de sortie" });
    await rpc("propertyDocuments.upsert", { propertyId: studio.id, kind: "diagnostic", label: "Diagnostic électricité", date: "2024-02-01", expiresOn: dansAns(1) });
    pageBien(studio.id, "finances");
    expect(await screen.findByText("Valeur dans le temps")).toBeTruthy();
    expect(screen.getAllByText("Assurance propriétaire").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Indemnité de sortie").length).toBeGreaterThan(0);
    expect(screen.getByText("Résultats par année")).toBeTruthy();

    // La fiche reprend les documents ; le bouton « Fermer » la referme.
    await user.click(screen.getByRole("button", { name: "Fiche du bien" }));
    const fiche = within(await screen.findByRole("dialog", { name: "Fiche du bien" }));
    expect(fiche.getByText("Diagnostic électricité")).toBeTruthy();
    expect(fiche.getByRole("button", { name: "Modifier la fiche" })).toBeTruthy();
    // Fiche descriptive : copropriété (syndic), note climat, alertes DPE.
    await user.click(fiche.getByRole("button", { name: "Modifier la fiche" }));
    const form = within(screen.getAllByRole("dialog").at(-1)!);
    expect(form.queryByLabelText("Syndic")).toBeNull();
    await user.click(form.getByLabelText("En copropriété"));
    await user.type(form.getByLabelText("Syndic"), "Syndic fictif");
    await user.click(form.getByLabelText("Parking"));
    await user.click(form.getByLabelText("Cave"));
    await user.selectOptions(form.getByLabelText("Note DPE"), "B");
    await user.selectOptions(form.getByLabelText("Note climat (GES)"), "C");
    await user.click(form.getByLabelText(/M'alerter avant l'expiration du DPE/));
    await user.click(form.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === studio.id)).toMatchObject({ coOwnership: true, syndic: "Syndic fictif", parking: true, cellar: true, dpe: "B", ges: "C", dpeReminders: false }));
    expect(await fiche.findByText("Oui, syndic Syndic fictif")).toBeTruthy();
    expect(fiche.getByText("Alertes")).toBeTruthy();
    // Décocher la copropriété efface le syndic.
    await user.click(fiche.getByRole("button", { name: "Modifier la fiche" }));
    const second = within(screen.getAllByRole("dialog").at(-1)!);
    await user.click(second.getByLabelText("En copropriété"));
    expect(second.queryByLabelText("Syndic")).toBeNull();
    await user.click(second.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).properties.find((p: Id) => p.id === studio.id)).toMatchObject({ coOwnership: false, syndic: "" }));
    await user.click(fiche.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Fiche du bien" })).toBeNull());
  });
});
