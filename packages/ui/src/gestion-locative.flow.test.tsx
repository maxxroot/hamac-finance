import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NO_RENT_LEDGER, addDays, addMonths, rentMonths, type Lease } from "@hamac/core";
import { testBackend } from "@hamac/backend/testkit";
import { todayIso } from "@/lib/numbers";
import { ToastProvider } from "@/lib/toast";
import { AttestationLoyer } from "@/pages/AttestationLoyer";
import { AvisEcheance } from "@/pages/AvisEcheance";
import { Bien } from "@/pages/Bien";
import { GestionLocative } from "@/pages/GestionLocative";
import { Relance } from "@/pages/Relance";

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

/** Fiche d'un bien et pages à imprimer, à une adresse donnée. */
function showAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/immobilier/:id" element={<Bien />} />
            <Route path="/impression/relance/:leaseId/:level" element={<Relance />} />
            <Route path="/impression/avis/:leaseId/:month" element={<AvisEcheance />} />
            <Route path="/impression/attestation/:leaseId" element={<AttestationLoyer />} />
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
// Échéance le jour même : le loyer du mois en cours est « attendu », quel que soit le jour où tourne le test.
const dueDay = Number(today.slice(8, 10));
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
    const a = await rpc<Id>("leases.upsert", { propertyId: maison.id, lotId: c1.id, kind: "meuble", startDate: addMonths(`${thisMonth}-01`, -24), durationMonths: 12, rent: 500, charges: 50, dueDay, renters: [{ firstName: "Alice", lastName: "Fictive" }] });
    await rpc("leases.upsert", { propertyId: maison.id, lotId: c2.id, kind: "meuble", startDate: addMonths(`${thisMonth}-01`, -20), durationMonths: 12, rent: 400, deposit: 800, actualEnd: addDays(today, -80) });
    // Tout est pointé reçu, sauf le loyer du mois dernier de la chambre 1 et celui du mois en cours.
    const payments = (await workspace()).leases.flatMap((l: Lease) =>
      rentMonths(l, [], NO_RENT_LEDGER, today)
        .filter((m) => m.month < thisMonth && !(l.id === a.id && m.month === lastMonth))
        .map((m) => ({ leaseId: l.id, month: m.month, date: m.dueDate, amount: m.due })),
    );
    await rpc("rentPayments.addMany", { payments });
    await rpc("propertyExpenses.upsert", { propertyId: maison.id, date: addMonths(today, -10), category: "taxe_fonciere", amount: 1_200, yearly: true });
    await rpc("propertyReminders.upsert", { propertyId: maison.id, date: addDays(today, -5), label: "Relancer le syndic" });
    await rpc("properties.upsert", { kind: "residence_principale", name: "Résidence", value: 200_000 });

    show(<GestionLocative />);
    expect(await screen.findByRole("heading", { name: "Gestion locative" })).toBeTruthy();
    // Impayés : un bail, le mois dernier, loyer et charges.
    const impayes = screen.getByText("Non reçus", { selector: "span" }).closest("div") as HTMLElement;
    expect(texte(impayes)).toContain("550");
    expect(screen.getAllByText("Alice Fictive").length).toBeGreaterThan(0);
    // Lots vides : la chambre partie, et le parking jamais loué mais proposé.
    expect(screen.getAllByRole("link", { name: "Maison, Chambre 2" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Jamais loué")).toBeTruthy();
    // Le mois dernier : non reçu sur la chambre 1, qui se pointe d'un clic depuis la liste… ou par « Valider le mois ».
    await user.selectOptions(screen.getByLabelText("Mois des loyers"), lastMonth);
    expect(await screen.findAllByText("Non reçu")).toBeTruthy();
    expect(screen.getByText(/1 loyer à pointer/)).toBeTruthy();
    h.confirm = false;
    await user.click(screen.getByRole("button", { name: "Valider le mois" }));
    expect((await workspace()).rentPayments).toHaveLength(payments.length);
    h.confirm = true;
    await user.click(screen.getByRole("button", { name: "Valider le mois" }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(payments.length + 1));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Valider le mois" })).toBeNull());
    expect(await screen.findByText("Tous les loyers échus sont pointés.")).toBeTruthy();
    // Le mois en cours se pointe d'un clic.
    await user.selectOptions(screen.getByLabelText("Mois des loyers"), thisMonth);
    await user.click(await screen.findByRole("button", { name: "Marquer reçu : Maison, Chambre 1" }));
    await waitFor(async () => expect((await workspace()).rentPayments).toHaveLength(payments.length + 2));
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
      await rpc("leases.upsert", { propertyId: p.id, kind: "vide", startDate: `${thisMonth}-01`, durationMonths: 36, rent: 600, dueDay });
    }
    show(<GestionLocative />);
    expect(await screen.findByText("Tout le parc")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("Tous les loyers échus sont pointés.")).toBeTruthy();
    expect(screen.getByText("Tous les lots proposés à la location sont loués.")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Mois des loyers"), lastMonth);
    expect(await screen.findByText("Aucun loyer attendu ce mois-là.")).toBeTruthy();
  });

  it("loyers en retard : étape conseillée, courrier préparé, envoi noté puis retiré ; caution et CAF rappelées", async () => {
    const user = userEvent.setup();
    const studio = await rpc<Id>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000, address: "1 rue Fictive", postalCode: "75001", city: "Paris" });
    const start = addMonths(`${thisMonth}-01`, -3);
    const bail = await rpc<Lease>("leases.upsert", { propertyId: studio.id, kind: "vide", startDate: start, durationMonths: 36, rent: 600, charges: 50, dueDay: 1, landlord: "Propriétaire fictif", renters: [{ firstName: "Alice", lastName: "Fictive" }], guarantees: [{ kind: "caution", name: "Parent fictif" }] });
    await rpc("rentPayments.upsert", { leaseId: bail.id, month: start.slice(0, 7), date: start, amount: 300, method: "caf" });
    showAt(`/immobilier/${studio.id}?onglet=location`);
    const panel = within(await screen.findByRole("region", { name: "Loyers en retard" }));
    expect(panel.getByText(/Étape conseillée : mise en demeure\./)).toBeTruthy();
    expect(panel.getByRole("link", { name: "Préparer : mise en demeure" }).getAttribute("href")).toBe(`/impression/relance/${bail.id}/mise_en_demeure`);
    expect(panel.getByText(/caution/)).toBeTruthy();
    expect(panel.getByText(/CAF/)).toBeTruthy();
    await user.click(panel.getByRole("button", { name: "Noter l'envoi aujourd'hui" }));
    await waitFor(async () => expect((await workspace()).rentNotices).toMatchObject([{ leaseId: bail.id, level: "mise_en_demeure", sentOn: today }]));
    expect(await panel.findByText(/Mise en demeure déjà envoyé\./)).toBeTruthy();
    await user.click(panel.getByRole("button", { name: `Retirer l'envoi du ${today.split("-").reverse().join("/")}` }));
    await waitFor(async () => expect((await workspace()).rentNotices).toEqual([]));
    expect(screen.getByRole("link", { name: "Attestation de loyer" }).getAttribute("href")).toBe(`/impression/attestation/${bail.id}`);
    expect(screen.getAllByRole("link", { name: /^Avis d'échéance de / })[0]!.getAttribute("href")).toMatch(new RegExp(`/impression/avis/${bail.id}/`));
  });

  it("courriers à imprimer : relance à chaque étape avec le décompte, avis d'échéance, attestation", async () => {
    const studio = await rpc<Id>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000 });
    const start = addMonths(`${thisMonth}-01`, -2);
    const bail = await rpc<Lease>("leases.upsert", { propertyId: studio.id, kind: "vide", startDate: start, durationMonths: 36, rent: 600, charges: 50, landlord: "Propriétaire fictif", landlordAddress: "2 rue Fictive", renters: [{ firstName: "Alice", lastName: "Fictive" }], guarantees: [{ kind: "caution", name: "Parent fictif" }] });
    await rpc("rentPayments.upsert", { leaseId: bail.id, month: start.slice(0, 7), date: start, amount: 650 });
    const second = addMonths(start, 1).slice(0, 7);
    await rpc("rentPayments.upsert", { leaseId: bail.id, month: second, date: `${second}-01`, amount: 200 });

    let page = showAt(`/impression/relance/${bail.id}/rappel`);
    expect(await screen.findByText("Objet : loyer non reçu")).toBeTruthy();
    expect(screen.getByText("Alice Fictive")).toBeTruthy();
    expect(screen.getByText(/Décompte des sommes dues/)).toBeTruthy();
    page.unmount();
    page = showAt(`/impression/relance/${bail.id}/relance`);
    expect(await screen.findByText("Objet : relance pour loyer impayé")).toBeTruthy();
    page.unmount();
    page = showAt(`/impression/relance/${bail.id}/mise_en_demeure`);
    expect(await screen.findByText("Objet : mise en demeure de payer")).toBeTruthy();
    expect(screen.getByText("Lettre recommandée avec accusé de réception")).toBeTruthy();
    expect(screen.getByText(/personne qui s'est portée caution/)).toBeTruthy();
    page.unmount();
    // Étape inconnue : rappel amiable.
    page = showAt(`/impression/relance/${bail.id}/autre`);
    expect(await screen.findByText("Objet : loyer non reçu")).toBeTruthy();
    page.unmount();

    page = showAt(`/impression/avis/${bail.id}/${thisMonth}`);
    expect(await screen.findByRole("heading", { name: "Avis d'échéance" })).toBeTruthy();
    expect(screen.getByText("Reste dû des mois précédents")).toBeTruthy();
    page.unmount();
    page = showAt(`/impression/avis/${bail.id}/2000-01`);
    expect(await screen.findByText("Aucune échéance pour ce mois.")).toBeTruthy();
    page.unmount();

    page = showAt(`/impression/attestation/${bail.id}`);
    expect(await screen.findByRole("heading", { name: "Attestation de loyer" })).toBeTruthy();
    expect(screen.getByText(/il reste dû/)).toBeTruthy();
    page.unmount();
    // Tout pointé : à jour, et plus rien à relancer.
    await rpc("rentPayments.addMany", { payments: [{ leaseId: bail.id, month: second, date: `${second}-02`, amount: 450 }, { leaseId: bail.id, month: thisMonth, date: today, amount: 650 }] });
    page = showAt(`/impression/attestation/${bail.id}`);
    expect(await screen.findByText(/est à jour du paiement de ses loyers et charges/)).toBeTruthy();
    page.unmount();
    page = showAt(`/impression/relance/${bail.id}/rappel`);
    expect(await screen.findByText("Aucun loyer en retard sur ce bail.")).toBeTruthy();
    page.unmount();
    showAt("/impression/attestation/inconnu");
    expect(await screen.findByText("Bail introuvable.")).toBeTruthy();
  });
});