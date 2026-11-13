import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMonths } from "@hamac/core";
import { testBackend } from "@hamac/backend/testkit";
import { todayIso } from "@/shared/lib/numbers";
import { ToastProvider } from "@/shared/lib/toast";
import { Bien } from "@/features/realestate/pages/Bien";

/** Parcours de l'onglet Rentabilité d'un bien, sur le vrai backend en mémoire. Montants et noms fictifs. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend }));

vi.mock("@/shared/lib/transport", () => ({
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

function showAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/immobilier/:id" element={<Bien />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  h.backend = await testBackend();
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  h.backend.close();
});

describe("onglet Rentabilité", () => {
  it("ouvert en premier pour un bien en location ; les provisions se règlent bien par bien", async () => {
    const user = userEvent.setup();
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", name: "T2 fictif", value: 150_000, purchasePrice: 130_000 });
    await rpc("leases.upsert", { propertyId: bien.id, kind: "vide", startDate: addMonths(todayIso(), -6), durationMonths: 36, rent: 800, charges: 100 });
    showAt(`/immobilier/${bien.id}`);

    expect((await screen.findByRole("tab", { name: "Rentabilité" })).getAttribute("aria-selected")).toBe("true");
    const carte = (await screen.findByText("Cashflow", { selector: "h2, h3, div" })).closest("div.rounded-2xl") as HTMLElement;
    expect(within(carte).getByText("Vacance locative")).toBeTruthy();
    // Pas d'avis de taxe foncière saisi : elle est estimée.
    expect(within(carte).getByText("Estimée")).toBeTruthy();
    // En tête, les chiffres d'un bien en location ; plus bas, le bilan depuis l'achat.
    expect(screen.getByText("Effort net depuis l'achat")).toBeTruthy();
    expect(screen.getByText("Enrichissement")).toBeTruthy();
    expect(screen.getByText("Bilan depuis l'achat")).toBeTruthy();
    expect(screen.getByText("Coût de revient")).toBeTruthy();
    expect(screen.getByText("Impôts sur les loyers")).toBeTruthy();
    expect(screen.getByText("Projection et revente")).toBeTruthy();

    await user.click(within(carte).getByRole("button", { name: /Hypothèses/ }));
    const fenetre = await screen.findByRole("dialog", { name: "Hypothèses du cashflow prévu" });
    await user.selectOptions(within(fenetre).getByLabelText("Vacance locative"), "montant");
    await user.type(within(fenetre).getByLabelText("Montant par an"), "600");
    await user.click(within(fenetre).getByRole("button", { name: "Valider" }));
    await waitFor(async () => {
      const ws = await rpc<{ properties: Array<{ vacancyProvision: unknown; worksProvision: unknown }> }>("workspace.load");
      expect(ws.properties[0]).toMatchObject({ vacancyProvision: { kind: "montant", value: 600 }, worksProvision: null });
    });
  });
});
