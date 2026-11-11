import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { ToastProvider } from "@/lib/toast";
import { Historique } from "@/pages/Historique";
import { Journal } from "@/pages/Journal";

/** Parcours réel de la page : l'interface parle au vrai backend, sur une base en mémoire. Montants fictifs. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend }));

vi.mock("@/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));

// Le dessin SVG demande un navigateur ; on vérifie ici les données et les textes autour des graphiques.
vi.mock("@/components/Chart", () => ({ Chart: () => <div data-testid="graphique" />, axisStyle: () => ({}), tooltipStyle: () => ({}) }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}

function show(ui: ReactNode, path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function seed() {
  const pea = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "Mon PEA" });
  const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Mon compte-titres" });
  const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Fictif", priceSource: "manuel" });
  await rpc("transactions.upsert", { date: "2024-01-05", type: "apport_initial", accountId: pea.id, amount: 8_000 });
  await rpc("transactions.upsert", { date: "2024-01-06", type: "achat", accountId: pea.id, assetId: etf.id, amount: 6_000, quantity: 600 });
  await rpc("transactions.upsert", { date: "2024-02-01", type: "versement", accountId: cto.id, amount: 1_000 });
  await rpc("transactions.upsert", { date: "2024-02-02", type: "achat", accountId: cto.id, assetId: etf.id, amount: 500, quantity: 50 });
  await rpc("transactions.upsert", { date: "2025-03-10", type: "vente", accountId: cto.id, assetId: etf.id, amount: 600, quantity: 50 });
  await rpc("prices.setManual", { assetId: etf.id, date: "2024-01-31", price: 10 });
  await rpc("prices.setManual", { assetId: etf.id, date: "2025-03-10", price: 12 });
}

beforeEach(async () => {
  h.backend = await testBackend();
});
afterEach(() => {
  cleanup();
  h.backend.close();
});

describe("page Historique", () => {
  it("situation, cascade, étapes : une étape ouvre la période qui la contient", async () => {
    const user = userEvent.setup();
    await seed();
    show(<Historique />, "/historique");
    expect(await screen.findByText("La situation")).toBeTruthy();
    expect(screen.getByText("Ce qui s'est passé")).toBeTruthy();

    expect(screen.getByText("Mois par mois")).toBeTruthy();
    expect(screen.getByText("Par rapport au plan")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Depuis le début" }));
    expect(screen.getByRole("heading", { name: "Du début à aujourd'hui" })).toBeTruthy();
    expect(screen.getByText(/Depuis le début, votre patrimoine financier a atteint/)).toBeTruthy();
    const plan = screen.getByText("Par rapport au plan").closest("div.rounded-2xl") as HTMLElement;
    expect(within(plan).getByText(/^(En avance|En retard|Dans les clous)/)).toBeTruthy();
    const list = screen.getByText("Les grandes étapes").closest("div.rounded-2xl") as HTMLElement;
    expect(within(list).getByText("Premier achat de ETF Fictif")).toBeTruthy();
    expect(within(list).getByText("Ouverture de « Mon PEA »")).toBeTruthy();
    // 5 opérations saisies, toutes dans la période ; le lien n'impose aucune date de départ.
    const link = screen.getByRole("link", { name: "Voir les 5 opérations de la période" });
    expect(link.getAttribute("href")).not.toContain("du=");

    await user.click(within(list).getByText("Vente de tout ETF Fictif"));
    expect(screen.getByRole("heading", { name: "De fin février 2025 à aujourd'hui" })).toBeTruthy();
    const positions = screen.getByText("Titres achetés et vendus").closest("div.rounded-2xl") as HTMLElement;
    const sold = within(positions).getByText("Mon compte-titres").closest("tr") as HTMLElement;
    expect(within(sold).getByText("Vendu")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voir l'opération de la période" }).getAttribute("href")).toContain("du=2025-03-01");
  });

  it("le journal suit le lien : dates de la période, et filtre retirable", async () => {
    const user = userEvent.setup();
    await seed();
    show(<Journal />, "/journal?du=2025-03-01&au=2025-03-31");
    expect(await screen.findByText("1 opération")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retirer le filtre de dates" }));
    expect(await screen.findByText("5 opérations")).toBeTruthy();
  });
});
