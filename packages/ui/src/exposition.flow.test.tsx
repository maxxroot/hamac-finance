import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { amundiFake, testBackend, testMarket } from "@hamac/backend/testkit";
import { ToastProvider } from "@/lib/toast";
import { CompositionAdminCard } from "@/components/CompositionAdminCard";
import { AssetDialog } from "@/dialogs/AssetDialog";
import { Exposition } from "@/pages/Exposition";

/** Parcours réel de la page : l'interface parle au vrai backend, sur une base en mémoire et un faux site Amundi. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, market: null as unknown as import("@hamac/backend").SharedMarket, down: false }));

vi.mock("@/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}

function show(ui = <Exposition />) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** PEA : un ETF physique (600 €) et un ETF synthétique (400 €), au cours saisi à la main. */
async function seed() {
  const pea = await rpc<{ id: string }>("accounts.upsert", { kind: "pea", name: "Mon PEA" });
  const physique = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "Amundi Core MSCI World", isin: "IE000BI8OT95", priceSource: "manuel" });
  const swap = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "Amundi MSCI World Swap", isin: "LU1681043599", priceSource: "manuel" });
  await rpc("transactions.upsert", { date: "2025-01-05", type: "apport_initial", accountId: pea.id, amount: 1000 });
  await rpc("transactions.upsert", { date: "2025-01-06", type: "achat", accountId: pea.id, assetId: physique.id, amount: 600, quantity: 6 });
  await rpc("transactions.upsert", { date: "2025-01-06", type: "achat", accountId: pea.id, assetId: swap.id, amount: 400, quantity: 4 });
  await h.market.compositions.idle();
}

beforeEach(async () => {
  h.market = await testMarket(
    amundiFake({
      IE000BI8OT95: { replication: "Direct(Physical)", name: "Amundi Core MSCI World UCITS ETF Acc" },
      LU1681043599: { replication: "Indirect(Swap Based)", name: "Amundi MSCI World Swap UCITS ETF EUR Acc" },
      IE00B4L5Y983: { replication: "Direct(Physical)", name: "iShares Core MSCI World UCITS ETF" },
    }, { down: () => h.down }),
  );
  h.down = false;
  h.backend = await testBackend({ market: h.market });
});
afterEach(() => {
  cleanup();
  h.backend.close();
});

describe("page Exposition réelle", () => {
  it("répartit l'ETF physique, signale le synthétique, puis reprend la composition de l'équivalent proposé", async () => {
    const user = userEvent.setup();
    await seed();
    show();

    expect(await screen.findByText("Pays")).toBeTruthy();
    // Seul l'ETF physique est analysé au départ : 600 € sur 1 000 €.
    expect(screen.getByText("60 %")).toBeTruthy();
    const pays = within(screen.getByText("Pays").closest("div.rounded-2xl") as HTMLElement);
    expect(pays.getByText("États-Unis")).toBeTruthy();
    expect(pays.getByText("France")).toBeTruthy();
    expect(screen.getByText(/ETF synthétique : la composition qu'il publie est le panier/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Choisir un équivalent" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/iShares Core MSCI World UCITS ETF/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Utiliser" }));

    await waitFor(() => expect(screen.getByText(/Composition reprise de l'ETF iShares Core MSCI World UCITS ETF \(physique, votre choix\)/)).toBeTruthy());
    expect(screen.getByText("100 %")).toBeTruthy();
    expect(screen.getByText("aucun")).toBeTruthy();
  });

  it("un équivalent synthétique est refusé, avec la raison", async () => {
    const user = userEvent.setup();
    await seed();
    show();
    await user.click(await screen.findByRole("button", { name: "Choisir un équivalent" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Ou un autre ETF physique (ISIN)"), "LU1681043599");
    await user.click(dialog.getByRole("button", { name: "Vérifier et utiliser" }));
    expect(await dialog.findByText(/Choisissez un autre ETF que celui-ci/)).toBeTruthy();
  });

  it("au choix d'un ETF, la composition déjà reliée à un équivalent est annoncée, sans dire qui l'a choisi", async () => {
    const user = userEvent.setup();
    await h.market.compositions.ensure("LU1681043599");
    await h.market.compositions.ensure("IE00B4L5Y983");
    await h.market.compositions.setLink("LU1681043599", "IE00B4L5Y983");
    show(<AssetDialog open onClose={() => undefined} />);
    await user.type(screen.getByLabelText("ISIN"), "LU1681043599");
    expect(await screen.findByText(/^ETF synthétique : sa composition sera reprise de l'ETF iShares Core MSCI World UCITS ETF \(physique, même indice\)/)).toBeTruthy();
  });

  it("au choix d'un ETF inconnu, la composition est demandée tout de suite", async () => {
    const user = userEvent.setup();
    show(<AssetDialog open onClose={() => undefined} />);
    await user.type(screen.getByLabelText("ISIN"), "IE000BI8OT95");
    expect(await screen.findByText(/Récupération de la composition/)).toBeTruthy();
    await h.market.compositions.idle();
    expect((await h.market.compositions.info(["IE000BI8OT95"])).get("IE000BI8OT95")!.state).toBe("ok");
  });

  it("l'administrateur voit les échecs et corrige ou supprime un lien commun", async () => {
    const user = userEvent.setup();
    await h.market.compositions.ensure("LU1681043599");
    await h.market.compositions.ensure("IE000BI8OT95");
    await h.market.compositions.setLink("LU1681043599", "IE000BI8OT95");
    h.down = true;
    await h.market.compositions.ensure("FR0011871128");
    h.down = false;
    show(<CompositionAdminCard />);

    expect(await screen.findByText("1 en échec")).toBeTruthy();
    expect(screen.getByText("FR0011871128")).toBeTruthy();
    expect(screen.getByText("Amundi Core MSCI World UCITS ETF Acc")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Corriger" }));
    await user.type(screen.getByLabelText("Nouvel équivalent de LU1681043599"), "IE00B4L5Y983");
    await user.click(screen.getByRole("button", { name: "Vérifier" }));
    expect(await screen.findByText("iShares Core MSCI World UCITS ETF")).toBeTruthy();
    expect((await h.market.compositions.allLinks()).map((l) => l.proxyIsin)).toEqual(["IE00B4L5Y983"]);

    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(await screen.findByText("Aucun lien pour l'instant.")).toBeTruthy();
  });

  it("rien pour un utilisateur qui n'administre pas l'instance", async () => {
    h.backend.close();
    h.backend = await testBackend({ market: h.market, isAdmin: false });
    const { container } = show(<CompositionAdminCard />);
    await waitFor(() => expect(container.textContent).toBe(""));
  });
});
