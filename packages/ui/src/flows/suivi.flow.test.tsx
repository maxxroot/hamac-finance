import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedDemo } from "@hamac/backend";
import { testBackend } from "@hamac/backend/testkit";
import type { Account } from "@hamac/core";
import { todayIso } from "@/shared/lib/numbers";
import { ToastProvider } from "@/shared/lib/toast";
import { Impots } from "@/features/tax/pages/Impots";
import { TransactionDialog, type TxPreset } from "@/features/entry/dialogs/TransactionDialog";
import { useWorkspaceIndex } from "@/shared/lib/workspace";
import { AddTransactionButton, EmptyAccount } from "@/features/entry/components/TransactionButton";
import { EditAccountButton } from "@/features/entry/components/AccountButtons";
import { Movements } from "@/features/entry/components/Movements";
import { PositionEvolution, EvolutionToggle } from "@/shared/components/AccountEvolution";
import { Projets } from "@/features/planning/pages/Projets";
import { Historique } from "@/features/analysis/pages/Historique";
import { Declaration } from "@/features/tax/pages/Declaration";
import { Performance } from "@/features/analysis/pages/Performance";
import { Simulateurs } from "@/features/planning/pages/Simulateurs";
import { decodeState, encodeState } from "@/features/planning/lib/simulateurs";
import { Compteurs } from "@/features/tax/pages/Compteurs";
import { Journal } from "@/features/journal/pages/Journal";
import { Projection } from "@/features/planning/pages/Projection";
import { Comptes } from "@/features/accounts/pages/Comptes";
import { Versements } from "@/features/journal/pages/Versements";
import { TableauDeBord } from "@/features/dashboard/pages/TableauDeBord";

/**
 * Parcours réels du suivi : tableau de bord, synthèse, journal, projection, impôts…
 * L'interface parle au vrai backend, sur une base en mémoire. Montants et noms fictifs.
 */
interface FakeChart {
  option: Record<string, any>;
  handlers: Record<string, (e: unknown) => void>;
  resizes: number;
  disposed: boolean;
}
const h = vi.hoisted(() => ({
  backend: null as unknown as import("@hamac/backend").Backend,
  charts: [] as FakeChart[],
  resizers: [] as Array<() => void>,
  download: vi.fn(),
}));

vi.mock("@/shared/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
// Pas de vrai téléchargement ni de sélecteur de fichier sous jsdom ; `toCsv`, pur, reste le vrai.
vi.mock("@/shared/lib/files", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/shared/lib/files")>()), downloadText: h.download }));

// ECharts demande un vrai navigateur (mesure du conteneur, dessin SVG). On le remplace par un faux
// qui garde l'option reçue : on vérifie ce que la page y met et on exécute ses fonctions de mise en forme.
vi.mock("echarts/core", () => ({
  use: () => undefined,
  init: () => {
    const chart: FakeChart = { option: {}, handlers: {}, resizes: 0, disposed: false };
    h.charts.push(chart);
    return {
      setOption: (o: Record<string, any>) => {
        chart.option = o;
      },
      on: (name: string, fn: (e: unknown) => void) => {
        chart.handlers[name] = fn;
      },
      resize: () => {
        chart.resizes += 1;
      },
      dispose: () => {
        chart.disposed = true;
      },
    };
  },
}));
vi.mock("echarts/charts", () => ({ BarChart: {}, LineChart: {}, PieChart: {} }));
vi.mock("echarts/components", () => ({ GridComponent: {}, LegendComponent: {}, MarkLineComponent: {}, TooltipComponent: {} }));
vi.mock("echarts/renderers", () => ({ SVGRenderer: {} }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
const workspace = () => rpc<any>("workspace.load");

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
  h.charts.length = 0;
  h.resizers.length = 0;
  h.download.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        h.resizers.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  h.backend.close();
});

const fieldOf = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
/** Remplace le contenu d'un champ numérique et valide en le quittant. */
async function typeInto(user: ReturnType<typeof userEvent.setup>, field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
  await user.tab();
}
const year = +todayIso().slice(0, 4);
const month = +todayIso().slice(5, 7);
/** Le 28 du mois situé `n` mois après le mois en cours : toujours valide, et toujours dans le futur (n ≥ 1). */
const inMonths = (n: number) => {
  const m = month - 1 + n;
  return `${year + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-28`;
};

/** Dernier graphique dessiné qui contient une série de ce nom. */
const chartWith = (serie: string) => [...h.charts].reverse().find((c) => (c.option.series ?? []).some((s: { name?: string }) => s.name === serie));

describe("tableau de bord", () => {
  it("sans compte : l'accueil propose de commencer", async () => {
    show(<TableauDeBord />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });

  it("jeu de démonstration : chiffres, enveloppes, allocation, projection et graphique d'évolution", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<TableauDeBord />);
    expect(await screen.findByRole("heading", { name: "Tableau de bord" }, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/départ visé à 64 ans/)).toBeTruthy();
    // Biens et crédits au jeu de démonstration : le patrimoine est dit « net ».
    expect(screen.getByText("Patrimoine net")).toBeTruthy();
    for (const label of ["Versé net", "Gain / perte", "Rendement annualisé", "Épargne par mois", "Mes comptes", "Allocation", "À regarder"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText("Immobilier")).toBeTruthy();
    expect(screen.getByText("Crédits")).toBeTruthy();
    const envelopes = screen.getByText("Mes comptes").closest("div.rounded-2xl") as HTMLElement;
    expect(within(envelopes).getByText("LEP")).toBeTruthy();
    expect(within(envelopes).getByText("PEA")).toBeTruthy();
    // Plan de retraite : la carte de projection est là, avec son lien vers le simulateur.
    expect(screen.getByText(/Projection à 64 ans/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Simuler" }).getAttribute("href")).toBe("/projection");
    expect(screen.getByText(/Fourchette du patrimoine en/)).toBeTruthy();

    // Le graphique d'évolution reçoit les deux courbes, et la période se change au clic.
    await waitFor(() => expect(chartWith("Valeur totale")).toBeTruthy());
    const before = chartWith("Valeur totale")!.option.series.find((s: { name: string }) => s.name === "Valeur totale").data.length;
    await user.click(screen.getByRole("button", { name: "Tout" }));
    const after = chartWith("Valeur totale")!.option.series.find((s: { name: string }) => s.name === "Valeur totale").data.length;
    expect(after).toBeGreaterThanOrEqual(before);
    expect(screen.getByRole("button", { name: "Tout" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "Historique" }).getAttribute("href")).toBe("/historique");
  }, 90_000);

  it("graphique d'évolution : info-bulle, échelle en milliers, légende cliquable, redimensionnement et nettoyage", async () => {
    await seedDemo(h.backend);
    const view = show(<TableauDeBord />);
    await screen.findByRole("heading", { name: "Tableau de bord" }, { timeout: 30_000 });
    await waitFor(() => expect(chartWith("Valeur totale")).toBeTruthy());
    const chart = chartWith("Valeur totale")!;
    const names = () => chart.option.series.map((s: { name: string }) => s.name);
    // Les deux courbes et la zone de gain qui les sépare.
    expect(names()).toEqual(["base", "écart", "Valeur totale", "Montant investi"]);
    const tip = chart.option.tooltip.formatter([{ dataIndex: 1 }]) as string;
    expect(tip).toContain("Valeur totale");
    expect(tip).toContain("Montant investi");
    expect(tip).toMatch(/Gain|Perte/);
    // Au-dessus de 20 000 €, l'axe parle en milliers.
    expect(chart.option.yAxis.axisLabel.formatter(25_000)).toBe("25 k€");

    // Un clic sur la légende masque la valeur totale : plus de zone de gain entre les courbes, ni dans la bulle.
    act(() => chart.handlers.legendselectchanged({ selected: { "Valeur totale": false, "Montant investi": true } }));
    await waitFor(() => expect(names()).toEqual(["Valeur totale", "Montant investi"]));
    expect(chart.option.legend.selected["Valeur totale"]).toBe(false);
    expect(chart.option.tooltip.formatter([{ dataIndex: 0 }])).not.toContain("Gain");
    // Tout masqué : l'échelle ne se fonde plus sur rien, et reprend le format court.
    act(() => chart.handlers.legendselectchanged({ selected: { "Valeur totale": false, "Montant investi": false } }));
    await waitFor(() => expect(chart.option.legend.selected["Montant investi"]).toBe(false));
    expect(chart.option.yAxis.axisLabel.formatter(25_000)).not.toContain("k€");
    expect(chart.option.tooltip.formatter([{ dataIndex: 0 }])).not.toContain("Montant investi");

    // Le conteneur change de taille : le graphique suit ; la page se ferme : il est libéré.
    const resizes = chart.resizes;
    h.resizers.forEach((r) => r());
    expect(chart.resizes).toBeGreaterThan(resizes);
    view.unmount();
    expect(h.charts.every((c) => c.disposed)).toBe(true);
  }, 90_000);

  it("gestion de patrimoine : pas de projection de retraite, mais les actifs et les dettes", async () => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, goal: "patrimoine" } });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("transactions.upsert", { date: "2025-01-10", type: "apport_initial", accountId: livret.id, amount: 12_000 });
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "residence_principale", name: "Maison fictive", value: 250_000, purchasePrice: 220_000, notaryFees: 15_000 });
    await rpc("loans.upsert", { kind: "immobilier", name: "Prêt fictif", propertyId: bien.id, principal: 150_000, rate: 0.02, termMonths: 240, firstPayment: "2024-01-05" });
    await rpc("otherAssets.upsert", { kind: "vehicule", name: "Voiture fictive", value: 9_000 });
    show(<TableauDeBord />);
    expect(await screen.findByText("Gestion de patrimoine", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.queryByText(/Projection à/)).toBeNull();
    const card = screen.getByText("Actifs et dettes").closest("div.rounded-2xl") as HTMLElement;
    for (const label of ["Patrimoine financier", "Immobilier", "Autres biens", "Crédits restant dus", "Patrimoine net", "Mensualités"]) expect(within(card).getByText(label)).toBeTruthy();
    // « Autres biens » apparaît aussi dans le détail du patrimoine net.
    expect(screen.getAllByText("Autres biens").length).toBe(2);
    expect(screen.getAllByText("Patrimoine net").length).toBeGreaterThan(0);
  });

  it("gestion de patrimoine sans bien ni cible : cible à régler, livrets seuls et alertes éventuelles", async () => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, goal: "patrimoine" }, targets: ws.params.targets.map((t: object) => ({ ...t, inAllocation: false, target: 0 })) });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("accounts.upsert", { kind: "cto", name: "Compte vide fictif" });
    await rpc("transactions.upsert", { date: "2025-01-10", type: "apport_initial", accountId: livret.id, amount: 9_000 });
    show(<TableauDeBord />);
    expect(await screen.findByText(/Réglez votre cible dans/, {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Paramètres › Répartition/ }).getAttribute("href")).toContain("/parametres?onglet=");
    expect(screen.getByText("Patrimoine financier")).toBeTruthy();
    expect(screen.getByText("Précaution")).toBeTruthy();
    // Un seul compte garni : une seule ligne dans les enveloppes.
    const envelopes = screen.getByText("Mes comptes").closest("div.rounded-2xl") as HTMLElement;
    expect(within(envelopes).getByText("Livret fictif")).toBeTruthy();
    expect(within(envelopes).queryByText("Compte vide fictif")).toBeNull();
    expect(screen.queryByText("Actifs et dettes")).toBeNull();
  });

  it("comptes sans argent : les enveloppes invitent à saisir les apports ; l'évolution attend un mois d'historique", async () => {
    await rpc("accounts.upsert", { kind: "cto", name: "Compte vide fictif" });
    show(<TableauDeBord />);
    expect(await screen.findByText("Saisissez vos apports pour voir vos comptes.", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText("L'évolution apparaîtra après un mois d'historique.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Détail" }).getAttribute("href")).toBe("/comptes");
  });

  it("à un an du départ : « 1 an de versements restants » au singulier", async () => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, birthYear: year - 63, retirementAge: 64, securisationAge: 57 } });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("transactions.upsert", { date: `${year - 1}-01-10`, type: "apport_initial", accountId: livret.id, amount: 5_000 });
    show(<TableauDeBord />);
    expect(await screen.findByText(/63 ans, départ visé à 64 ans \(\d{4}\), 1 an de versements restants/, {}, { timeout: 30_000 })).toBeTruthy();
  });

  it("alertes : les cinq premières, puis le reste sur demande", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<TableauDeBord />);
    const review = (await screen.findByText("À regarder", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    await user.click(within(review).getByRole("button", { name: /Voir les \d+ autres?/ }));
    expect(within(review).getByRole("button", { name: "Réduire" })).toBeTruthy();
    expect(within(review).getAllByRole("listitem").length).toBeGreaterThan(5);
    await user.click(within(review).getByRole("button", { name: "Réduire" }));
    expect(within(review).getAllByRole("listitem").length).toBe(5);
  });

  it("projets en cours : avancement, retard ou avance, versement mensuel nécessaire", async () => {
    const compte = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    await rpc("transactions.upsert", { date: "2025-01-10", type: "apport_initial", accountId: compte.id, amount: 10_000 });
    const goal = (name: string, target: number, startDate: string, targetDate: string, value = 0.5) =>
      rpc("goals.upsert", { name, target, startDate, targetDate, rate: 0, allocations: [{ accountId: compte.id, mode: "pourcentage", value }] });
    // Début récent : l'effort attendu est faible, le projet est en avance. Début ancien et grosse somme : en retard.
    await goal("Voyage fictif", 12_000, `${year}-01-01`, `${year + 2}-06-15`);
    await goal("Travaux fictifs", 90_000, `${year - 3}-06-15`, `${year + 1}-06-15`, 0.2);
    await goal("Cadeau fictif", 1_000, `${year - 1}-06-15`, `${year + 1}-06-15`, 1);
    show(<TableauDeBord />);
    const card = (await screen.findByText("Projets en cours", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Projets" }).getAttribute("href")).toBe("/projets");
    expect(within(card).getByText("Voyage fictif")).toBeTruthy();
    expect(within(card).getByText(/en avance/)).toBeTruthy();
    expect(within(card).getByText(/en retard/)).toBeTruthy();
    // Le projet atteint n'a plus rien à mettre de côté : une seule ligne « par mois » en moins.
    expect(within(card).getAllByText(/par mois/).length).toBe(2);
    expect(within(card).getAllByRole("img").map((b) => b.getAttribute("aria-label"))).toContain("100 % réunis");
  });
});

describe("mes comptes", () => {
  it("sans compte : l'accueil ; avec le jeu de démonstration : tableau trié, détail d'un compte, allocation et livrets", async () => {
    const empty = show(<Comptes />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    empty.unmount();

    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<Comptes />);
    expect(await screen.findByText("Chaque compte et contrat", { exact: false }, { timeout: 30_000 })).toBeTruthy();
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    const firstRow = () => within(table).getAllByRole("row")[1]!.textContent ?? "";
    // Les types de compte sont rappelés sous le nom quand il diffère.
    expect(within(table).getByText("Total")).toBeTruthy();
    await user.click(within(table).getByRole("button", { name: "Compte ou contrat" }));
    expect(firstRow()).toMatch(/^Assurance-vie/);
    await user.click(within(table).getByRole("button", { name: "Compte ou contrat" }));
    expect(firstRow()).toMatch(/^Plateforme E/);
    for (const col of ["Rôle", "Versement mensuel", "Valeur", "Part du patrimoine", "Versé net", "Gain / perte", "Gain (%)"]) {
      await user.click(within(table).getByRole("button", { name: col }));
      expect(within(table).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }

    // Un clic sur une ligne ouvre l'évolution du compte, avec une courbe par titre.
    await user.click(within(table).getByText("PEA"));
    await waitFor(() => expect(within(table).getAllByText(/Valeur totale/).length).toBeGreaterThan(0));
    expect(within(table).getByText(/Montant investi/)).toBeTruthy();
    await waitFor(() => expect(h.charts.some((c) => c.option.series?.some((x: { name: string }) => x.name === "ETF PEA S&P 500"))).toBe(true));
    await user.click(within(table).getByRole("button", { name: "3M" }));
    expect(within(table).getByRole("button", { name: "3M" }).getAttribute("aria-pressed")).toBe("true");
    await user.click(within(table).getByText("PEA"));
    expect(within(table).queryByText(/Montant investi/)).toBeNull();

    // Évolution de toutes les enveloppes : plus de cinq courbes, la légende défile et les couleurs reviennent en tirets.
    const envelopes = [...h.charts].reverse().find((c) => c.option.legend?.type === "scroll")!;
    expect(envelopes).toBeTruthy();
    const tracks = envelopes.option.series.filter((x: { lineStyle?: { type?: string } }) => x.lineStyle?.type === "dashed");
    expect(tracks.length).toBeGreaterThan(1);
    const tip = envelopes.option.tooltip.formatter([{ dataIndex: envelopes.option.xAxis.data.length - 1 }]) as string;
    expect(tip).toContain("Valeur totale");
    expect(tip).toContain("PEA");
    // Avec des courbes par enveloppe, l'axe part de zéro.
    expect(envelopes.option.yAxis.min).toBe(0);

    // Allocation de la partie investie et état des livrets.
    expect(screen.getByText("Allocation de la partie investie")).toBeTruthy();
    expect(screen.getAllByText(/Renforcer|Alléger/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Livrets dans la fourchette du plan/)).toBeTruthy();
  }, 90_000);

  it("livrets sous le plancher, puis au-dessus du plafond", async () => {
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("transactions.upsert", { date: "2025-01-10", type: "apport_initial", accountId: livret.id, amount: 4_000 });
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, livrets: { ...ws.params.livrets, floor: 7_500, ceiling: 15_000 } });
    const first = show(<Comptes />);
    expect(await screen.findByText(/Livrets sous le plancher/, {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/reconstituer avant tout autre placement/)).toBeTruthy();
    first.unmount();

    await rpc("params.update", { ...ws.params, livrets: { ...ws.params.livrets, floor: 500, ceiling: 1_000 } });
    show(<Comptes />);
    expect(await screen.findByText(/Livrets au-dessus du plafond/, {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/transférer/)).toBeTruthy();
  });

  it("concentration : lignes, établissements, émetteurs et plateformes en difficulté, liste des titres dépliable", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    const accounts = (await workspace()).accounts as Array<{ id: string; name: string }>;
    // Un projet de crowdlending en retard : sa part remonte sur la plateforme.
    await rpc("crowdProjects.upsert", { accountId: accounts.find((a) => a.name.startsWith("Plateforme E"))!.id, name: "Projet en retard fictif", amount: 700, rate: 0.1, startDate: `${year - 1}-05-10`, termMonths: 24, status: "retard", statusDate: `${year}-03-01` });
    // Plus de huit titres : la liste se replie sur les huit premiers.
    const pea = accounts.find((a) => a.name === "PEA")!;
    for (let i = 1; i <= 4; i++) {
      const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: `ETF fictif ${i}`, priceSource: "manuel" });
      await rpc("transactions.upsert", { date: "2025-06-10", type: "achat", accountId: pea.id, assetId: etf.id, amount: 100 * i, quantity: i });
    }
    show(<Comptes />);
    const card = (await screen.findByText("Concentration", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    for (const label of ["Première ligne", "Cinq premières lignes", "Patrimoine financier", "Au-delà du seuil"]) expect(within(card).getByText(label)).toBeTruthy();
    for (const block of ["Titres, tous comptes confondus", "Établissements", "Émetteurs d'obligations", "Plateformes de crowdlending"]) expect(within(card).getByText(block)).toBeTruthy();
    expect(within(card).getByText("Courtier A")).toBeTruthy();
    // Le projet en défaut du jeu de démonstration remonte sur la plateforme.
    expect(within(card).getByText(/^\d+ % en retard ou en défaut$/)).toBeTruthy();
    expect(within(card).getByText(/de projets en retard ou en défaut, soit/)).toBeTruthy();
    const lines = within(card).getByText("Titres, tous comptes confondus").closest("section") as HTMLElement;
    const before = within(lines).getAllByRole("listitem").length;
    expect(before).toBe(8);
    await user.click(within(lines).getByRole("button", { name: /Afficher les \d+ titres/ }));
    expect(within(lines).getAllByRole("listitem").length).toBeGreaterThan(before);
    await user.click(within(lines).getByRole("button", { name: "Afficher moins" }));
    expect(within(lines).getAllByRole("listitem").length).toBe(before);
  }, 90_000);

  it("concentration : un titre au-delà du seuil est signalé, et sans seuil les alertes sont coupées", async () => {
    const compte = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF unique fictif", priceSource: "manuel" });
    await rpc("transactions.upsert", { date: "2025-01-10", type: "apport_initial", accountId: compte.id, amount: 5_000 });
    await rpc("transactions.upsert", { date: "2025-01-11", type: "achat", accountId: compte.id, assetId: etf.id, amount: 5_000, quantity: 50 });
    const first = show(<Comptes />);
    const card = (await screen.findByText("Concentration", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    expect(within(card).getAllByText("au-delà du seuil").length).toBeGreaterThan(0);
    expect(within(card).getByText(/alerte au-delà de/)).toBeTruthy();
    first.unmount();

    const ws = await workspace();
    await rpc("params.update", { ...ws.params, alerts: { ...ws.params.alerts, concentrationMax: 0 } });
    show(<Comptes />);
    expect(await screen.findByText("alertes désactivées")).toBeTruthy();
  });
});

describe("compteurs et plafonds", () => {
  it("anciennetés, plafonds, assurance-vie et sources avec le jeu de démonstration", async () => {
    await seedDemo(h.backend);
    // Un PEA-PME sans date d'ouverture : la date est à renseigner.
    await rpc("accounts.upsert", { kind: "pea_pme", name: "PEA-PME sans date fictif" });
    show(<Compteurs />);
    expect(await screen.findByText("Compteurs et plafonds", {}, { timeout: 30_000 })).toBeTruthy();
    const seniority = screen.getByText("Ancienneté des contrats").closest("div.rounded-2xl") as HTMLElement;
    expect(within(seniority).getByText(/Atteints le/)).toBeTruthy();
    expect(within(seniority).getByText(/dans \d+ mois/)).toBeTruthy();
    expect(within(seniority).getByText("date d'ouverture à renseigner")).toBeTruthy();
    const ceilings = screen.getByText("Plafonds de versement").closest("div.rounded-2xl") as HTMLElement;
    expect(within(ceilings).getByText("Versements sur le PEA")).toBeTruthy();
    expect(within(ceilings).getAllByRole("img").length).toBeGreaterThan(1);
    expect(screen.getByText("Abattement annuel sur les gains retirés")).toBeTruthy();
    expect(screen.getByText("Encore possible sans impôt sur le revenu")).toBeTruthy();
    expect(screen.getByText(/Règles vérifiées le/)).toBeTruthy();
    expect(screen.getAllByRole("link").some((a) => a.getAttribute("href")?.includes("service-public.gouv.fr"))).toBe(true);
  }, 90_000);

  it("sans PEA, assurance-vie ni livret : des cartes vides qui expliquent quoi faire", async () => {
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    show(<Compteurs />);
    expect(await screen.findByText("Ni PEA ni assurance-vie.", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/Aucun compte plafonné/)).toBeTruthy();
    expect(screen.queryByText("Encore possible sans impôt sur le revenu")).toBeNull();
    expect(screen.getByText("Aucune donation notée.")).toBeTruthy();
  });

  it("donations : noter, relire dans les compteurs, corriger puis supprimer", async () => {
    const user = userEvent.setup();
    show(<Compteurs />);
    await user.click(await screen.findByRole("button", { name: /Noter une donation/ }, { timeout: 30_000 }));
    const dialog = await screen.findByRole("dialog", { name: "Noter une donation" });
    const save = within(dialog).getByRole("button", { name: "Enregistrer" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    // Le libellé suit le sens de la donation.
    expect(within(dialog).getByLabelText("Bénéficiaire")).toBeTruthy();
    await user.selectOptions(within(dialog).getByLabelText("Sens"), "recue");
    expect(within(dialog).getByLabelText("Donateur")).toBeTruthy();
    await user.selectOptions(within(dialog).getByLabelText("Sens"), "faite");
    await user.type(within(dialog).getByLabelText("Bénéficiaire"), "Camille fictive");
    expect(save.disabled).toBe(true);
    await user.type(within(dialog).getByLabelText("Montant"), "120000");
    await user.tab();
    expect(within(dialog).getByText(/Abattement : 100\s000 € tous les 15 ans/)).toBeTruthy();
    await user.type(within(dialog).getByLabelText("Commentaire"), "acte fictif");
    await user.click(save);
    expect(await screen.findByText("Donation notée")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).gifts).toMatchObject([{ person: "Camille fictive", amount: 120_000, relation: "enfant", direction: "faite", comment: "acte fictif" }]));

    // 120 000 € pour 100 000 € d'abattement : 20 000 € restent imposables.
    const gifts = screen.getByText("Donations").closest("div.rounded-2xl") as HTMLElement;
    expect(within(gifts).getByText("Vous lui avez donné · enfant")).toBeTruthy();
    expect(within(gifts).getAllByText(/Camille fictive/).length).toBe(2);
    expect(within(gifts).getByText("20 000 €")).toBeTruthy();

    await user.click(within(gifts).getByRole("button", { name: "Modifier" }));
    const edit = await screen.findByRole("dialog", { name: "Modifier la donation" });
    await user.selectOptions(within(edit).getByLabelText("Lien du bénéficiaire avec le donateur"), "autre");
    const amount = within(edit).getByLabelText("Montant");
    await user.clear(amount);
    await user.type(amount, "5000");
    await user.tab();
    await user.click(within(edit).getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText("Donation mise à jour")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).gifts).toMatchObject([{ amount: 5_000, relation: "autre" }]));
    // Sans lien familial, pas de don d'argent exonéré à suivre.
    expect(within(gifts).getByText("—", { selector: "td" })).toBeTruthy();

    await user.click(within(gifts).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Donation supprimée")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).gifts).toHaveLength(0));
    expect(screen.getByText("Aucune donation notée.")).toBeTruthy();
  });

  it("donation reçue : fermer sans enregistrer ne change rien", async () => {
    const user = userEvent.setup();
    show(<Compteurs />);
    await user.click(await screen.findByRole("button", { name: /Noter une donation/ }, { timeout: 30_000 }));
    const dialog = await screen.findByRole("dialog", { name: "Noter une donation" });
    await user.type(within(dialog).getByLabelText("Bénéficiaire"), "Quelqu'un");
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect((await workspace()).gifts).toHaveLength(0);
  });
});

describe("projection", () => {
  it("sans compte : l'accueil ; en gestion de patrimoine : la projection de retraite est expliquée", async () => {
    const first = show(<Projection />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    first.unmount();

    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, goal: "patrimoine" } });
    show(<Projection />);
    expect(await screen.findByText(/pas de projection de retraite/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Paramètres › Plan/ }).getAttribute("href")).toBe("/parametres");
    expect(h.charts).toHaveLength(0);
  });

  it("jeu de démonstration : résultats, fourchette, graphique par classe, tableau année par année", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    // Une classe ajoutée à la projection avec son propre rendement : elle s'empile sous « Autres classes ».
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, targets: ws.params.targets.map((t: { key: string }) => (t.key === "crowdlending" ? { ...t, inAllocation: true, target: 0, expectedReturn: 0.05 } : t)) });
    show(<Projection />);
    expect(await screen.findByText(/^Patrimoine en \d{4}$/, {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/Jusqu'au départ en \d{4}/)).toBeTruthy();
    for (const label of ["Fourchette (8 chances sur 10)", "Argent versé d'ici là", /Revenu mensuel possible de 64 à 90 ans/, "Projection par classe d'actifs", "Dépenses imprévues"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText(/Après le départ : le capital investi pendant les retraits/)).toBeTruthy();
    expect(screen.getByText(/Modèle annuel simplifié/)).toBeTruthy();

    await waitFor(() => expect(chartWith("Fourchette basse (1 chance sur 10)")).toBeTruthy());
    const chart = chartWith("Fourchette basse (1 chance sur 10)")!;
    const names = chart.option.series.map((x: { name: string }) => x.name);
    expect(names).toEqual(expect.arrayContaining(["Livrets", "Obligations", "Autres classes", "Fourchette haute (1 chance sur 10)"]));
    expect(names).not.toContain("Scénario");
    // Mise en forme : axe en milliers d'euros, bulle en euros compacts.
    expect(chart.option.yAxis.axisLabel.formatter(250_000)).toBe("250 k€");
    expect(chart.option.yAxis.axisLabel.formatter(500)).toBe("500 €");
    expect(chart.option.tooltip.valueFormatter(12_345)).toMatch(/12/);

    // Le tableau complet se montre et se cache ; l'année de départ est surlignée.
    expect(screen.queryByText("Part actions cible")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Voir le tableau" }));
    expect(screen.getByText("Part actions cible")).toBeTruthy();
    expect(screen.getByText("€ d'aujourd'hui", { selector: "th" })).toBeTruthy();
    const retirement = screen.getAllByRole("row").find((r) => r.className.includes("bg-gold/10"));
    expect(retirement).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Masquer le tableau" }));
    expect(screen.queryByText("Part actions cible")).toBeNull();
  }, 90_000);

  it("simulateur « Et si… » : un scénario s'ajoute au plan, et « Revenir au plan » le referme", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<Projection />);
    expect(await screen.findByText("Et si…", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText("ne modifie pas le plan")).toBeTruthy();
    const reset = () => screen.getByRole("button", { name: /Revenir au plan/ }) as HTMLButtonElement;
    expect(reset().disabled).toBe(true);
    expect(fieldOf("Âge de départ").value).toBe("64");

    // Versement mensuel en plus : un scénario actif, une courbe de plus, l'écart sous chaque résultat.
    await typeInto(user, fieldOf("Actions"), "300");
    expect(await screen.findByText("scénario actif")).toBeTruthy();
    expect(reset().disabled).toBe(false);
    await waitFor(() => expect(chartWith("Scénario")).toBeTruthy());
    await waitFor(() => expect(screen.getAllByText("Scénario").length).toBeGreaterThan(0));
    const cards = screen.getAllByText("Scénario").map((b) => b.closest("div.rounded-2xl") as HTMLElement);
    expect(cards.some((c) => c.textContent?.includes("Patrimoine en"))).toBe(true);

    // Un âge hors de 50 à 75 ans n'est pas pris en compte ; un âge valide, si.
    const before = chartWith("Scénario")!.option.series.find((x: { name: string }) => x.name === "Scénario").data.length;
    await typeInto(user, fieldOf("Âge de départ"), "30");
    expect(screen.getByText("scénario actif")).toBeTruthy();
    await typeInto(user, fieldOf("Âge de départ"), "60");
    await typeInto(user, fieldOf("Rendement actions"), "8");
    await typeInto(user, fieldOf("Inflation"), "3");
    await typeInto(user, fieldOf("Obligations"), "50");
    await typeInto(user, fieldOf("Fonds euros"), "50");
    await typeInto(user, fieldOf("Livrets"), "50");
    await waitFor(() => expect(chartWith("Scénario")!.option.series.find((x: { name: string }) => x.name === "Scénario").data.length).toBe(before));

    await user.click(reset());
    await waitFor(() => expect(screen.getByText("ne modifie pas le plan")).toBeTruthy());
    expect(fieldOf("Âge de départ").value).toBe("64");
    expect(fieldOf("Actions").value).toBe("");
    expect(reset().disabled).toBe(true);
    await waitFor(() => expect(chartWith("Fourchette basse (1 chance sur 10)")!.option.series.some((x: { name: string }) => x.name === "Scénario")).toBe(false));

    // Revenir à la valeur du plan sans passer par le bouton referme aussi le scénario.
    await typeInto(user, fieldOf("Actions"), "100");
    expect(await screen.findByText("scénario actif")).toBeTruthy();
    await typeInto(user, fieldOf("Actions"), "0");
    await waitFor(() => expect(screen.getByText("ne modifie pas le plan")).toBeTruthy());
  }, 90_000);

  it("dépenses imprévues : ajoutées, retirées des livrets dans la projection, puis supprimées", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<Projection />);
    const card = (await screen.findByText("Dépenses imprévues", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    const add = within(card).getByRole("button", { name: "Ajouter" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    await user.type(within(card).getByLabelText("Quoi"), "Réparation fictive");
    expect(add.disabled).toBe(true);
    await typeInto(user, within(card).getByLabelText("Année"), String(year + 3));
    await typeInto(user, within(card).getByLabelText("Montant"), "1200");
    expect(add.disabled).toBe(false);
    await user.click(add);
    expect(await screen.findByText("Dépense imprévue ajoutée")).toBeTruthy();
    expect(await within(card).findByText("Réparation fictive", { exact: false })).toBeTruthy();
    expect(within(card).getByText(String(year + 3))).toBeTruthy();
    expect((await workspace()).plannedExpenses).toMatchObject([{ label: "Réparation fictive", year: year + 3, amount: 1_200 }]);
    // Le formulaire est vidé après l'ajout.
    expect(within(card).getByLabelText("Quoi")).toHaveProperty("value", "");

    await user.click(within(card).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).plannedExpenses).toHaveLength(0));
    await waitFor(() => expect(within(card).queryByText("Réparation fictive", { exact: false })).toBeNull());
  }, 90_000);
});

describe("versements", () => {
  it("sans compte : l'accueil", async () => {
    show(<Versements />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });

  it("aucun versement programmé : rien à déclarer et pas de calendrier", async () => {
    await rpc("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    show(<Versements />);
    expect(await screen.findByText("Aucun versement programmé.")).toBeTruthy();
    expect(screen.getByText("Rien à déclarer tant qu'aucun versement n'est programmé.")).toBeTruthy();
    expect(screen.getByText("Programmez un premier versement pour voir le calendrier.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Tout afficher/ })).toBeNull();
  });

  it("programmer, arrêter un versement et le supprimer ; le calendrier suit", async () => {
    const user = userEvent.setup();
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres fictif" });
    show(<Versements />);
    const card = (await screen.findByText("Programmation")).closest("div.rounded-2xl") as HTMLElement;
    const submit = within(card).getByRole("button", { name: "Programmer" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    await user.selectOptions(within(card).getByLabelText("Compte"), livret.id);
    await typeInto(user, within(card).getByLabelText("Montant par mois"), "150");
    await user.click(submit);
    expect(await screen.findByText("Versement programmé")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).plans).toMatchObject([{ accountId: livret.id, amount: 150 }]));
    // Le versement apparaît sous le compte, dans « Ce mois-ci » et en colonne du calendrier.
    expect(await within(card).findByText(/actuellement/)).toBeTruthy();
    const month = screen.getByText("Ce mois-ci").closest("div.rounded-2xl") as HTMLElement;
    expect(month.textContent).toMatch(/150/);
    expect(month.textContent).toMatch(/sur 1 compte/);
    const calendar = screen.getByText("Calendrier").closest("div.rounded-2xl") as HTMLElement;
    expect(within(calendar).getByRole("columnheader", { name: "Livret fictif" })).toBeTruthy();

    // 0 à partir d'un mois ultérieur arrête le versement : l'ancien montant reste dans l'historique du compte.
    fireEvent.change(within(card).getByLabelText("À partir de"), { target: { value: `${year + 1}-06` } });
    await typeInto(user, within(card).getByLabelText("Montant par mois"), "0");
    await user.click(within(card).getByRole("button", { name: "Programmer" }));
    await waitFor(async () => expect((await workspace()).plans).toMatchObject([{ amount: 150 }, { amount: 0, fromMonth: `${year + 1}-06` }]));
    await user.click(within(card).getAllByRole("button", { name: "Supprimer" })[1]!);
    await waitFor(async () => expect((await workspace()).plans.length).toBe(1));
    await user.click(within(card).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).plans).toHaveLength(0));
    expect(await screen.findByText("Aucun versement programmé.")).toBeTruthy();
  });

  it("mois manqués : déclarer, lister, supprimer", async () => {
    const user = userEvent.setup();
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, startMonth: `${year - 1}-01` } });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    const autre = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Autre livret fictif", livretType: "AUTRE" });
    await rpc("plans.set", { accountId: livret.id, fromMonth: `${year - 1}-01`, amount: 200 });
    await rpc("plans.set", { accountId: autre.id, fromMonth: `${year - 1}-01`, amount: 50 });
    show(<Versements />);
    const skips = (await screen.findByText("Mois manqués", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    const declare = within(skips).getByRole("button", { name: "Déclarer" }) as HTMLButtonElement;
    expect(declare.disabled).toBe(true);
    // Le compte se choisit dans la liste : un autre puis le premier.
    await user.selectOptions(within(skips).getByRole("combobox"), autre.id);
    await user.selectOptions(within(skips).getByRole("combobox"), livret.id);
    fireEvent.change(within(skips).getByLabelText("Mois"), { target: { value: `${year - 1}-03` } });
    await typeInto(user, within(skips).getByLabelText("Montant non versé"), "200");
    await user.click(declare);
    expect(await screen.findByText("Mois manqué enregistré")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).skips).toMatchObject([{ accountId: livret.id, month: `${year - 1}-03`, amount: 200 }]));
    expect(await within(skips).findByText(/^Mars \d{4} · Livret fictif$/)).toBeTruthy();
    // Le calendrier colore le mois manqué.
    await user.click(screen.getByRole("button", { name: /Tout afficher/ }));
    const calendar = screen.getByText("Calendrier").closest("div.rounded-2xl") as HTMLElement;
    expect(within(calendar).getByText("Mars " + (year - 1))).toBeTruthy();
    expect(calendar.querySelector('td[title="Mois manqué (tout ou partie)"]')).toBeTruthy();
    await user.click(within(skips).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).skips).toHaveLength(0));
  });

  it("jeu de démonstration : gestion suggérée, retour à la gestion libre, calendrier replié puis complet", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<Versements />);
    expect(await screen.findByText("Ma capacité d'épargne", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Gestion suggérée" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Programmation")).toBeNull();

    // Le calendrier est resserré autour d'aujourd'hui ; « Tout afficher » donne tous les mois jusqu'au départ.
    const calendar = screen.getByText("Calendrier").closest("div.rounded-2xl") as HTMLElement;
    const short = within(calendar).getAllByRole("row").length;
    expect(short).toBeLessThanOrEqual(20);
    await user.click(within(calendar).getByRole("button", { name: /^Tout afficher \(\d+ mois\)$/ }));
    expect(within(calendar).getAllByRole("row").length).toBeGreaterThan(short);
    expect(within(calendar).getAllByText("✓ versé").length).toBeGreaterThan(0);
    expect(within(calendar).getAllByText("à venir").length).toBeGreaterThan(0);
    await user.click(within(calendar).getByRole("button", { name: "Afficher autour d'aujourd'hui" }));
    expect(within(calendar).getAllByRole("row").length).toBe(short);

    // Un clic sur l'autre mode l'enregistre dans le plan ; recliquer sur le mode actif ne fait rien.
    await user.click(screen.getByRole("tab", { name: "Gestion suggérée" }));
    await user.click(screen.getByRole("tab", { name: "Gestion libre" }));
    expect(await screen.findByText("Programmation")).toBeTruthy();
    expect((await workspace()).params.contributions.mode).toBe("libre");
    expect(screen.getByText(/Prélevés le 5 de chaque mois/)).toBeTruthy();
  }, 90_000);

  it("versements ponctuels du journal : colonne dédiée et mention dans le calendrier, même avant le plan", async () => {
    const user = userEvent.setup();
    const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres fictif" });
    await rpc("transactions.upsert", { date: `${year - 2}-04-20`, type: "versement", accountId: cto.id, amount: 750, comment: "Prime fictive" });
    await rpc("transactions.upsert", { date: `${year - 2}-04-25`, type: "versement", accountId: cto.id, amount: 50 });
    show(<Versements />);
    await user.click(await screen.findByRole("button", { name: /Tout afficher/ }));
    const calendar = screen.getByText("Calendrier").closest("div.rounded-2xl") as HTMLElement;
    expect(within(calendar).getByRole("columnheader", { name: "Compte-titres fictif" })).toBeTruthy();
    expect(calendar.textContent).toMatch(/\+\s*800\s*€\s*ponctuel/);
    const cell = calendar.querySelector('td[title*="Prime fictive"]');
    expect(cell?.getAttribute("title")).toContain(`Versement ponctuel du 20/04 : 750`);
    // Un mois avant le plan, avec un versement ponctuel, compte comme versé.
    expect(within(calendar).getAllByText("✓ versé").length).toBeGreaterThan(0);
  });

  it("gestion de patrimoine : calendrier sur dix ans", async () => {
    const user = userEvent.setup();
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, goal: "patrimoine" } });
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("plans.set", { accountId: livret.id, fromMonth: `${year}-01`, amount: 100 });
    show(<Versements />);
    await user.click(await screen.findByRole("button", { name: /Tout afficher/ }));
    const calendar = screen.getByText("Calendrier").closest("div.rounded-2xl") as HTMLElement;
    expect(within(calendar).getByText("Décembre " + (year + 10))).toBeTruthy();
  });
});

/** Un patrimoine avec de quoi payer des impôts de toute nature, pour les pages fiscales. Noms et montants fictifs. */
async function seedTaxes(report = false) {
  const id = async (name: string, input: unknown) => (await rpc<{ id: string }>(name, input)).id;
  const retenue = await id("institutions.upsert", { name: "Courtier retenue fictif", kind: "courtier", tax: { withholds: true, withheldIncomeTax: 0.128, withheldSocial: 0.186, report } });
  const sans = await id("institutions.upsert", { name: "Courtier sans retenue fictif", kind: "courtier", tax: { withholds: false, report } });
  const prets = await id("institutions.upsert", { name: "Plateforme sans retenue fictive", kind: "crowdlending", tax: { withholds: false } });
  const plateformeCrypto = await id("institutions.upsert", { name: "Plateforme crypto fictive", kind: "crypto", tax: { report } });
  const pretsRetenue = await id("institutions.upsert", { name: "Plateforme avec retenue fictive", kind: "crowdlending", tax: { withholds: true, withheldIncomeTax: 0.128, withheldSocial: 0.186 } });
  const ws = await workspace();
  await rpc("params.update", { ...ws.params, tax: { ...ws.params.tax, tmi: 0.3 } });
  const acc = {
    cto1: await id("accounts.upsert", { kind: "cto", name: "CTO retenue", institutionId: retenue }),
    cto2: await id("accounts.upsert", { kind: "cto", name: "CTO sans retenue", institutionId: sans }),
    crypto: await id("accounts.upsert", { kind: "crypto", name: "Crypto fictif", institutionId: plateformeCrypto }),
    crowd1: await id("accounts.upsert", { kind: "crowdlending", name: "Prêts sans retenue", institutionId: prets }),
    crowd2: await id("accounts.upsert", { kind: "crowdlending", name: "Prêts avec retenue", institutionId: pretsRetenue }),
    av: await id("accounts.upsert", { kind: "assurance_vie", name: "AV fictive", openedOn: `${year - 10}-01-15` }),
    pea: await id("accounts.upsert", { kind: "pea", name: "PEA fictif", openedOn: `${year - 6}-02-10` }),
    livret: await id("accounts.upsert", { kind: "livret", name: "Livret libre fictif", livretType: "AUTRE" }),
    per: await id("accounts.upsert", { kind: "per", name: "PER fictif" }),
    epargne: await id("accounts.upsert", { kind: "epargne_salariale", name: "Épargne salariale fictive" }),
  };
  const action = await id("assets.upsert", { kind: "action", name: "Action fictive", priceSource: "manuel" });
  const action2 = await id("assets.upsert", { kind: "action", name: "Action perdante fictive", priceSource: "manuel" });
  const btc = await id("assets.upsert", { kind: "crypto", name: "Bitcoin fictif", priceSource: "manuel" });
  const etf = await id("assets.upsert", { kind: "etf", name: "ETF fictif", priceSource: "manuel" });
  const tx = (date: string, type: string, accountId: string, amount: number, extra: Record<string, unknown> = {}) => rpc("transactions.upsert", { date, type, accountId, amount, ...extra });
  const first = `${year}-01-01`;
  // Compte-titres qui retient l'impôt : une plus-value deux ans avant, des dividendes avec leur détail fiscal.
  await tx(`${year - 3}-01-10`, "apport_initial", acc.cto1, 30_000);
  await tx(`${year - 2}-02-01`, "achat", acc.cto1, 5_000, { assetId: action, quantity: 50 });
  await tx(`${year - 2}-09-10`, "vente", acc.cto1, 8_000, { assetId: action, quantity: 50 });
  await tx(`${year - 1}-05-20`, "dividende", acc.cto1, 68.6, { assetId: etf, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 });
  await tx(first, "dividende", acc.cto1, 68.6, { gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 });
  await tx(first, "impots", acc.cto1, 25);
  // Compte-titres qui ne retient rien : dividendes entièrement à déclarer, puis une moins-value reportable.
  await tx(`${year - 3}-01-10`, "apport_initial", acc.cto2, 10_000);
  await tx(`${year - 1}-02-01`, "achat", acc.cto2, 5_000, { assetId: action2, quantity: 50 });
  await tx(`${year - 1}-09-10`, "vente", acc.cto2, 3_000, { assetId: action2, quantity: 50 });
  await tx(`${year - 1}-06-15`, "dividende", acc.cto2, 60);
  await tx(first, "dividende", acc.cto2, 60);
  await tx(`${year - 1}-12-15`, "achat", acc.cto2, 2_000, { assetId: action, quantity: 20 });
  await tx(first, "vente", acc.cto2, 500, { assetId: action, quantity: 5 });
  // Une plus-value de l'année, qui consomme une partie de la moins-value reportée de l'année précédente.
  await tx(first, "vente", acc.cto2, 1_600, { assetId: action, quantity: 10 });
  // Crypto : une vente au-dessus du seuil d'exonération chaque année.
  await tx(`${year - 2}-01-10`, "apport_initial", acc.crypto, 5_000);
  await tx(`${year - 2}-01-11`, "achat", acc.crypto, 3_000, { assetId: btc, quantity: 0.1 });
  await tx(`${year - 1}-11-10`, "vente", acc.crypto, 4_000, { assetId: btc, quantity: 0.05 });
  await tx(first, "vente", acc.crypto, 1_200, { assetId: btc, quantity: 0.01 });
  // Crowdlending : intérêts sans retenue ; avec retenue, et des opérations « Impôts » qui ne collent pas.
  await tx(`${year - 2}-01-10`, "versement", acc.crowd1, 3_000);
  await tx(`${year - 1}-12-20`, "interets", acc.crowd1, 200);
  await tx(first, "interets", acc.crowd1, 50);
  await tx(`${year - 2}-01-10`, "versement", acc.crowd2, 3_000);
  await tx(`${year - 1}-12-20`, "interets", acc.crowd2, 100);
  await tx(`${year - 1}-12-21`, "impots", acc.crowd2, 10);
  // Assurance-vie avec une unité de compte, plan d'épargne en actions, PER, épargne salariale, livret libre.
  await tx(`${year - 3}-01-10`, "apport_initial", acc.av, 5_000);
  await tx(`${year - 1}-12-31`, "interets", acc.av, 120);
  await tx(first, "interets", acc.av, 100);
  await tx(first, "achat", acc.av, 1_000, { assetId: etf, quantity: 10 });
  await rpc("prices.setManual", { assetId: etf, date: first, price: 120 });
  await tx(`${year - 3}-01-10`, "apport_initial", acc.pea, 6_000);
  await tx(`${year - 1}-03-01`, "dividende", acc.pea, 40);
  await tx(`${year - 3}-01-10`, "apport_initial", acc.per, 3_000);
  await tx(`${year - 3}-01-10`, "apport_initial", acc.epargne, 2_000);
  await tx(`${year - 1}-12-31`, "interets", acc.epargne, 40);
  await tx(`${year - 3}-01-10`, "apport_initial", acc.livret, 1_000);
  return acc;
}

describe("impôts", () => {
  it("sans compte : l'accueil", async () => {
    show(<Impots />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });

  it("rien à déclarer : un livret seul", async () => {
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif", livretType: "LIVRET_A" });
    await rpc("transactions.upsert", { date: `${year - 1}-03-01`, type: "apport_initial", accountId: livret.id, amount: 2_000 });
    show(<Impots />);
    expect(await screen.findByText(/^Rien à payer à la déclaration pour les revenus \d{4}, d'après le Journal\.$/)).toBeTruthy();
    expect(screen.getByText("Rendement net comparé", { exact: false })).toBeTruthy();
  });

  it("à payer à la déclaration, rendement net comparé et impôts de chaque année", async () => {
    await seedTaxes();
    show(<Impots />);
    const next = year;
    expect(await screen.findByText(/^1\. À payer à la prochaine déclaration \(revenus \d{4}\)$/, {}, { timeout: 30_000 })).toBeTruthy();
    for (const title of [/^2\. Si tout était retiré aujourd'hui$/, /^3\. Rendement net comparé/, /^4\. Impôts de chaque année/]) expect(screen.getByText(title)).toBeTruthy();
    const section = (n: number) => screen.getByText(new RegExp(`^${n}\\. `)).closest("div.rounded-2xl") as HTMLElement;
    // 1. Les comptes qui doivent quelque chose, avec la raison propre à chaque type de compte.
    const due = section(1);
    expect(within(due).getByText("CTO sans retenue")).toBeTruthy();
    expect(within(due).getByText("Prêts sans retenue")).toBeTruthy();
    expect(due.textContent).toMatch(/Impôt définitif des coupons et dividendes moins l'acompte, plus-values de cession/);
    expect(due.textContent).toMatch(/Intérêts dont la plateforme n'a pas prélevé les impôts/);
    expect(within(due).getByText("Total")).toBeTruthy();
    expect(within(due).getByRole("columnheader", { name: "Plus-values" })).toBeTruthy();
    expect(screen.getByText(/Estimation en cours d'année|Impôt et prélèvements sociaux qui ne sont pas retenus/)).toBeTruthy();

    // 3. Rendement net.
    expect(within(section(3)).getAllByRole("row").length).toBeGreaterThan(2);
    // 4. Impôts par année : plus-values et crowdlending ont chacun leurs colonnes.
    const years = section(4);
    for (const col of ["Intérêts fonds euros", "Coupons bruts", "Crypto (IR + PS)", "Plus-values titres", "Impôt plus-values", "Crowdlending reçu", "Impôt crowdlending", "Total"]) expect(within(years).getByRole("columnheader", { name: col })).toBeTruthy();
    expect(within(years).getByRole("cell", { name: String(next) })).toBeTruthy();
    expect(within(years).getByRole("cell", { name: String(year - 1) })).toBeTruthy();
    expect(years.textContent).toMatch(/à payer/);
  }, 90_000);

  it("si tout était retiré : tri par colonne, puis détail de chaque type de compte", async () => {
    const user = userEvent.setup();
    await seedTaxes();
    // Contrats d'assurance-vie qui atteignent leurs 8 ans dans 1 mois, 9 mois, 18 mois, 24 mois et 3 ans et 4 mois.
    for (const [name, n] of [["AV dans 1 mois", 1], ["AV dans 9 mois", 9], ["AV dans 12 mois", 12], ["AV dans 18 mois", 18], ["AV dans 24 mois", 24], ["AV dans 40 mois", 40]] as const) {
      const [y, m, d] = inMonths(n).split("-");
      await rpc("accounts.upsert", { kind: "assurance_vie", name, openedOn: `${+y! - 8}-${m}-${d}` });
    }
    show(<Impots />);
    const withdrawal = (await screen.findByText("2. Si tout était retiré aujourd'hui", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    const names = () => within(withdrawal).getAllByRole("row").slice(1, -1).map((r) => r.querySelector("td")?.textContent ?? "");
    for (const col of ["Compte", "Valeur", "Gain brut", "Impôt à payer", "Valeur nette", "Gain net", "Régime appliqué"]) {
      await user.click(within(withdrawal).getByRole("button", { name: col }));
      expect(within(withdrawal).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    for (const col of within(withdrawal).getAllByRole("button", { name: "(%)" })) await user.click(col);
    await user.click(within(withdrawal).getByRole("button", { name: "Compte" }));
    const sorted = names();
    expect(sorted.map((n) => n.trim()).slice().sort((a, b) => a.localeCompare(b))[0]).toBe(sorted[0]!.trim());
    expect(within(withdrawal).getByText(/Taux moyen d'imposition des gains/)).toBeTruthy();

    const open = async (name: string) => {
      const row = within(withdrawal).getByRole("button", { name: `Afficher le détail : ${name}` });
      await user.click(row);
      const detail = (await within(withdrawal).findByText("Impôts déjà payés")).closest("td") as HTMLElement;
      return detail;
    };
    // Compte-titres qui retient : impôts déjà payés, plus-value latente, années et note d'explication.
    let detail = await open("CTO retenue");
    expect(within(detail).getByText("Plus-value latente")).toBeTruthy();
    expect(within(detail).getByText("À payer à la prochaine déclaration")).toBeTruthy();
    expect(within(detail).getByText("Gain net de tous les impôts")).toBeTruthy();
    expect(within(detail).getByText(/Opérations « Impôts » au Journal/)).toBeTruthy();
    expect(detail.textContent).toMatch(/l'établissement retient un acompte/);
    expect(within(detail).getByRole("columnheader", { name: "Retenu à la source" })).toBeTruthy();
    expect(within(detail).getAllByText(/payé|avis d'août/).length).toBeGreaterThan(0);
    // Un deuxième clic sur la même ligne la referme.
    await user.click(within(withdrawal).getByRole("button", { name: "Masquer le détail : CTO retenue" }));
    expect(within(withdrawal).queryByText("Impôts déjà payés")).toBeNull();

    detail = await open("CTO sans retenue");
    expect(detail.textContent).toMatch(/l'établissement ne retient rien/);
    expect(within(detail).getByText("Moins-values encore déductibles")).toBeTruthy();
    expect(within(detail).getByRole("columnheader", { name: "Plus-values" })).toBeTruthy();

    detail = await open("PEA fictif");
    expect(within(detail).getByText("5 ans du plan")).toBeTruthy();
    expect(within(detail).getByText("atteint")).toBeTruthy();
    expect(within(detail).getByText(/Retraits : prélèvements sociaux seulement/)).toBeTruthy();

    detail = await open("AV fictive");
    expect(within(detail).getByText("8 ans du contrat")).toBeTruthy();
    expect(within(detail).getByText("Gains des unités de compte")).toBeTruthy();
    expect(within(detail).getByText("Prélèvements sociaux retenus sur le fonds euros")).toBeTruthy();
    expect(within(detail).getByText("Abattement annuel après 8 ans")).toBeTruthy();
    expect(within(detail).getByText("Personne seule")).toBeTruthy();

    // Échéance à venir : « dans N mois », « dans 1 an », « dans N an(s) et M mois ».
    const left = async (name: string) => (await open(name)).textContent ?? "";
    expect(await left("AV dans 1 mois")).toMatch(/dans 1 mois/);
    expect(await left("AV dans 9 mois")).toMatch(/dans 9 mois/);
    expect(await left("AV dans 12 mois")).toMatch(/dans 1 an(?!s)/);
    expect(await left("AV dans 18 mois")).toMatch(/dans 1 an et 6 mois/);
    expect(await left("AV dans 24 mois")).toMatch(/dans 2 ans(?! et)/);
    expect(await left("AV dans 40 mois")).toMatch(/dans 3 ans et 4 mois/);
    expect((await open("AV dans 1 mois")).textContent).toMatch(/Aucun revenu ni cession enregistré sur ce compte/);

    detail = await open("Crypto fictif");
    expect(within(detail).getByText("Ventes contre des euros")).toBeTruthy();
    expect(within(detail).getByText("Prix d'acquisition restant, toutes plateformes")).toBeTruthy();
    expect(detail.textContent).toMatch(/formulaire|2086/);

    detail = await open("Prêts sans retenue");
    expect(within(detail).getByText("La plateforme prélève les impôts")).toBeTruthy();
    expect(within(detail).getByText("Non, ils sont à payer à la déclaration")).toBeTruthy();
    expect(detail.textContent).toMatch(/Capital remboursé non imposable/);

    detail = await open("Prêts avec retenue");
    expect(within(detail).getByText(/^Oui, \d/)).toBeTruthy();
    expect(detail.textContent).toMatch(/ne correspondent pas aux impôts notés/);

    detail = await open("PER fictif");
    expect(within(detail).getByText("Économie d'impôt estimée sur les versements")).toBeTruthy();
    detail = await open("Épargne salariale fictive");
    expect(within(detail).getByText("Gain à ce jour")).toBeTruthy();
    detail = await open("Livret libre fictif");
    expect(detail.textContent).toMatch(/Livret non réglementé/);
    expect(within(detail).getByText("Intérêts reçus depuis le début")).toBeTruthy();
  }, 120_000);

  it("impôt déjà retenu en trop : un remboursement est attendu à la déclaration", async () => {
    const ws = await workspace();
    await rpc("params.update", { ...ws.params, tax: { ...ws.params.tax, tmi: 0 } });
    const retenue = (await rpc<{ id: string }>("institutions.upsert", { name: "Courtier retenue fictif", kind: "courtier", tax: { withholds: true, withheldIncomeTax: 0.128, withheldSocial: 0.186 } })).id;
    const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO retenue", institutionId: retenue });
    await rpc("transactions.upsert", { date: `${year - 2}-01-10`, type: "apport_initial", accountId: cto.id, amount: 5_000 });
    // Au premier janvier de l'année : toujours dans l'année de revenus de la prochaine déclaration, quelle que soit la date du jour.
    for (const date of [`${year - 1}-05-20`, `${year}-01-01`]) await rpc("transactions.upsert", { date, type: "dividende", accountId: cto.id, amount: 68.6, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 });
    show(<Impots />);
    const due = (await screen.findByText(/^1\. À payer/, {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    expect(await within(due).findByText("Remboursement attendu")).toBeTruthy();
    expect(within(due).getAllByText(/-/).length).toBeGreaterThan(0);
  });
});

/** Dans l'application, la fenêtre de saisie s'ouvre une fois les données chargées. */
const Loaded = ({ children }: { children: ReactNode }) => (useWorkspaceIndex() ? <>{children}</> : null);
/** Le journal et la page vers laquelle il renvoie. */
const journalRoutes = (
  <Routes>
    <Route path="/journal" element={<Journal />} />
    <Route path="/versements" element={<p>Page des versements</p>} />
  </Routes>
);

async function seedJournal() {
  const id = async (name: string, input: unknown) => (await rpc<{ id: string }>(name, input)).id;
  const ws = await workspace();
  await rpc("params.update", { ...ws.params, profile: { ...ws.params.profile, startMonth: `${year - 1}-01`, contributionDay: 5 } });
  const livret = await id("accounts.upsert", { kind: "livret", name: "Livret fictif" });
  const pea = await id("accounts.upsert", { kind: "pea", name: "PEA fictif" });
  const etf = await id("assets.upsert", { kind: "etf", name: "ETF fictif", isin: "FR0000000001", priceSource: "manuel" });
  const tx = (date: string, type: string, accountId: string, amount: number, extra: Record<string, unknown> = {}) => rpc("transactions.upsert", { date, type, accountId, amount, ...extra });
  await tx(`${year - 2}-01-05`, "apport_initial", livret, 2_000, { comment: "Apport fictif" });
  await tx(`${year - 2}-01-10`, "apport_initial", pea, 3_000);
  await tx(`${year - 2}-01-12`, "achat", pea, 1_002, { assetId: etf, quantity: 100, fee: 2, comment: "Premier achat" });
  await tx(`${year - 2}-02-01`, "transfert", livret, 500, { counterAccountId: pea });
  await tx(`${year - 1}-03-10`, "dividende", pea, 40, { assetId: etf });
  await tx(`${year - 1}-06-01`, "frais", livret, 12, { comment: "Frais de tenue" });
  await tx(`${year - 1}-07-01`, "correction", pea, -5);
  // Un versement programmé sur le livret : ses mois écoulés apparaissent au journal sans être saisis.
  await rpc("plans.set", { accountId: livret, fromMonth: `${year - 1}-01`, amount: 100 });
  return { livret, pea, etf };
}

describe("journal", () => {
  const rowOf = (text: string | RegExp) => screen.getAllByRole("row").find((r) => (typeof text === "string" ? r.textContent?.includes(text) : text.test(r.textContent ?? ""))) as HTMLElement;
  const count = () => screen.getByText(/^\d+ opérations?$/).textContent;

  it("sans compte : l'accueil ; sans opération : une invitation à commencer", async () => {
    const empty = show(<Journal />);
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    empty.unmount();
    await rpc("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    show(<Journal />);
    expect(await screen.findByText("Aucune opération pour l'instant : commencez par vos apports initiaux.")).toBeTruthy();
    expect(count()).toBe("0 opération");
  });

  it("filtres, recherche et tri : le compteur et les lignes suivent", async () => {
    const user = userEvent.setup();
    const { livret, pea } = await seedJournal();
    show(<Journal />, "/journal");
    await screen.findByText("Premier achat");
    const total = Number(/^(\d+)/.exec(count()!)![1]);
    // Sept saisies plus les versements programmés déjà prélevés.
    expect(total).toBeGreaterThan(7);
    expect(document.querySelectorAll('[aria-label="programmé"]').length).toBeGreaterThan(0);
    // Un transfert nomme son compte de destination, sans signe sur le montant.
    expect(rowOf("Livret fictif → PEA fictif")).toBeTruthy();

    await user.type(screen.getByPlaceholderText(/Rechercher/), "premier");
    expect(count()).toBe("1 opération");
    expect(rowOf("Premier achat").textContent).toMatch(/ETF fictif/);
    await user.clear(screen.getByPlaceholderText(/Rechercher/));
    await user.type(screen.getByPlaceholderText(/Rechercher/), "introuvable");
    expect(await screen.findByText("Aucune opération ne correspond aux filtres.")).toBeTruthy();
    await user.clear(screen.getByPlaceholderText(/Rechercher/));

    const select = (name: string) => screen.getAllByRole("combobox").find((c) => (c as HTMLSelectElement).options[0]?.textContent === name) as HTMLSelectElement;
    await user.selectOptions(select("Toutes les opérations"), "dividende");
    expect(count()).toBe("1 opération");
    await user.selectOptions(select("Toutes les opérations"), "");
    await user.selectOptions(select("Toutes années"), String(year - 2));
    expect(count()).toBe("4 opérations");
    await user.selectOptions(select("Toutes années"), "");
    await user.selectOptions(select("Tous les comptes"), pea);
    // Le PEA compte aussi le transfert reçu du livret.
    expect(count()).toBe("5 opérations");
    await user.selectOptions(select("Tous les comptes"), livret);
    expect(Number(/^(\d+)/.exec(count()!)![1])).toBeGreaterThan(3);
    await user.selectOptions(select("Tous les comptes"), "");

    // Chaque colonne se trie ; la même colonne deux fois inverse le sens.
    const firstDate = () => within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[0]!.textContent;
    const newest = firstDate();
    await user.click(screen.getByRole("button", { name: "Date" }));
    expect(firstDate()).not.toBe(newest);
    for (const col of ["Compte", "Opération", "Titre", "Montant", "Quantité", "dont frais", "Commentaire"]) {
      await user.click(screen.getByRole("button", { name: col }));
      expect(screen.getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
      await user.click(screen.getByRole("button", { name: col }));
    }
  }, 60_000);

  it("modifier une opération : au crayon ou par double-clic ; supprimer demande confirmation", async () => {
    const user = userEvent.setup();
    await seedJournal();
    show(<Journal />, "/journal");
    await screen.findByText("Premier achat");
    await user.click(within(rowOf("Apport fictif")).getByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier l'opération" });
    expect(within(dialog).queryByRole("button", { name: "Enregistrer et saisir une autre" })).toBeNull();
    const comment = within(dialog).getByLabelText("Commentaire");
    await user.clear(comment);
    await user.type(comment, "Apport corrigé");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Apport corrigé")).toBeTruthy();
    expect((await workspace()).transactions.some((t: { comment: string }) => t.comment === "Apport corrigé")).toBe(true);

    await user.dblClick(rowOf("Frais de tenue"));
    expect(await screen.findByRole("dialog", { name: "Modifier l'opération" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    // Refuser la confirmation ne supprime rien ; l'accepter supprime.
    vi.mocked(confirm).mockReturnValueOnce(false);
    await user.click(within(rowOf("Frais de tenue")).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).transactions).toHaveLength(7);
    await user.click(within(rowOf("Frais de tenue")).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Opération supprimée")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Frais de tenue")).toBeNull());
    expect(confirm).toHaveBeenLastCalledWith("Supprimer cette opération ?");
    expect((await workspace()).transactions).toHaveLength(6);
  }, 60_000);

  it("versements programmés : renvoi vers la page Versements, ou mois déclaré manqué", async () => {
    const user = userEvent.setup();
    const { livret } = await seedJournal();
    show(journalRoutes, "/journal");
    await screen.findByText("Premier achat");
    const planned = () => screen.getAllByRole("row").filter((r) => r.querySelector('[aria-label="programmé"]'));
    expect(planned().length).toBeGreaterThan(0);
    expect(within(planned()[0]!).queryByRole("button", { name: "Supprimer" })).toBeNull();

    // Déclarer manqué : refusé, rien ; accepté, le mois est enregistré et la ligne disparaît du journal.
    const before = planned().length;
    vi.mocked(confirm).mockReturnValueOnce(false);
    await user.click(within(planned()[0]!).getByRole("button", { name: "Déclarer ce mois manqué" }));
    expect((await workspace()).skips).toHaveLength(0);
    await user.click(within(planned()[0]!).getByRole("button", { name: "Déclarer ce mois manqué" }));
    expect(await screen.findByText("Mois déclaré manqué")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).skips).toMatchObject([{ accountId: livret, amount: 100 }]));
    await waitFor(() => expect(planned().length).toBe(before - 1));
    expect(vi.mocked(confirm).mock.calls.at(-1)![0]).toMatch(/Déclarer manqué le versement de .* sur Livret fictif \?/);

    await user.click(within(planned()[0]!).getByRole("button", { name: "Modifier dans Versements" }));
    expect(await screen.findByText("Page des versements")).toBeTruthy();
  }, 60_000);

  it("double-clic sur un versement programmé : on va le modifier dans Versements", async () => {
    const user = userEvent.setup();
    await seedJournal();
    show(journalRoutes, "/journal");
    await screen.findByText("Premier achat");
    await user.dblClick(screen.getAllByRole("row").find((r) => r.querySelector('[aria-label="programmé"]'))!);
    expect(await screen.findByText("Page des versements")).toBeTruthy();
  });

  it("exporter les opérations affichées en CSV, importer un relevé, créer une opération", async () => {
    const user = userEvent.setup();
    await seedJournal();
    show(<Journal />, "/journal");
    await screen.findByText("Premier achat");
    await user.type(screen.getByPlaceholderText(/Rechercher/), "premier");
    await user.click(screen.getByRole("button", { name: /Exporter/ }));
    expect(h.download).toHaveBeenCalledTimes(1);
    const [name, csv, mime] = h.download.mock.calls[0]!;
    expect(name).toMatch(/^hamac-journal-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mime).toBe("text/csv;charset=utf-8");
    // Seule la ligne affichée est exportée, avec le nom et l'ISIN du titre.
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain("Date;Compte;Opération;Titre;ISIN;Montant;Quantité;Frais;Vers le compte;Commentaire");
    expect(csv).toContain("ETF fictif;FR0000000001;1002,00".replace(",00", ""));

    await user.click(screen.getByRole("button", { name: /Importer/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: /Nouvelle opération/ }));
    expect(await screen.findByRole("dialog", { name: "Nouvelle opération" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }, 60_000);

  it("liens directs : saisie pré-remplie par l'adresse, et période venue de l'Historique", async () => {
    const user = userEvent.setup();
    const { pea, etf } = await seedJournal();
    const first = show(<Journal />, `/journal?nouveau=1&compte=${pea}&type=achat&titre=${etf}`);
    const dialog = await screen.findByRole("dialog", { name: "Nouvelle opération" });
    expect((within(dialog).getByLabelText("Compte") as HTMLSelectElement).value).toBe(pea);
    expect((within(dialog).getByLabelText("Opération") as HTMLSelectElement).value).toBe("achat");
    expect((within(dialog).getByLabelText("Titre") as HTMLSelectElement).value).toBe(etf);
    await user.click(within(dialog).getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    first.unmount();

    // Filtre de dates : les trois formulations de l'étiquette, retirables d'un clic.
    const only = show(<Journal />, `/journal?du=${year - 1}-01-01&filtre=${pea}`);
    expect(await screen.findByText(`Depuis le 01/01/${year - 1}`)).toBeTruthy();
    expect(count()).toBe("2 opérations");
    await user.click(screen.getByRole("button", { name: "Retirer le filtre de dates" }));
    await waitFor(() => expect(screen.queryByText(/Depuis le/)).toBeNull());
    // Les dates retirées, le compte reste filtré : ses cinq opérations, y compris celles d'avant la période.
    expect(count()).toBe("5 opérations");
    only.unmount();
    show(<Journal />, `/journal?au=${year - 2}-01-31`);
    expect(await screen.findByText(`Jusqu'au 31/01/${year - 2}`)).toBeTruthy();
    expect(count()).toBe("3 opérations");
  }, 60_000);
});

describe("fenêtre de saisie d'une opération", () => {
  const openDialog = async (preset: TxPreset = {}, transaction?: Parameters<typeof TransactionDialog>[0]["transaction"], onClose = vi.fn()) => {
    show(
      <Loaded>
        <TransactionDialog open preset={preset} transaction={transaction} onClose={onClose} />
      </Loaded>,
    );
    const dialog = await screen.findByRole("dialog");
    return { dialog, onClose, user: userEvent.setup() };
  };
  const label = (dialog: HTMLElement, text: string | RegExp) => within(dialog).getByLabelText(text) as HTMLInputElement;
  const accountsOf = async () => {
    const id = async (input: unknown) => (await rpc<{ id: string }>("accounts.upsert", input)).id;
    return { livret: await id({ kind: "livret", name: "Livret fictif" }), pea: await id({ kind: "pea", name: "PEA fictif" }), cto: await id({ kind: "cto", name: "CTO fictif" }) };
  };

  it("versement : les erreurs n'apparaissent qu'à l'envoi, « saisir une autre » garde le compte et la date", async () => {
    const { livret } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: livret });
    expect(within(dialog).queryByText(/Le montant doit être positif/)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/Le montant doit être positif/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.change(label(dialog, "Date"), { target: { value: `${year - 1}-04-02` } });
    await typeInto(user, label(dialog, "Montant"), "150");
    await user.type(label(dialog, "Commentaire"), "Prime fictive");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer et saisir une autre" }));
    await waitFor(async () => expect((await workspace()).transactions).toMatchObject([{ type: "versement", amount: 150, date: `${year - 1}-04-02`, comment: "Prime fictive" }]));
    // La fenêtre reste ouverte, vidée, sur le même compte et la même date.
    await waitFor(() => expect(label(dialog, "Montant").value).toBe(""));
    expect(label(dialog, "Date").value).toBe(`${year - 1}-04-02`);
    expect((within(dialog).getByLabelText("Compte") as HTMLSelectElement).value).toBe(livret);
    expect(label(dialog, "Commentaire").value).toBe("");
    expect(onClose).not.toHaveBeenCalled();

    await typeInto(user, label(dialog, "Montant"), "60");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await workspace()).transactions).toHaveLength(2);
  });

  it("la touche Entrée dans un champ valide le formulaire", async () => {
    const { livret } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: livret });
    await typeInto(user, label(dialog, "Montant"), "75");
    await user.type(label(dialog, "Commentaire"), "Saisie au clavier{Enter}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).transactions).toMatchObject([{ type: "versement", amount: 75, comment: "Saisie au clavier" }]);
  });

  it("transfert : compte de destination obligatoire et différent ; changer de compte remet un type possible", async () => {
    const { livret, pea } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: livret });
    const type = within(dialog).getByLabelText("Opération") as HTMLSelectElement;
    // Un livret ne porte pas de titres.
    expect([...type.options].map((o) => o.value)).not.toContain("achat");
    await user.selectOptions(type, "transfert");
    expect(within(dialog).getByText(/Choisir…/, { selector: "option" })).toBeTruthy();
    await typeInto(user, label(dialog, "Montant"), "300");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText("Choisissez le compte de destination.")).toBeTruthy();
    const dest = within(dialog).getByLabelText("Vers le compte") as HTMLSelectElement;
    expect([...dest.options].map((o) => o.value)).not.toContain(livret);
    await user.selectOptions(dest, pea);
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).transactions).toMatchObject([{ type: "transfert", accountId: livret, counterAccountId: pea, amount: 300 }]);
  });

  it("changer de compte : l'opération choisie est remplacée par un versement si le nouveau compte ne la permet pas", async () => {
    const { livret, pea } = await accountsOf();
    const { dialog, user } = await openDialog({ accountId: pea, type: "achat" });
    const type = () => within(dialog).getByLabelText("Opération") as HTMLSelectElement;
    expect(type().value).toBe("achat");
    expect(within(dialog).getByLabelText("Titre")).toBeTruthy();
    await user.selectOptions(within(dialog).getByLabelText("Compte"), livret);
    expect(type().value).toBe("versement");
    expect(within(dialog).queryByLabelText("Titre")).toBeNull();
    // Le compte peut aussi être restreint par la page appelante.
    const accountSelect = within(dialog).getByLabelText("Compte") as HTMLSelectElement;
    expect([...accountSelect.options].map((o) => o.value)).toEqual(expect.arrayContaining([livret, pea]));
  });

  it("achat d'un titre pas encore connu : création du titre avec l'opération, puis une autre saisie sur ce titre", async () => {
    const { pea } = await accountsOf();
    await rpc("assets.upsert", { kind: "etf", name: "ETF déjà connu fictif", isin: "FR0000000009", priceSource: "manuel" });
    const { dialog, user } = await openDialog({ accountId: pea, type: "achat" });
    await user.selectOptions(within(dialog).getByLabelText("Titre"), "__nouveau__");
    expect(within(dialog).getByText("Nouveau titre")).toBeTruthy();
    // Sans nom, l'envoi est refusé avec la raison.
    await typeInto(user, label(dialog, "Quantité"), "10");
    await typeInto(user, label(dialog, "Prix par unité"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/Donnez un nom au titre\./)).toBeTruthy();
    // Un ISIN déjà connu propose le titre existant.
    await user.type(label(dialog, "ISIN (facultatif)"), "fr0000000009");
    await user.type(label(dialog, "Nom"), "ETF nouveau fictif");
    expect(within(dialog).getByText("ETF déjà connu fictif")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Utiliser ce titre" }));
    expect((within(dialog).getByLabelText("Titre") as HTMLSelectElement).selectedOptions[0]!.textContent).toMatch(/ETF déjà connu fictif/);
    // Retour à la création, avec un ISIN invalide : refusé, puis corrigé.
    await user.selectOptions(within(dialog).getByLabelText("Titre"), "__nouveau__");
    await user.type(label(dialog, "Nom"), "ETF nouveau fictif");
    await user.type(label(dialog, "ISIN (facultatif)"), "XX1");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer et saisir une autre" }));
    expect(await within(dialog).findByText(/ISIN invalide/)).toBeTruthy();
    await user.clear(label(dialog, "ISIN (facultatif)"));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer et saisir une autre" }));
    expect(await screen.findByText("Titre créé et opération enregistrée")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).assets.map((a: { name: string }) => a.name)).toContain("ETF nouveau fictif"));
    const ws = await workspace();
    const created = ws.assets.find((a: { name: string }) => a.name === "ETF nouveau fictif");
    expect(ws.transactions).toMatchObject([{ type: "achat", accountId: pea, assetId: created.id, quantity: 10 }]);
    // La fenêtre est prête pour une autre opération sur le titre qui vient d'être créé.
    await waitFor(() => expect((within(dialog).getByLabelText("Titre") as HTMLSelectElement).value).toBe(created.id));
    expect(label(dialog, "Quantité").value).toBe("");
  });

  it("création d'un titre puis fermeture de la fenêtre", async () => {
    const { pea } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: pea, type: "achat", assetId: "nouveau" });
    // « nouveau » ouvre directement la création du titre.
    expect(within(dialog).getByText("Nouveau titre")).toBeTruthy();
    await user.type(label(dialog, "Nom"), "Action nouvelle fictive");
    await typeInto(user, label(dialog, "Quantité"), "4");
    await typeInto(user, label(dialog, "Montant total débité"), "400");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).assets).toMatchObject([{ name: "Action nouvelle fictive" }]);
  });

  it("obligation : nominal, prix en % du nominal, coupon couru et coût pour 1 € de nominal", async () => {
    const { cto } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: cto, type: "achat", assetId: "nouveau", assetKinds: ["obligation"] });
    // La création d'une obligation demande le coupon et l'échéance.
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText(/Indiquez le taux du coupon\. Indiquez l'échéance\./)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Obligation d'entreprise" }));
    expect(within(dialog).getByLabelText("Émetteur")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "OAT (État)" }));
    await typeInto(user, label(dialog, "Taux du coupon (nominal)"), "3");
    fireEvent.change(label(dialog, "Échéance"), { target: { value: `${year + 5}-05` } });
    expect(label(dialog, "Nom").value).toBe(`OAT 3 % mai ${year + 5}`);
    fireEvent.change(within(dialog).getByLabelText("Coupons"), { target: { value: "2" } });
    fireEvent.change(label(dialog, "Prochain coupon (facultatif)"), { target: { value: `${year}-03-01` } });

    await typeInto(user, label(dialog, "Nominal"), "3000");
    await typeInto(user, label(dialog, "Prix (% du nominal)"), "97");
    // Le coupon couru s'ajoute au prix, avec le total et le coût pour 1 € de nominal.
    await waitFor(() => expect(Number(label(dialog, "Total débité").value.replace(/\s/g, "").replace(",", "."))).toBeGreaterThanOrEqual(2910));
    expect(within(dialog).getByText("Coupon couru")).toBeTruthy();
    expect(within(dialog).getByText(/Coût pour 1 € de nominal/)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const ws = await workspace();
    expect(ws.assets).toMatchObject([{ kind: "obligation", couponRate: 0.03, bondKind: "etat", couponFrequency: 2 }]);
    expect(ws.transactions).toMatchObject([{ type: "achat", quantity: 3000 }]);
  });

  it("obligation déjà détenue : le total saisi calcule le prix, une vente parle de « total reçu »", async () => {
    const { cto } = await accountsOf();
    const bond = await rpc<{ id: string }>("assets.upsert", { kind: "obligation", name: "OAT fictive", priceSource: "modele", couponRate: 0.025, maturityDate: `${year + 6}-05-25`, bondKind: "etat", issuer: "République française" });
    const { dialog, user } = await openDialog({ accountId: cto, type: "achat", assetId: bond.id });
    await typeInto(user, label(dialog, "Nominal"), "1000");
    await typeInto(user, label(dialog, "Total débité"), "980");
    await waitFor(() => expect(label(dialog, "Prix (% du nominal)").value).not.toBe(""));
    expect(within(dialog).getByText("Calculé d'après le total.")).toBeTruthy();
    await typeInto(user, label(dialog, "Frais"), "5");
    expect(within(dialog).getByText("Saisis à la main.")).toBeTruthy();
    await user.selectOptions(within(dialog).getByLabelText("Opération"), "vente");
    expect(within(dialog).getByLabelText("Total reçu")).toBeTruthy();
  });

  it("dividende sur un compte-titres : détail fiscal facultatif, calcul d'après les taux et écart signalé", async () => {
    const inst = await rpc<{ id: string }>("institutions.upsert", { name: "Courtier fictif", kind: "courtier", tax: { withholds: true, withheldIncomeTax: 0.128, withheldSocial: 0.186 } });
    const cto = (await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO fictif", institutionId: inst.id })).id;
    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF fictif", priceSource: "manuel" });
    const { dialog, onClose, user } = await openDialog({ accountId: cto, type: "dividende", assetId: etf.id });
    expect(within(dialog).getByText("Détail fiscal (facultatif)")).toBeTruthy();
    await typeInto(user, label(dialog, "Montant"), "68.6");
    await user.click(within(dialog).getByRole("button", { name: "Calculer d'après les taux" }));
    expect(label(dialog, "Revenu brut").value).toBe("100");
    expect(label(dialog, "Acompte d'impôt retenu").value).toBe("12,8");
    expect(label(dialog, "Prélèvements sociaux retenus").value).toBe("18,6");
    expect(within(dialog).queryByText(/diffère du montant reçu/)).toBeNull();
    // Un brut qui ne colle pas avec les retenues est signalé, un brut inférieur au net est refusé.
    await typeInto(user, label(dialog, "Revenu brut"), "120");
    expect(within(dialog).getByText(/Le brut moins les retenues diffère du montant reçu de/)).toBeTruthy();
    await typeInto(user, label(dialog, "Revenu brut"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    expect(await within(dialog).findByText("Le brut ne peut pas être inférieur au montant reçu.")).toBeTruthy();
    await typeInto(user, label(dialog, "Revenu brut"), "100");
    await typeInto(user, label(dialog, "Retenue à l'étranger"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).transactions).toMatchObject([{ type: "dividende", amount: 68.6, gross: 100, withheldIncomeTax: 12.8, withheldSocial: 18.6 }]);
  });

  it("correction : un montant négatif est permis, et seulement pour une correction", async () => {
    const { livret } = await accountsOf();
    const { dialog, onClose, user } = await openDialog({ accountId: livret, type: "correction" });
    expect(within(dialog).getByText("Négatif pour baisser la valeur calculée.")).toBeTruthy();
    await typeInto(user, label(dialog, "Montant"), "-25");
    expect(label(dialog, "Montant").value).toBe("-25");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).transactions).toMatchObject([{ type: "correction", amount: -25 }]);
  });

  it("modifier un achat : frais saisis à la main conservés, prix unitaire frais compris", async () => {
    const { pea } = await accountsOf();
    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF fictif", priceSource: "manuel" });
    const created = await rpc<{ id: string }>("transactions.upsert", { date: `${year - 1}-03-01`, type: "achat", accountId: pea, assetId: etf.id, amount: 1_005, quantity: 100, fee: 5, comment: "Achat fictif" });
    const tx = (await workspace()).transactions.find((t: { id: string }) => t.id === created.id);
    const { dialog, onClose, user } = await openDialog({}, tx);
    expect(screen.getByRole("dialog", { name: "Modifier l'opération" })).toBeTruthy();
    expect(within(dialog).getByText("Saisis à la main.")).toBeTruthy();
    expect(within(dialog).getByText(/Prix unitaire frais compris/)).toBeTruthy();
    expect(label(dialog, "Montant total débité").value).toBe("1 005");
    await typeInto(user, label(dialog, "Quantité"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).transactions).toMatchObject([{ id: created.id, quantity: 50, fee: 5, amount: 1_005 }]);
  });

  it("frais suggérés d'après la grille de l'établissement, recalculés tant qu'ils ne sont pas saisis", async () => {
    await seedDemo(h.backend);
    const ws = await workspace();
    const pea = ws.accounts.find((a: { name: string }) => a.name === "PEA");
    const etf = ws.assets.find((a: { name: string }) => a.name === "ETF PEA S&P 500");
    const { dialog, user } = await openDialog({ accountId: pea.id, type: "achat", assetId: etf.id });
    await typeInto(user, label(dialog, "Quantité"), "10");
    await typeInto(user, label(dialog, "Prix par unité"), "48");
    // Sous 500 € : 1,99 € fixe, d'après la grille du courtier A.
    await waitFor(() => expect(label(dialog, "dont frais").value).toBe("1,99"));
    expect(within(dialog).getByText(/^Calculés : /)).toBeTruthy();
    await waitFor(() => expect(label(dialog, "Montant total débité").value).toBe("481,99"));
    expect(within(dialog).getByText("Calculé : quantité × prix + frais.")).toBeTruthy();
    // Une vente : le net reçu se calcule moins les frais.
    await user.selectOptions(within(dialog).getByLabelText("Opération"), "vente");
    await waitFor(() => expect(within(dialog).getByLabelText("Montant net reçu")).toBeTruthy());
    // Frais saisis à la main : ils ne bougent plus quand le prix change.
    await typeInto(user, label(dialog, "dont frais"), "3");
    await typeInto(user, label(dialog, "Prix par unité"), "60");
    expect(label(dialog, "dont frais").value).toBe("3");
    expect(within(dialog).getByText("Saisis à la main.")).toBeTruthy();
  }, 60_000);

  it("comptes proposés restreints par la page appelante", async () => {
    const { livret, pea } = await accountsOf();
    const { dialog } = await openDialog({ accountId: pea, accountKinds: ["pea", "cto"] });
    const options = [...(within(dialog).getByLabelText("Compte") as HTMLSelectElement).options].map((o) => o.value);
    expect(options).toContain(pea);
    expect(options).not.toContain(livret);
  });
});

describe("boutons d'ajout", () => {
  it("« Nouvelle opération » : grisé sans compte, ouvre la saisie sur le compte de la page", async () => {
    const user = userEvent.setup();
    const livret = (await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" })).id;
    const first = show(<AddTransactionButton />);
    expect((await screen.findByRole("button", { name: /Nouvelle opération/ })) as HTMLButtonElement).toHaveProperty("disabled", true);
    first.unmount();
    show(
      <Loaded>
        <AddTransactionButton accountId={livret} type="versement" label="Ajouter un versement" variant="ghost" />
      </Loaded>,
    );
    await user.click(await screen.findByRole("button", { name: /Ajouter un versement/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nouvelle opération" });
    expect((within(dialog).getByLabelText("Compte") as HTMLSelectElement).value).toBe(livret);
    await user.click(within(dialog).getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("enveloppe sans compte : proposer de créer le premier ; crayon pour modifier un compte", async () => {
    const user = userEvent.setup();
    const first = show(<EmptyAccount kind="livret" label="Ajouter un livret">Aucun livret pour l'instant.</EmptyAccount>);
    expect(screen.getByText("Aucun livret pour l'instant.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Ajouter un livret/ }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    first.unmount();

    await rpc("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    const [account] = (await workspace()).accounts as Account[];
    show(
      <Loaded>
        <EditAccountButton account={account!} />
      </Loaded>,
    );
    await user.click(await screen.findByRole("button", { name: "Modifier Livret fictif" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("mouvements d'un compte", () => {
  it("liste récente en premier, tri, titres filtrés, limite et lien vers le journal", async () => {
    const user = userEvent.setup();
    const { pea } = await seedJournal();
    const action = await rpc<{ id: string }>("assets.upsert", { kind: "action", name: "Action fictive", priceSource: "manuel" });
    await rpc("transactions.upsert", { date: `${year - 1}-08-01`, type: "achat", accountId: pea, assetId: action.id, amount: 500, quantity: 5 });
    show(<Movements accountIds={[pea]} title="Mouvements du PEA" limit={3} />);
    expect(await screen.findByText("Mouvements du PEA")).toBeTruthy();
    // Six mouvements pour le PEA (le transfert reçu compte) : trois affichés, trois plus anciens.
    expect(await screen.findByText(/\d+ mouvement\(s\) plus ancien\(s\) dans le/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "journal" }).getAttribute("href")).toBe("/journal");
    for (const col of ["Date", "Compte", "Opération", "Titre", "Montant", "Quantité", "Commentaire"]) {
      await user.click(screen.getByRole("button", { name: col }));
      expect(screen.getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    expect(screen.getAllByRole("row").length).toBe(4);
  });

  it("titres filtrés par catégorie, transferts entrants, et rien à afficher", async () => {
    const { livret, pea } = await seedJournal();
    const bond = await rpc<{ id: string }>("assets.upsert", { kind: "obligation", name: "OAT fictive", priceSource: "modele", couponRate: 0.02, maturityDate: `${year + 6}-05-25` });
    const cto = (await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO fictif" })).id;
    await rpc("transactions.upsert", { date: `${year - 1}-08-01`, type: "achat", accountId: cto, assetId: bond.id, amount: 500, quantity: 500 });
    const first = show(<Movements accountIds={[cto, pea]} assetKinds={["obligation"]} limit={50} />);
    await screen.findByText("Mouvements");
    // Seuls les titres de la catégorie, mais les mouvements d'espèces restent.
    expect(screen.queryByText("ETF fictif")).toBeNull();
    expect(screen.getByText("OAT fictive")).toBeTruthy();
    expect(screen.getAllByText("Apport initial").length).toBeGreaterThan(0);
    first.unmount();

    // Un transfert vu du compte qui reçoit est une entrée, vu de celui qui paie une sortie.
    show(<Movements accountIds={[livret]} limit={50} />);
    await screen.findByText("Mouvements");
    const transfer = screen.getAllByRole("row").find((r) => /Transfert/.test(r.textContent ?? ""))!;
    expect(transfer.textContent).toMatch(/Livret fictif → PEA fictif/);
    expect(transfer.textContent).toMatch(/-\s*500/);
  });

  it("aucun mouvement", async () => {
    const compte = (await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" })).id;
    show(<Movements accountIds={[compte]} />);
    expect(await screen.findByText("Aucun mouvement pour l'instant.")).toBeTruthy();
  });
});

describe("projets", () => {
  const dialogFields = (dialog: HTMLElement) => ({
    name: within(dialog).getByLabelText("Projet") as HTMLInputElement,
    target: within(dialog).getByLabelText("Somme à réunir") as HTMLInputElement,
    date: within(dialog).getByLabelText("Pour le") as HTMLInputElement,
    since: within(dialog).getByLabelText("Depuis le") as HTMLInputElement,
    rate: within(dialog).getByLabelText("Rendement supposé par an") as HTMLInputElement,
    save: (name: string) => within(dialog).getByRole("button", { name }) as HTMLButtonElement,
  });

  it("aucun projet : créer le premier, avec ses comptes et une part en pourcentage ou en montant", async () => {
    const user = userEvent.setup();
    const cto = (await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO fictif" })).id;
    const livret = (await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" })).id;
    await rpc("transactions.upsert", { date: `${year - 1}-01-10`, type: "apport_initial", accountId: cto, amount: 10_000 });
    await rpc("transactions.upsert", { date: `${year - 1}-01-10`, type: "apport_initial", accountId: livret, amount: 4_000 });
    show(<Projets />);
    expect(await screen.findByText("Aucun projet. Ajoutez ce que vous voulez financer, avec sa somme et sa date.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Nouveau projet/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nouveau projet" });
    const f = dialogFields(dialog);
    expect(f.save("Ajouter").disabled).toBe(true);
    expect(within(dialog).getByText(/Aucun compte : ajoutez ceux où vous mettez cet argent de côté\./)).toBeTruthy();
    expect(within(dialog).queryByLabelText(/Terminé ou abandonné/)).toBeNull();

    await user.type(f.name, "Apport fictif");
    await typeInto(user, f.target, "8000");
    // La date d'arrivée doit suivre le début de l'effort.
    fireEvent.change(f.date, { target: { value: `${year - 2}-01-01` } });
    expect(f.save("Ajouter").disabled).toBe(true);
    fireEvent.change(f.date, { target: { value: `${year + 2}-06-30` } });
    expect(f.save("Ajouter").disabled).toBe(false);
    await typeInto(user, f.rate, "2");
    await user.type(within(dialog).getByLabelText("Commentaire"), "Pour la résidence fictive");

    // Un compte à la fois : une fois choisi il n'est plus proposé. Pourcentage par défaut, montant réservé au choix.
    const add = () => within(dialog).getByLabelText("Ajouter un compte") as HTMLSelectElement;
    await user.selectOptions(add(), cto);
    expect([...add().options].map((o) => o.value)).not.toContain(cto);
    await user.selectOptions(add(), livret);
    expect(within(dialog).queryByLabelText("Ajouter un compte")).toBeNull();
    const ctoRow = within(dialog).getByText("CTO fictif", { selector: "div" }).parentElement as HTMLElement;
    await typeInto(user, within(ctoRow).getByLabelText("Pourcentage du compte"), "50");
    const livretRow = within(dialog).getByText("Livret fictif", { selector: "div" }).parentElement as HTMLElement;
    await user.selectOptions(within(livretRow).getByRole("combobox"), "montant");
    await typeInto(user, within(livretRow).getByLabelText("Montant réservé"), "1500");
    // Un pourcentage retombe sur 100 % au maximum.
    await user.selectOptions(within(livretRow).getByRole("combobox"), "pourcentage");
    await typeInto(user, within(livretRow).getByLabelText("Pourcentage du compte"), "250");
    expect(within(livretRow).getByLabelText("Pourcentage du compte")).toHaveProperty("value", "100");
    await user.selectOptions(within(livretRow).getByRole("combobox"), "montant");
    await typeInto(user, within(livretRow).getByLabelText("Montant réservé"), "1500");
    // Retirer un compte le remet au choix.
    await user.click(within(livretRow).getByRole("button", { name: "Retirer ce compte" }));
    expect(add()).toBeTruthy();
    await user.selectOptions(add(), livret);
    await user.selectOptions(within(within(dialog).getByText("Livret fictif", { selector: "div" }).parentElement as HTMLElement).getByRole("combobox"), "montant");
    await typeInto(user, within(within(dialog).getByText("Livret fictif", { selector: "div" }).parentElement as HTMLElement).getByLabelText("Montant réservé"), "1500");

    await user.click(f.save("Ajouter"));
    expect(await screen.findByText("Projet ajouté")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await workspace()).goals).toMatchObject([
      { name: "Apport fictif", target: 8_000, targetDate: `${year + 2}-06-30`, rate: 0.02, comment: "Pour la résidence fictive", allocations: [{ accountId: cto, mode: "pourcentage", value: 0.5 }, { accountId: livret, mode: "montant", value: 1_500 }] },
    ]);
    const card = (await screen.findByText("Apport fictif")).closest("div.rounded-2xl") as HTMLElement;
    // 50 % de 10 000 € et 1 500 € réservés : 6 500 € sur 8 000 €.
    expect(card.textContent).toMatch(/6\s500\s€\s+sur\s+8\s000\s€/);
    expect(within(card).getByText("CTO fictif", { exact: false })).toBeTruthy();
    expect(within(card).getByText("Pour la résidence fictive")).toBeTruthy();
    expect(within(card).getByText(/rendement supposé/)).toBeTruthy();
  }, 60_000);

  it("projets en cours et terminés : statuts, retard, date passée, avertissement de risque, comptes sur-affectés", async () => {
    const user = userEvent.setup();
    const cto = (await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO fictif" })).id;
    const vide = (await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret vide fictif" })).id;
    const etf = (await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF fictif", priceSource: "manuel" })).id;
    await rpc("transactions.upsert", { date: `${year - 2}-01-10`, type: "apport_initial", accountId: cto, amount: 10_000 });
    await rpc("transactions.upsert", { date: `${year - 2}-01-11`, type: "achat", accountId: cto, assetId: etf, amount: 10_000, quantity: 100 });
    const all = [{ accountId: cto, mode: "pourcentage", value: 1 }];
    const goal = (name: string, target: number, startDate: string, targetDate: string, extra: Record<string, unknown> = {}) =>
      rpc("goals.upsert", { name, target, startDate, targetDate, rate: 0.01, allocations: all, ...extra });
    // Bientôt échu, avec des actions : avertissement. Date passée : il manque la somme. Sans compte : à compléter.
    await goal("Échéance proche fictive", 20_000, `${year - 1}-01-01`, `${year + 1}-01-31`);
    await goal("Date passée fictive", 30_000, `${year - 3}-01-01`, `${year - 1}-01-31`, { comment: "Retard fictif" });
    await goal("Sans compte fictif", 5_000, `${year}-01-01`, `${year + 3}-01-31`, { allocations: [] });
    await goal("Atteint fictif", 1_000, `${year - 2}-01-01`, `${year + 4}-01-31`, { allocations: [{ accountId: cto, mode: "montant", value: 1_000 }] });
    await goal("Vide fictif", 3_000, `${year - 1}-01-01`, `${year + 4}-01-31`, { allocations: [{ accountId: vide, mode: "pourcentage", value: 0.5 }] });
    await goal("Terminé fictif", 2_000, `${year - 5}-01-01`, `${year - 4}-01-31`, { archived: true });
    show(<Projets />);
    const heading = await screen.findByText(/projets? en cours · à mettre de côté chaque mois/, {}, { timeout: 30_000 });
    expect(heading.textContent).toMatch(/^5 projets en cours/);
    // Le compte est réservé deux fois à 100 % ou plus : la valeur du compte est dépassée.
    expect(screen.getByText(/plus d'argent affecté aux projets que le compte n'en contient/)).toBeTruthy();
    const card = (name: string) => screen.getByText(name).closest("div.rounded-2xl") as HTMLElement;
    expect(within(card("Atteint fictif")).getByText("Atteint")).toBeTruthy();
    expect(within(card("Atteint fictif")).queryByText(/À mettre de côté/)).toBeNull();
    expect(within(card("Échéance proche fictive")).getByText(/Échéance dans \d+ mois avec \d+ % en actions ou en crypto/)).toBeTruthy();
    expect(within(card("Date passée fictive")).getByText("Date passée")).toBeTruthy();
    expect(within(card("Date passée fictive")).getByText(/Il manque : la date est passée\./)).toBeTruthy();
    expect(within(card("Date passée fictive")).getByText("Retard fictif")).toBeTruthy();
    expect(within(card("Sans compte fictif")).getByText(/Aucun compte affecté/)).toBeTruthy();
    expect(within(card("Vide fictif")).getAllByText(/En retard|En avance/).length).toBe(1);

    // Terminé : rangé à part, sans badge de statut ni objectif mensuel.
    expect(screen.getByText("Terminés ou abandonnés")).toBeTruthy();
    expect(within(card("Terminé fictif")).queryByText(/À mettre de côté/)).toBeNull();

    // Supprimer : refusé puis accepté.
    vi.mocked(confirm).mockReturnValueOnce(false);
    await user.click(within(card("Terminé fictif")).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).goals).toHaveLength(6);
    await user.click(within(card("Terminé fictif")).getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Projet supprimé")).toBeTruthy();
    expect(vi.mocked(confirm).mock.calls.at(-1)![0]).toBe("Supprimer le projet « Terminé fictif » ?");
    await waitFor(() => expect(screen.queryByText("Terminés ou abandonnés")).toBeNull());
    await waitFor(async () => expect((await workspace()).goals).toHaveLength(5));
  }, 60_000);

  it("modifier un projet puis l'archiver : il passe dans les terminés", async () => {
    const user = userEvent.setup();
    const cto = (await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "CTO fictif" })).id;
    await rpc("transactions.upsert", { date: `${year - 1}-01-10`, type: "apport_initial", accountId: cto, amount: 2_000 });
    await rpc("goals.upsert", { name: "Voyage fictif", target: 5_000, startDate: `${year}-01-01`, targetDate: `${year + 2}-01-31`, rate: 0, allocations: [{ accountId: cto, mode: "pourcentage", value: 1 }] });
    show(<Projets />);
    await user.click(await screen.findByRole("button", { name: "Modifier" }));
    const dialog = await screen.findByRole("dialog", { name: "Modifier « Voyage fictif »" });
    const f = dialogFields(dialog);
    expect(f.name.value).toBe("Voyage fictif");
    expect(f.target.value).toBe("5 000");
    await typeInto(user, f.target, "6000");
    await user.click(within(dialog).getByLabelText(/Terminé ou abandonné/));
    await user.click(f.save("Valider"));
    expect(await screen.findByText("Projet mis à jour")).toBeTruthy();
    expect(await screen.findByText("Terminés ou abandonnés")).toBeTruthy();
    expect((await workspace()).goals).toMatchObject([{ name: "Voyage fictif", target: 6_000, archived: true }]);
    expect(screen.queryByText(/en cours · à mettre de côté/)).toBeNull();
    // Fermer sans valider ne change rien.
    await user.click(screen.getByRole("button", { name: "Modifier" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Annuler" }));
    expect((await workspace()).goals).toMatchObject([{ target: 6_000 }]);
  }, 60_000);
});

describe("évolution d'un titre", () => {
  it("courbe d'un seul titre dans un compte, et bouton d'affichage de l'évolution", async () => {
    const user = userEvent.setup();
    const { pea, etf } = await seedJournal();
    await rpc("prices.setManual", { assetId: etf, date: `${year - 2}-02-28`, price: 11 });
    show(
      <Loaded>
        <PositionEvolution accountId={pea} assetId={etf} />
      </Loaded>,
    );
    expect(await screen.findByText(/Valeur totale :/)).toBeTruthy();
    expect(screen.getByText(/Sur la période :/)).toBeTruthy();
    await waitFor(() => expect(chartWith("Valeur totale")).toBeTruthy());
    await user.click(screen.getByRole("button", { name: "1A" }));
    expect(screen.getByRole("button", { name: "1A" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("sans historique : un message plutôt qu'un graphique vide ; bascule d'affichage", async () => {
    const pea = (await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA fictif" })).id;
    const etf = (await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF fictif", priceSource: "manuel" })).id;
    const onToggle = vi.fn();
    const first = show(
      <Loaded>
        <PositionEvolution accountId={pea} assetId={etf} />
      </Loaded>,
    );
    expect(await screen.findByText("L'évolution apparaîtra après un mois d'historique.")).toBeTruthy();
    first.unmount();
    const user = userEvent.setup();
    const closed = show(<EvolutionToggle open={false} onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: /Évolution/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await user.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    closed.unmount();
    show(<EvolutionToggle open onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: /Évolution/ }).getAttribute("aria-expanded")).toBe("true");
  });
});

/** Le 15 du mois situé `n` mois avant le mois en cours. */
const monthsAgo = (n: number) => {
  const m = month - 1 - n;
  return `${year + Math.floor(m / 12)}-${String(((m % 12) + 12) % 12 + 1).padStart(2, "0")}-15`;
};

describe("historique", () => {
  it("titres inchangés : repliés par défaut, à montrer à la demande (au pluriel puis au singulier)", async () => {
    const user = userEvent.setup();
    const pea = (await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA fictif" })).id;
    const ids: string[] = [];
    for (const name of ["ETF ancien A", "ETF ancien B", "ETF récent"]) ids.push((await rpc<{ id: string }>("assets.upsert", { kind: "etf", name, priceSource: "manuel" })).id);
    const tx = (date: string, type: string, amount: number, extra: Record<string, unknown> = {}) => rpc("transactions.upsert", { date, type, accountId: pea, amount, ...extra });
    await tx(`${year - 3}-01-10`, "apport_initial", 9_000);
    await tx(`${year - 3}-01-11`, "achat", 1_000, { assetId: ids[0], quantity: 10 });
    await tx(`${year - 3}-01-12`, "achat", 1_000, { assetId: ids[1], quantity: 10 });
    // Pas de nouveau titre pendant la période par défaut (un an) : tout est inchangé, sauf un achat récent.
    await tx(monthsAgo(3), "achat", 500, { assetId: ids[2], quantity: 5 });
    show(<Historique />, "/historique");
    const positions = (await screen.findByText("Titres achetés et vendus", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    expect(within(positions).queryByText("ETF ancien A")).toBeNull();
    expect(within(positions).getByText("ETF récent")).toBeTruthy();
    await user.click(within(positions).getByRole("button", { name: "Voir aussi les 2 lignes inchangées" }));
    expect(within(positions).getByText("ETF ancien A")).toBeTruthy();
    expect(within(positions).getByText("ETF ancien B")).toBeTruthy();
    await user.click(within(positions).getByRole("button", { name: "Seulement celles qui ont bougé" }));
    expect(within(positions).queryByText("ETF ancien B")).toBeNull();
    expect(within(positions).getByText(/1 nouveau titre/)).toBeTruthy();
  });

  it("une seule ligne inchangée : le bouton parle au singulier", async () => {
    const user = userEvent.setup();
    const pea = (await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA fictif" })).id;
    const ids: string[] = [];
    for (const name of ["ETF ancien", "ETF récent"]) ids.push((await rpc<{ id: string }>("assets.upsert", { kind: "etf", name, priceSource: "manuel" })).id);
    const tx = (date: string, type: string, amount: number, extra: Record<string, unknown> = {}) => rpc("transactions.upsert", { date, type, accountId: pea, amount, ...extra });
    await tx(`${year - 3}-01-10`, "apport_initial", 9_000);
    await tx(`${year - 3}-01-11`, "achat", 1_000, { assetId: ids[0], quantity: 10 });
    await tx(monthsAgo(3), "achat", 500, { assetId: ids[1], quantity: 5 });
    show(<Historique />, "/historique");
    const positions = (await screen.findByText("Titres achetés et vendus", {}, { timeout: 30_000 })).closest("div.rounded-2xl") as HTMLElement;
    await user.click(within(positions).getByRole("button", { name: "Voir aussi la ligne inchangée" }));
    expect(within(positions).getByText("ETF ancien")).toBeTruthy();
  });

  it("comptes sans opération : tout est à zéro, sans titre acheté ni vendu", async () => {
    await rpc("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    show(<Historique />, "/historique");
    // Les montants sont dans leurs propres éléments : on lit le texte entier du paragraphe.
    const paragraph = (re: RegExp) => screen.findByText((_, el) => el?.tagName === "P" && re.test(el.textContent ?? ""));
    expect(await paragraph(/^Depuis le début, votre patrimoine financier a atteint 0\s€\.$/)).toBeTruthy();
    expect(await paragraph(/^Vous avez apporté 0\s€ ; les placements ont rapporté 0\s€\.$/)).toBeTruthy();
    // Aucun titre : pas de tableau des achats et des ventes.
    expect(screen.queryByText("Titres achetés et vendus")).toBeNull();
  });

  it("jeu de démonstration : période au choix, étapes filtrées, cascade par enveloppe, tableaux triés et graphiques", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    // Un bien hors comptes, présent aux deux dates : la ligne « Autres biens » apparaît dans la situation.
    await rpc("otherAssets.upsert", { kind: "vehicule", name: "Voiture fictive", value: 9_000, valueDate: `${year - 1}-02-01` });
    show(<Historique />, "/historique");
    expect(await screen.findByText("La situation", {}, { timeout: 30_000 })).toBeTruthy();
    const card = (title: string) => screen.getByText(title).closest("div.rounded-2xl") as HTMLElement;
    const situation = card("La situation");
    for (const label of ["Patrimoine financier", "Argent versé net", "Gain", "Biens (part détenue)", "Autres biens", "Crédits restant dus", "Patrimoine net"]) expect(within(situation).getByText(label)).toBeTruthy();

    // Début et fin de la période se choisissent dans les listes ; « Depuis le début » est un raccourci.
    const from = screen.getByLabelText("Du") as HTMLSelectElement;
    const to = screen.getByLabelText("Au") as HTMLSelectElement;
    const earliest = [...from.options].filter((o) => o.value).at(-1)!;
    await user.selectOptions(from, earliest.value);
    expect(from.value).toBe(earliest.value);
    const latest = [...to.options].find((o) => o.value && o.textContent !== "Aujourd'hui")!;
    await user.selectOptions(to, latest.value);
    expect(screen.getByRole("heading", { name: new RegExp(`${earliest.textContent!.replace("Fin ", "")}`, "i") })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "1 mois" }));
    expect((screen.getByLabelText("Au") as HTMLSelectElement).value).toBe(to.value);
    await user.click(screen.getByRole("button", { name: "Depuis le début" }));
    expect((screen.getByLabelText("Du") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("heading", { name: /^Du début à / })).toBeTruthy();

    // Étapes : une famille se masque et se réaffiche, la liste complète se déplie par dizaines.
    const steps = card("Les grandes étapes");
    await user.click(within(steps).getByRole("button", { name: /^Voir toutes les étapes \(\d+\)$/ }));
    expect(within(steps).getByRole("button", { name: "Seulement celles de la période" })).toBeTruthy();
    const families = within(steps).getAllByRole("button").filter((b) => b.hasAttribute("aria-pressed"));
    expect(families.length).toBeGreaterThan(1);
    const before = within(steps).getAllByRole("listitem").length;
    await user.click(families[0]!);
    expect(families[0]!.getAttribute("aria-pressed")).toBe("false");
    expect(within(steps).getAllByRole("listitem").length).toBeLessThanOrEqual(before);
    await user.click(families[0]!);
    expect(families[0]!.getAttribute("aria-pressed")).toBe("true");
    const more = within(steps).queryByRole("button", { name: /^Afficher les \d+ autres$/ });
    if (more) {
      await user.click(more);
      expect(within(steps).getByRole("button", { name: "Afficher moins" })).toBeTruthy();
      await user.click(within(steps).getByRole("button", { name: "Afficher moins" }));
    }
    for (const f of families) await user.click(f);
    expect(within(steps).getByText("Aucune grande étape sur cette période.")).toBeTruthy();
    for (const f of families) await user.click(f);
    await user.click(within(steps).getByRole("button", { name: "Seulement celles de la période" }));

    // Cascade : limitée à une enveloppe, puis retour à tout le patrimoine.
    const scope = screen.getByLabelText("Périmètre de la cascade") as HTMLSelectElement;
    const pea = [...scope.options].find((o) => o.textContent === "PEA")!;
    await user.selectOptions(scope, pea.value);
    expect(scope.value).toBe(pea.value);
    expect(screen.getByRole("link", { name: /de la période$/ }).getAttribute("href")).toContain("filtre=");
    await user.selectOptions(scope, "all");

    // Enveloppe par enveloppe : chaque colonne se trie.
    const accounts = card("Compte par compte");
    for (const col of ["Compte", "Au début", "À la fin", "Argent apporté", "Gain"]) {
      await user.click(within(accounts).getByRole("button", { name: col }));
      expect(within(accounts).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    expect(within(accounts).getByText("Total")).toBeTruthy();

    // Titres achetés et vendus : tri, et lignes inchangées à la demande.
    const positions = card("Titres achetés et vendus");
    for (const col of ["Titre", "Compte", "Mouvement", "Investi en plus", "Au début", "À la fin"]) {
      await user.click(within(positions).getByRole("button", { name: col }));
      expect(within(positions).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    const toggle = within(positions).queryByRole("button", { name: /^Voir aussi (les \d+ lignes inchangées|la ligne inchangée)$/ });
    if (toggle) {
      const shown = within(positions).getAllByRole("row").length;
      await user.click(toggle);
      expect(within(positions).getAllByRole("row").length).toBeGreaterThan(shown);
      await user.click(within(positions).getByRole("button", { name: "Seulement celles qui ont bougé" }));
      expect(within(positions).getAllByRole("row").length).toBe(shown);
    }

    // Tableau mois par mois, avec les colonnes de l'immobilier, triable.
    await user.click(screen.getByRole("button", { name: "Voir le tableau mois par mois" }));
    const monthly = screen.getByRole("columnheader", { name: "Mois" }).closest("table") as HTMLElement;
    for (const col of ["Mois", "Total", "Versé net", "Gain", "Gain (%)", "Biens", "Crédits", "Patrimoine net"]) {
      await user.click(within(monthly).getByRole("button", { name: col }));
      expect(within(monthly).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    for (const bucket of ["Fonds euros", "Actions"]) {
      await user.click(within(monthly).getByRole("button", { name: bucket }));
      expect(within(monthly).getByRole("columnheader", { name: bucket }).getAttribute("aria-sort")).not.toBe("none");
    }
    await user.click(screen.getByRole("button", { name: "Masquer le tableau mois par mois" }));
    expect(screen.queryByRole("columnheader", { name: "Mois" })).toBeNull();

    // Graphiques : bulles en euros, graduations en k€.
    const months = chartWith("Argent apporté")!;
    expect(months.option.tooltip.valueFormatter(1_500)).toMatch(/^\+/);
    expect(months.option.yAxis.axisLabel.formatter(1_500)).toBe("1,5 k€");
    expect(months.option.yAxis.axisLabel.formatter(500)).toBe("500 €");
    const plan = chartWith("Prévu")!;
    expect(plan.option.tooltip.valueFormatter(12_000)).toMatch(/12/);
    expect(plan.option.series.map((x: { name: string }) => x.name)).toEqual(["Prévu", "Réel"]);
  }, 90_000);
});

describe("aide à la déclaration", () => {
  it("récapitulatif complet : cases, établissements, plus-values avec report, crypto, autres comptes, export et impression", async () => {
    const user = userEvent.setup();
    const acc = await seedTaxes(true);
    // Une cession dont l'achat n'est pas au journal : le prix de revient manque.
    const orphan = await rpc<{ id: string }>("assets.upsert", { kind: "action", name: "Titre sans achat fictif", priceSource: "manuel" });
    await rpc("transactions.upsert", { date: `${year - 1}-10-10`, type: "vente", accountId: acc.cto2, assetId: orphan.id, amount: 300, quantity: 5 }).catch(() => undefined);
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    show(<Declaration />);
    expect(await screen.findByRole("heading", { name: "Aide à la déclaration" }, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Récapitulatif fiscal complet" })).toBeTruthy();
    // La dernière année terminée est proposée.
    expect((screen.getByLabelText("Année de revenus") as HTMLSelectElement).value).toBe(String(year - 1));
    expect(screen.getByText(new RegExp(`Revenus ${year - 1} · Déclaration ${year}`))).toBeTruthy();
    for (const title of ["Cases à reporter", "Répartition par établissement", "Plus et moins-values de valeurs mobilières", "Actifs numériques (portefeuille global)", "Rappels"]) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    // Moins-value de l'année précédente : reportable, avec sa date limite.
    const securities = screen.getByText("Plus et moins-values de valeurs mobilières").closest("div.rounded-2xl") as HTMLElement;
    expect(within(securities).getByText("Moins-values restant reportables").parentElement!.textContent).toMatch(new RegExp(`\\(${year - 1}, jusqu'en ${year + 9}\\)`));
    expect(within(securities).getByText("Moins-values antérieures imputées").parentElement!.textContent).toContain("—");

    // L'année suivante : la moins-value reportée est imputée sur la plus-value.
    await user.selectOptions(screen.getByLabelText("Année de revenus"), String(year));
    const current = (await screen.findByText("Plus et moins-values de valeurs mobilières")).closest("div.rounded-2xl") as HTMLElement;
    await waitFor(() => expect(within(current).getByText("Moins-values antérieures imputées").parentElement!.textContent).toContain(`(${year - 1})`));
    await user.selectOptions(screen.getByLabelText("Année de revenus"), String(year - 1));

    // Contrôles : au moins un point est signalé, les erreurs en rouge.
    const controls = screen.getByText(/points? à contrôler/);
    expect(controls).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Détail \(CSV\)/ }));
    expect(h.download).toHaveBeenCalledTimes(1);
    expect(h.download.mock.calls[0]![0]).toBe(`recapitulatif-fiscal-${year - 1}.csv`);
    expect(h.download.mock.calls[0]![1]).toContain("Établissement;Traitement;Compte");
    await user.click(screen.getByRole("button", { name: /Imprimer ou enregistrer en PDF/ }));
    expect(print).toHaveBeenCalledTimes(1);

    // Un établissement à saisir ouvre sa fiche, avec ses cessions et ses cessions crypto.
    const repartition = screen.getByText("Répartition par établissement").closest("div.rounded-2xl") as HTMLElement;
    await user.click(within(repartition).getByRole("button", { name: "Courtier sans retenue fictif" }));
    expect(await screen.findByRole("heading", { name: "Récapitulatif fiscal – Courtier sans retenue fictif" })).toBeTruthy();
    expect((screen.getByLabelText("Document") as HTMLSelectElement).value).not.toBe("complet");
    expect(screen.getByText("Comptes concernés")).toBeTruthy();
    expect(screen.getAllByText("CTO sans retenue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("À saisir").length).toBeGreaterThan(0);
    // Chaque cession est détaillée avec sa ligne de tableau.
    const disposalRow = screen.getAllByRole("row").find((r) => /Action perdante fictive/.test(r.textContent ?? ""));
    expect(disposalRow).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Document"), "Récapitulatif fiscal – Plateforme crypto fictive");
    expect(await screen.findByRole("heading", { name: "Récapitulatif fiscal – Plateforme crypto fictive" })).toBeTruthy();
    expect(screen.getAllByText(/Bitcoin fictif/).length).toBeGreaterThan(0);
    await user.selectOptions(screen.getByLabelText("Document"), "complet");
    expect(screen.getByRole("heading", { name: "Récapitulatif fiscal complet" })).toBeTruthy();
  }, 120_000);

  it("comparer avec le document de l'établissement : saisie, enregistrement, écart signalé, case effacée", async () => {
    const user = userEvent.setup();
    await seedTaxes(true);
    show(<Declaration />);
    await screen.findByRole("heading", { name: "Aide à la déclaration" }, { timeout: 30_000 });
    await user.selectOptions(screen.getByLabelText("Année de revenus"), String(year - 1));
    await user.selectOptions(screen.getByLabelText("Document"), "Récapitulatif fiscal – Courtier retenue fictif");
    const compare = (await screen.findByText("Comparer avec le document de l'établissement")).closest("div.rounded-2xl") as HTMLElement;
    const save = within(compare).getByRole("button", { name: "Enregistrer les montants" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const fields = within(compare).getAllByLabelText(/^Document, case /) as HTMLInputElement[];
    expect(fields.length).toBeGreaterThan(0);
    await typeInto(user, fields[0]!, "12345");
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(await screen.findByText("Montants enregistrés")).toBeTruthy();
    await waitFor(async () => expect((await workspace()).taxStatements).toMatchObject([{ amount: 12_345 }]));
    // Un écart avec Hamac est signalé dans les contrôles de la fiche.
    expect(await screen.findByText(/écart sur la case/)).toBeTruthy();
    // Effacer la case retire le montant du comparatif, puis l'enregistre vide.
    const again = within(compare).getAllByLabelText(/^Document, case /)[0] as HTMLInputElement;
    await user.clear(again);
    expect(again.value).toBe("");
    expect((within(compare).getByRole("button", { name: "Enregistrer les montants" }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(within(compare).getByRole("button", { name: "Enregistrer les montants" }));
    await waitFor(async () => expect((await workspace()).taxStatements).toHaveLength(0));
  }, 120_000);

  it("fiche sans opération pour l'année choisie, et aucun établissement à saisir", async () => {
    const user = userEvent.setup();
    const acc = await seedTaxes(true);
    await rpc("transactions.upsert", { date: `${year - 5}-04-01`, type: "dividende", accountId: acc.cto1, amount: 10, gross: 14.5, withheldIncomeTax: 1.8, withheldSocial: 2.7 });
    show(<Declaration />);
    await screen.findByRole("heading", { name: "Aide à la déclaration" }, { timeout: 30_000 });
    await user.selectOptions(screen.getByLabelText("Année de revenus"), String(year - 5));
    await user.selectOptions(screen.getByLabelText("Document"), "Récapitulatif fiscal – Courtier sans retenue fictif");
    expect(await screen.findByText("Aucun revenu ni aucune cession pour cette année sur cet établissement.")).toBeTruthy();
  }, 120_000);

  it("sans établissement à saisir : la page propose de cocher la case dans les Paramètres", async () => {
    const livret = await rpc<{ id: string }>("accounts.upsert", { kind: "livret", name: "Livret fictif" });
    await rpc("transactions.upsert", { date: `${year - 1}-03-01`, type: "apport_initial", accountId: livret.id, amount: 1_000 });
    show(<Declaration />);
    expect(await screen.findByText(/Aucun récapitulatif par établissement pour cette année/, {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText(/Aucun montant à reporter pour cette année dans les comptes suivis/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Paramètres › Établissements/ }).getAttribute("href")).toBe("/parametres");
  });
});

describe("performance", () => {
  async function seedPerformance() {
    const id = async (name: string, input: unknown) => (await rpc<{ id: string }>(name, input)).id;
    const pea = await id("accounts.upsert", { kind: "pea", name: "Mon PEA" });
    const cto = await id("accounts.upsert", { kind: "cto", name: "Mon compte-titres" });
    const etf = await id("assets.upsert", { kind: "etf", name: "ETF Fictif", priceSource: "manuel" });
    const tx = (date: string, type: string, accountId: string, amount: number, extra: Record<string, unknown> = {}) => rpc("transactions.upsert", { date, type, accountId, amount, ...extra });
    await tx(`${year - 2}-01-05`, "apport_initial", pea, 1_000);
    await tx(`${year - 2}-01-06`, "achat", pea, 1_000, { assetId: etf, quantity: 100 });
    await tx(`${year - 1}-06-10`, "dividende", pea, 25, { assetId: etf });
    await tx(`${year - 2}-02-01`, "versement", cto, 500);
    await rpc("prices.setManual", { assetId: etf, date: `${year - 2}-01-31`, price: 10 });
    await rpc("prices.setManual", { assetId: etf, date: `${year - 1}-12-31`, price: 12 });
  }

  it("courbes en % ou en €, graduations et bulles ; enveloppes triées et dépliées", async () => {
    const user = userEvent.setup();
    await seedPerformance();
    show(<Performance />);
    expect(await screen.findByText("D'où vient le gain", {}, { timeout: 30_000 })).toBeTruthy();
    const card = (title: string) => screen.getByText(title).closest("div.rounded-2xl") as HTMLElement;

    // Rendement cumulé : en pourcentage par défaut, puis en euros.
    const cumulative = card("Rendement cumulé");
    const pct = chartWith("Rendement cumulé")!;
    expect(pct.option.tooltip.valueFormatter(0.05)).toMatch(/5/);
    expect(pct.option.yAxis.axisLabel.formatter(0.05)).toMatch(/5/);
    await user.click(within(within(cumulative).getByRole("group", { name: "Unité" })).getByRole("button", { name: "€" }));
    expect(await screen.findByText("Gain cumulé")).toBeTruthy();
    const eur = chartWith("Gain cumulé")!;
    expect(eur.option.tooltip.valueFormatter(1_234)).toMatch(/^\+/);
    expect(eur.option.yAxis.axisLabel.formatter(25_000)).toBe("25 k€");
    expect(eur.option.yAxis.axisLabel.formatter(500)).toMatch(/500/);

    // Année par année, en euros aussi.
    const periods = card("Année par année");
    await user.click(within(within(periods).getByRole("group", { name: "Unité" })).getByRole("button", { name: "€" }));
    const bars = chartWith("Gain")!;
    expect(bars.option.tooltip.valueFormatter(300)).toMatch(/\+/);
    expect(bars.option.tooltip.axisPointer.type).toBe("none");

    // Chaque colonne du tableau par enveloppe se trie.
    const table = screen.getByRole("columnheader", { name: "Enveloppe ou placement" }).closest("table") as HTMLElement;
    for (const col of ["Enveloppe ou placement", "Valeur", "Montant investi", "Gain (€)", "Gain (%)", "Rendement annualisé", "Hypothèse du plan", "Écart", "Gain après impôts"]) {
      await user.click(within(table).getByRole("button", { name: col }));
      expect(within(table).getByRole("columnheader", { name: col }).getAttribute("aria-sort")).not.toBe("none");
    }
    // Une enveloppe se déplie sur ses comptes.
    expect(within(table).queryByText("Mon PEA")).toBeNull();
    await user.click(within(table).getByRole("button", { name: "Afficher le détail : PEA" }));
    expect(within(table).getByText("Mon PEA")).toBeTruthy();
    await user.click(within(table).getByRole("button", { name: "Masquer le détail : PEA" }));
    expect(within(table).queryByText("Mon PEA")).toBeNull();
  }, 60_000);

  it("titres sans cours : un avertissement ; sans aucun versement : rien à analyser", async () => {
    const empty = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "PEA fictif" });
    show(<Performance />);
    expect(await screen.findByText(/Aucune donnée pour le moment/, {}, { timeout: 30_000 })).toBeTruthy();
    cleanup();

    const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF sans cours fictif", priceSource: "manuel" });
    await rpc("transactions.upsert", { date: `${year - 2}-01-05`, type: "apport_initial", accountId: empty.id, amount: 1_000 });
    await rpc("transactions.upsert", { date: `${year - 2}-01-06`, type: "achat", accountId: empty.id, assetId: etf.id, amount: 1_000, quantity: 100 });
    show(<Performance />);
    expect(await screen.findByText(/une partie des titres n'a aucun cours connu et compte à son prix de revient/, {}, { timeout: 30_000 })).toBeTruthy();
  });

  it("jeu de démonstration : plus forte baisse, volatilité, périmètre au choix", async () => {
    const user = userEvent.setup();
    await seedDemo(h.backend);
    show(<Performance />);
    expect(await screen.findByText("D'où vient le gain", {}, { timeout: 30_000 })).toBeTruthy();
    expect(screen.getByText("Plus forte baisse")).toBeTruthy();
    expect(screen.getByText("Volatilité")).toBeTruthy();
    const scope = screen.getByLabelText("Ce qui est analysé") as HTMLSelectElement;
    const comptes = [...scope.options].map((o) => o.textContent);
    expect(comptes).toEqual(expect.arrayContaining(["PEA", "Compte-titres"]));
    await user.selectOptions(scope, [...scope.options].find((o) => o.textContent === "PEA" && o.parentElement?.getAttribute("label") === "Comptes et contrats")!.value);
    expect(scope.selectedOptions[0]!.textContent).toBe("PEA");
    await user.click(screen.getAllByRole("button", { name: "3M" })[0]!);
    await waitFor(() => expect(screen.getByText("Versé sur la période")).toBeTruthy());
  }, 60_000);
});

describe("simulateurs", () => {
  it("dupliquer, supprimer et annuler ; couple ; un clic dans le tableau ouvre la simulation", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    expect(await screen.findByText("Comparer")).toBeTruthy();
    const name = () => screen.getByLabelText(/^Nom de la simulation/) as HTMLInputElement;
    expect(name().value).toBe("Obligation");

    // Dupliquer depuis la fiche : une copie, ouverte aussitôt.
    await user.click(screen.getByRole("button", { name: "Dupliquer" }));
    expect(name().value).toBe("Obligation (copie)");
    // Dupliquer depuis l'icône de la colonne.
    await user.click(screen.getByRole("button", { name: "Dupliquer « Obligation »" }));
    expect(name().value).toBe("Obligation (copie)");
    expect(screen.getAllByRole("button", { name: /^Supprimer « / }).length).toBe(3);

    // Un clic sur le nom d'une colonne, ou sur une cellule du tableau, ouvre la simulation dans le formulaire.
    const table = screen.getByText("Comparer").closest("div.rounded-2xl") as HTMLElement;
    await user.click(within(table).getAllByTitle("Modifier cette simulation")[1]!);
    expect(name().value).toBe("Obligation (copie)");
    const cell = within(table).getAllByRole("row")[1]!.querySelectorAll("td")[1] as HTMLElement;
    await user.click(cell);
    expect(name().value).toBe("Obligation");
    await user.click(within(table).getAllByRole("button", { name: "Modifier « Obligation (copie) »" })[0]!);
    expect(name().value).toBe("Obligation (copie)");

    // Supprimer depuis la fiche, puis annuler : la simulation revient à sa place.
    const open = name().value;
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(screen.getByText(`« ${open} » supprimée.`)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByText(`« ${open} » supprimée.`)).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Supprimer « / }).length).toBe(3);

    // Les couples se déclarent une fois pour toutes les simulations.
    const couple = screen.getByLabelText("Couple (imposition commune)") as HTMLInputElement;
    expect(couple.checked).toBe(false);
    await user.click(couple);
    expect(couple.checked).toBe(true);
  });

  it("chaque placement a son formulaire : prêt, livret, actions en compte-titres ou assurance-vie", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");

    await user.click(screen.getByRole("button", { name: "Crowdlending" }));
    const repayment = screen.getByLabelText("Remboursement") as HTMLSelectElement;
    expect(repayment.value).toBe("amortissable");
    await user.selectOptions(repayment, "in_fine");
    expect((screen.getByLabelText("Remboursement") as HTMLSelectElement).value).toBe("in_fine");
    expect(screen.getByLabelText("Part en défaut")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Livret ou compte à terme" }));
    const kind = screen.getByLabelText("Type") as HTMLSelectElement;
    await user.selectOptions(kind, "fiscalise");
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe("fiscalise");

    await user.click(screen.getByRole("button", { name: "ETF et actions" }));
    const envelope = () => screen.getByLabelText("Enveloppe") as HTMLSelectElement;
    await user.selectOptions(envelope(), "cto");
    expect(screen.getByLabelText("Dont dividendes versés")).toBeTruthy();
    expect(screen.queryByLabelText(/Ancienneté/)).toBeNull();
    await user.selectOptions(envelope(), "av");
    expect(screen.getByLabelText("Frais sur versement")).toBeTruthy();
    expect(screen.getByLabelText("Ancienneté du contrat aujourd'hui")).toBeTruthy();
    expect(screen.queryByLabelText("Frais de vente")).toBeNull();

    // Une durée commune grise la durée de chaque placement.
    await user.selectOptions(screen.getByLabelText("Durée de comparaison"), "commune");
    expect((screen.getByLabelText("Durée") as HTMLInputElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Imposition des revenus"), "bareme");
    await user.selectOptions(screen.getByLabelText("Tranche d'imposition (TMI)"), "0.3");
    expect(screen.getAllByText(/Barème/).length).toBeGreaterThan(0);
  });

  it("date saisie au clavier : une année partielle n'est pas prise, et le champ reprend la dernière date valide en le quittant", async () => {
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");
    const date = screen.getByLabelText("Date d'achat") as HTMLInputElement;
    const before = date.value;
    fireEvent.focus(date);
    fireEvent.change(date, { target: { value: "0002-05-01" } });
    expect(date.value).toBe("0002-05-01");
    fireEvent.blur(date);
    expect(date.value).toBe(before);
    fireEvent.focus(date);
    fireEvent.change(date, { target: { value: "2031-05-01" } });
    fireEvent.blur(date);
    expect(date.value).toBe("2031-05-01");
  });

  it("l'adresse change de l'extérieur : les simulations sont relues", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createMemoryRouter([{ path: "/simulateurs", element: <Simulateurs /> }], { initialEntries: ["/simulateurs"] });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("Comparer");
    expect((screen.getByLabelText("Montant investi") as HTMLInputElement).value).not.toBe("7 777");
    const other = { ...decodeState(null, todayIso()), amount: 7_777 };
    await act(async () => {
      await router.navigate(`/simulateurs?${new URLSearchParams({ s: encodeState(other) }).toString()}`);
    });
    await waitFor(() => expect((screen.getByLabelText("Montant investi") as HTMLInputElement).value).toBe("7 777"));
  });

  it("aucune simulation, échéance avant l'achat, montants invalides : le tableau et la fiche l'expliquent", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");
    // Une échéance avant l'achat ne permet aucun calcul.
    const maturity = screen.getByLabelText("Échéance") as HTMLInputElement;
    fireEvent.focus(maturity);
    fireEvent.change(maturity, { target: { value: "1999-01-01" } });
    fireEvent.blur(maturity);
    expect(await screen.findByText(/Ces données ne permettent pas de calcul/)).toBeTruthy();
    expect(screen.queryByText("Année par année")).toBeNull();
    // Un montant nul ou vide est refusé : l'ancien reste.
    const amount = screen.getByLabelText("Montant investi") as HTMLInputElement;
    const before = amount.value;
    await user.clear(amount);
    await user.tab();
    expect(amount.value).toBe(before);
    // Tout supprimer : une invitation à ajouter un placement.
    await user.click(screen.getByRole("button", { name: "Supprimer « Obligation »" }));
    expect(screen.getByText("Aucune simulation : ajoutez un placement ci-dessous.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Nom de la simulation/)).toBeNull();
  });

  it("jusqu'à huit simulations : les ajouts et les copies sont ensuite grisés ; durée commune et réinvestissement", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");
    await user.selectOptions(screen.getByLabelText("Durée de comparaison"), "commune");
    await typeInto(user, screen.getByLabelText("Durée commune"), "80");
    // Plafonnée à 50 ans.
    expect(screen.getByText(/toutes sur 50 ans/)).toBeTruthy();
    await typeInto(user, screen.getByLabelText("Taux de réinvestissement"), "50");
    expect((screen.getByLabelText("Taux de réinvestissement") as HTMLInputElement).value).toBe("20");
    await typeInto(user, screen.getByLabelText("Durée commune"), "1");
    expect(screen.getByText(/toutes sur 1 an,/)).toBeTruthy();
    // Le bouton d'ajout est le dernier de la liste : les précédents sont les noms des colonnes.
    const addFund = () => screen.getAllByRole("button", { name: "Fonds euros" }).at(-1) as HTMLButtonElement;
    for (let i = 0; i < 7; i++) await user.click(addFund());
    expect(addFund().disabled).toBe(true);
    expect((screen.getAllByRole("button", { name: /^Dupliquer « / })[0] as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(screen.getByLabelText("Durée de comparaison"), "");
    expect(screen.queryByLabelText("Durée commune")).toBeNull();
  });

  it("année par année : le détail d'une année se déplie", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Année par année");
    const first = screen.getAllByRole("button", { name: /^Afficher le détail : Détail de \d{4}$/ })[0]!;
    await user.click(first);
    expect(screen.getByRole("button", { name: /^Masquer le détail : Détail de \d{4}$/ })).toBeTruthy();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });
});
