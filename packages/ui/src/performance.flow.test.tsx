import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { ToastProvider } from "@/lib/toast";
import { Performance } from "@/pages/Performance";

/** Parcours réel de la page : l'interface parle au vrai backend, sur une base en mémoire. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend }));

vi.mock("@/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
// Le dessin SVG demande un navigateur ; on vérifie ici les données et les textes autour des graphiques.
vi.mock("@/components/Chart", () => ({ Chart: () => <div data-testid="graphique" />, axisStyle: {}, baseOption: {} }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}

function show() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>
          <Performance />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function seed() {
  const pea = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "Mon PEA" });
  const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Mon compte-titres" });
  const etf = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Fictif", priceSource: "manuel" });
  await rpc("transactions.upsert", { date: "2024-01-05", type: "apport_initial", accountId: pea.id, amount: 1000 });
  await rpc("transactions.upsert", { date: "2024-01-06", type: "achat", accountId: pea.id, assetId: etf.id, amount: 1000, quantity: 100 });
  await rpc("transactions.upsert", { date: "2024-06-10", type: "dividende", accountId: pea.id, assetId: etf.id, amount: 25 });
  await rpc("transactions.upsert", { date: "2024-02-01", type: "versement", accountId: cto.id, amount: 500 });
  await rpc("prices.setManual", { assetId: etf.id, date: "2024-01-31", price: 10 });
  await rpc("prices.setManual", { assetId: etf.id, date: "2024-12-31", price: 12 });
}

beforeEach(async () => {
  h.backend = await testBackend();
});
afterEach(() => {
  cleanup();
  h.backend.close();
});

describe("page Performance", () => {
  it("affiche chaque bloc, puis suit les filtres et le comparateur", async () => {
    const user = userEvent.setup();
    await seed();
    show();

    expect(await screen.findByText("D'où vient le gain")).toBeTruthy();
    for (const title of ["Rendement cumulé", "Comparer", "Année par année", "Calendrier des mois", "Classement des titres"]) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getAllByText("ETF Fictif").length).toBeGreaterThan(0);
    // Le total figure dans le tableau par enveloppe, avec la colonne réservée à « depuis le début ».
    expect(screen.getByRole("cell", { name: "Total" })).toBeTruthy();
    expect(screen.getByText("Gain après impôts")).toBeTruthy();

    // Filtre sur une enveloppe : le total disparaît.
    await user.selectOptions(screen.getByLabelText("Ce qui est analysé"), "Mon PEA");
    await waitFor(() => expect(screen.queryByRole("cell", { name: "Total" })).toBeNull());

    // Sur une période, la colonne après impôts n'a plus de sens.
    await user.click(screen.getByRole("button", { name: "1A" }));
    await waitFor(() => expect(screen.queryByText("Gain après impôts")).toBeNull());
    expect(screen.getByText("Versé sur la période")).toBeTruthy();

    // Comparateur : les mêmes versements sur un titre.
    await user.click(screen.getByRole("button", { name: "Tout" }));
    const compare = within(screen.getByText("Comparer").closest("div.rounded-2xl") as HTMLElement);
    await user.selectOptions(compare.getByLabelText("Ce que je compare"), "PEA");
    await user.selectOptions(compare.getByLabelText("Avec"), "ETF Fictif");
    expect(await compare.findByText(/Les mêmes versements placés sur/)).toBeTruthy();

    // Deux fois le même élément : rien à comparer.
    await user.selectOptions(compare.getByLabelText("Avec"), "PEA");
    expect(await compare.findByText("Choisissez deux éléments différents.")).toBeTruthy();
  });
});
