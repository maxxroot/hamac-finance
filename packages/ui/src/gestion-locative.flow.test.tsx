import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, addMonths } from "@hamac/core";
import { testBackend } from "@hamac/backend/testkit";
import { todayIso } from "@/lib/numbers";
import { ToastProvider } from "@/lib/toast";
import { GestionLocative } from "@/pages/GestionLocative";

/** Parcours réel de la vue du parc, sur le vrai backend en mémoire. Montants et noms fictifs. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, confirm: true }));

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
const workspace = () => rpc<Record<string, any>>("workspace.load");
type Id = { id: string };

function show(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/gestion-locative"]}>
          <Routes>
            <Route path="/gestion-locative" element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  h.backend = await testBackend();
  h.confirm = true;
  vi.stubGlobal("confirm", () => h.confirm);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  h.backend.close();
});

const today = todayIso();
const thisMonth = today.slice(0, 7);
const lastMonth = addMonths(`${thisMonth}-01`, -1).slice(0, 7);
const texte = (el: Element | null) => (el?.textContent ?? "").replace(/[  ]/g, " ");

describe("Gestion locative", () => {
  it("sans bien en location : un renvoi vers la page Immobilier", async () => {
    show(<GestionLocative />);
    expect(await screen.findByText(/Aucun bien en location/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Immobilier" }).getAttribute("href")).toBe("/immobilier");
  });

  it("loyers du mois, impayés, lots vides, biens et échéancier avec rappels", async () => {
    const user = userEvent.setup();
    const maison = await rpc<Id>("properties.upsert", { kind: "locatif", name: "Maison", value: 300_000, purchasePrice: 240_000, purchaseDate: addMonths(today, -36), rentalMode: "chambres" });
    const c1 = await rpc<Id>("lots.upsert", { propertyId: maison.id, name: "Chambre 1", kind: "chambre", targetRent: 500 });
    const c2 = await rpc<Id>("lots.upsert", { propertyId: maison.id, name: "Chambre 2", kind: "chambre" });
    await rpc("lots.upsert", { propertyId: maison.id, name: "Parking", kind: "parking", targetRent: 80 });
    const a = await rpc<Id>("leases.upsert", { propertyId: maison.id, lotId: c1.id, kind: "meuble", startDate: addMonths(`${thisMonth}-01`, -24), durationMonths: 12, rent: 500, charges: 50, renters: [{ firstName: "Alice", lastName: "Fictive" }] });
    await rpc("leases.upsert", { propertyId: maison.id, lotId: c2.id, kind: "meuble", startDate: addMonths(`${thisMonth}-01`, -20), durationMonths: 12, rent: 400, deposit: 800, actualEnd: addDays(today, -80) });
    await rpc("rentExceptions.set", { leaseId: a.id, month: lastMonth, kind: "impaye" });
    await rpc("propertyExpenses.upsert", { propertyId: maison.id, date: addMonths(today, -10), category: "taxe_fonciere", amount: 1_200, yearly: true });
    await rpc("propertyReminders.upsert", { propertyId: maison.id, date: addDays(today, -5), label: "Relancer le syndic" });
    await rpc("properties.upsert", { kind: "residence_principale", name: "Résidence", value: 200_000 });

    show(<GestionLocative />);
    expect(await screen.findByRole("heading", { name: "Gestion locative" })).toBeTruthy();
    // Impayés : un bail, le mois dernier, loyer et charges.
    const impayes = screen.getByText("Impayés", { selector: "span" }).closest("div") as HTMLElement;
    expect(texte(impayes)).toContain("550");
    expect(screen.getAllByText("Alice Fictive").length).toBeGreaterThan(0);
    // Lots vides : la chambre partie, et le parking jamais loué mais proposé.
    expect(screen.getAllByRole("link", { name: "Maison, Chambre 2" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Jamais loué")).toBeTruthy();
    // Le mois dernier : impayé sur la chambre 1.
    await user.selectOptions(screen.getByLabelText("Mois des loyers"), lastMonth);
    expect(await screen.findByText("Impayé")).toBeTruthy();
    // Biens : lots loués et loyer du mois ; la résidence principale n'y figure pas.
    expect(screen.queryByText("Résidence")).toBeNull();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    const annee = screen.queryByLabelText("Année de l'occupation") as HTMLSelectElement | null;
    if (annee) await user.selectOptions(annee, String(Number(today.slice(0, 4)) - 1));

    // Échéancier : le dépôt à rendre et le rappel sont en retard ; la taxe foncière arrive.
    expect(screen.getByText("En retard")).toBeTruthy();
    expect(screen.getByText("Rendre le dépôt de garantie")).toBeTruthy();
    expect(screen.getByText("Taxe foncière")).toBeTruthy();
    const rappel = screen.getByText("Relancer le syndic").closest("tr") as HTMLElement;
    await user.click(within(rappel).getByRole("button", { name: "Fait" }));
    await waitFor(async () => expect((await workspace()).propertyReminders).toMatchObject([{ label: "Relancer le syndic", doneOn: today }]));
    await waitFor(() => expect(screen.queryByText("Relancer le syndic")).toBeNull());

    // Nouveau rappel annuel, sur un lot, puis modifié et supprimé.
    await user.click(screen.getByRole("button", { name: "Nouveau rappel" }));
    let dialog = within(await screen.findByRole("dialog", { name: "Nouveau rappel" }));
    expect((dialog.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(dialog.getByLabelText("De quoi s'agit-il ?"), "Entretien de la chaudière");
    await user.selectOptions(dialog.getByLabelText("Lot (facultatif)"), dialog.getByRole("option", { name: "Chambre 1" }));
    await user.click(dialog.getByLabelText("Chaque année à la même date"));
    await user.type(dialog.getByLabelText("Commentaire (facultatif)"), "Contrat fictif");
    await user.click(dialog.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await workspace()).propertyReminders).toHaveLength(2));
    const ligne = (await screen.findByText("Entretien de la chaudière")).closest("tr") as HTMLElement;
    expect(texte(ligne)).toContain("Maison, Chambre 1");
    expect(texte(ligne)).toContain("chaque année");
    expect(within(ligne).queryByRole("button", { name: "Fait" })).toBeNull();
    await user.click(within(ligne).getByRole("button", { name: "Modifier" }));
    dialog = within(await screen.findByRole("dialog", { name: "Modifier le rappel" }));
    await user.selectOptions(dialog.getByLabelText("Bien"), maison.id);
    await user.clear(dialog.getByLabelText("De quoi s'agit-il ?"));
    await user.type(dialog.getByLabelText("De quoi s'agit-il ?"), "Ramonage");
    await user.click(dialog.getByRole("button", { name: "Valider" }));
    const ramonage = (await screen.findByText("Ramonage")).closest("tr") as HTMLElement;
    h.confirm = false;
    await user.click(within(ramonage).getByRole("button", { name: "Supprimer" }));
    expect((await workspace()).propertyReminders).toHaveLength(2);
    h.confirm = true;
    await user.click(within(ramonage).getByRole("button", { name: "Supprimer" }));
    await waitFor(async () => expect((await workspace()).propertyReminders).toHaveLength(1));
  });

  it("deux biens : une ligne « Tout le parc », et un mois sans loyer attendu", async () => {
    const user = userEvent.setup();
    for (const name of ["Studio A", "Studio B"]) {
      const p = await rpc<Id>("properties.upsert", { kind: "locatif", name, value: 100_000 });
      await rpc("leases.upsert", { propertyId: p.id, kind: "vide", startDate: `${thisMonth}-01`, durationMonths: 36, rent: 600 });
    }
    show(<GestionLocative />);
    expect(await screen.findByText("Tout le parc")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("Aucun loyer signalé impayé.")).toBeTruthy();
    expect(screen.getByText("Tous les lots proposés à la location sont loués.")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Mois des loyers"), lastMonth);
    expect(await screen.findByText("Aucun loyer attendu ce mois-là.")).toBeTruthy();
  });
});
