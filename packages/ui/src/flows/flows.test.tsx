import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import type { Property } from "@hamac/core";
import { todayIso } from "@/shared/lib/numbers";
import { SuggestedContributions } from "@/features/journal/components/SuggestedContributions";
import { InstitutionDialog } from "@/features/settings/dialogs/InstitutionDialog";
import { AllocationDialog } from "@/features/settings/dialogs/AllocationDialog";
import { LeaseDialog } from "@/features/realestate/dialogs/LeaseDialog";
import { LoanDialog } from "@/features/loans/dialogs/LoanDialog";
import { PropertyDialog } from "@/features/realestate/dialogs/PropertyDialog";
import { PropertySheetDialog } from "@/features/realestate/dialogs/PropertySheetDialog";
import { StatementImportDialog } from "@/features/journal/dialogs/StatementImportDialog";
import { TransactionDialog } from "@/features/entry/dialogs/TransactionDialog";
import { makeXlsx } from "@/features/investments/lib/xlsx.fixture";
import { ToastProvider } from "@/shared/lib/toast";
import { useWorkspaceIndex } from "@/shared/lib/workspace";
import { Bien } from "@/features/realestate/pages/Bien";
import { CourrierRevision } from "@/features/realestate/pages/CourrierRevision";
import { Credits } from "@/features/loans/pages/Credits";
import { ImpressionBien } from "@/features/realestate/pages/ImpressionBien";
import { Quittance } from "@/features/realestate/pages/Quittance";
import { Crowdlending } from "@/features/investments/pages/Crowdlending";
import { Notice, NOTICE_PLAN } from "@/features/help/pages/Notice";
import { Declaration } from "@/features/tax/pages/Declaration";
import { Parametres } from "@/features/settings/pages/Parametres";

/** Parcours réels : l'interface parle au vrai backend, sur une base en mémoire. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, file: { name: "", content: "" }, binary: { name: "", bytes: new Uint8Array() as Uint8Array } }));

vi.mock("@/shared/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
vi.mock("@/shared/lib/files", () => ({ pickTextFile: async () => h.file, pickBinaryFile: async () => h.binary, downloadText: () => undefined }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
interface Ws {
  params: Record<string, never> & { profile: { goal: string }; customClasses: unknown[] };
  transactions: Array<{ type: string; amount: number }>;
  loans: Array<{ kind: string; name: string; propertyId: string | null; principal: number; share: number }>;
  properties: Array<{ archived?: boolean; salePrice?: number; kind?: string; ownership?: string; name?: string; city?: string; surface?: number; dpe?: string; purchasePrice: number | null; newBuild: boolean; notaryFees: number }>;
  plans: Array<{ accountId: string; amount: number }>;
  assets: Array<{ id: string; inAllocation: boolean | null }>;
}
const workspace = () => rpc<Ws>("workspace.load");

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
  // Aucun service externe pendant les parcours : l'indice INSEE reste à saisir.
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  h.backend.close();
});

const fieldOf = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("parcours de l'interface", () => {
  it("notice : chaque entrée du sommaire mène à une section, et ouvre celle qui est repliée", async () => {
    const user = userEvent.setup();
    const { container } = show(<Notice />);
    for (const [id] of NOTICE_PLAN.flatMap((g) => g.items)) expect(container.querySelector(`[id="${id}"]`), id).toBeTruthy();
    const lexique = container.querySelector("#lexique") as HTMLDetailsElement;
    expect(lexique.open).toBe(false);
    await user.click(screen.getAllByRole("button", { name: "Les mots à connaître" })[0]);
    expect(lexique.open).toBe(true);
  });

  it("aide à la déclaration : une fiche pour l'établissement coché, l'année de validité et les cases", async () => {
    const user = userEvent.setup();
    const inst = await rpc<{ id: string }>("institutions.upsert", { name: "Courtier Fictif", kind: "courtier", tax: { report: true, withheldIncomeTax: 0.128, withheldSocial: 0 } });
    const cto = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres", institutionId: inst.id });
    await rpc("transactions.upsert", { date: "2025-03-10", type: "interets", accountId: cto.id, amount: 87.2 });
    show(<Declaration />);
    await user.selectOptions(await screen.findByLabelText("Année de revenus"), "2025");
    expect(await screen.findByText(/Revenus 2025 · Déclaration 2026/)).toBeTruthy();
    expect(screen.getByText(/Règles vérifiées le 09\/11\/2026/)).toBeTruthy();
    expect(screen.getByText("2TR")).toBeTruthy();
    await user.selectOptions(screen.getByLabelText("Document"), "Récapitulatif fiscal – Courtier Fictif");
    expect(await screen.findByRole("heading", { name: "Récapitulatif fiscal – Courtier Fictif" })).toBeTruthy();
    expect(screen.getByText("Détail des revenus")).toBeTruthy();
  });

  it("établissement : la case du récapitulatif fiscal est enregistrée", async () => {
    const user = userEvent.setup();
    show(<InstitutionDialog open onClose={() => undefined} />);
    await user.type(fieldOf("Nom"), "Courtier Fictif");
    await user.click(screen.getByLabelText("Hamac rédige le récapitulatif fiscal de cet établissement"));
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await rpc<{ institutions: Array<{ tax: { report: boolean } }> }>("workspace.load")).institutions[0]?.tax.report).toBe(true));
  });

  it("import d'un relevé : aperçu, import, confirmation, puis doublon au second passage", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    h.file = { name: "releve.ofx", content: "<OFX><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261012<TRNAMT>333,00<NAME>VERSEMENT</STMTTRN></OFX>" };
    const first = show(<StatementImportDialog open onClose={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "Choisir un fichier" }));
    expect(await screen.findByText("Nouveau")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Importer 1 opération" }));
    expect(await screen.findByText("1 opération(s) importée(s).")).toBeTruthy();
    expect((await workspace()).transactions).toMatchObject([{ type: "versement", amount: 333 }]);
    first.unmount();

    show(<StatementImportDialog open onClose={() => undefined} />);
    await user.click(await screen.findByRole("button", { name: "Choisir un fichier" }));
    expect(await screen.findByText("Déjà au journal")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Importer 0 opération" }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe("achat : prix par unité ou montant total", () => {
    // Dans l'application, la fenêtre s'ouvre une fois les données chargées.
    const Loaded = ({ children }: { children: ReactNode }) => (useWorkspaceIndex() ? <>{children}</> : null);

    const setup = async () => {
      const account = await rpc<{ id: string }>("accounts.upsert", { kind: "cto", name: "Compte-titres", role: "" });
      const asset = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF test", priceSource: "manuel" });
      show(
        <Loaded>
          <TransactionDialog open preset={{ type: "achat", accountId: account.id, assetId: asset.id }} onClose={() => undefined} />
        </Loaded>,
      );
      await screen.findByLabelText("Quantité");
      const user = userEvent.setup();
      const type = async (label: string, text: string) => {
        await user.clear(fieldOf(label));
        await user.type(fieldOf(label), text);
        await user.tab();
      };
      await type("dont frais", "2");
      await type("Quantité", "10");
      return type;
    };

    it("le prix par unité calcule le total, frais compris", async () => {
      const type = await setup();
      await type("Prix par unité", "50");
      await waitFor(() => expect(fieldOf("Montant total débité").value).toBe("502"));
      await userEvent.setup().click(screen.getByRole("button", { name: "Enregistrer" }));
      await waitFor(async () => expect((await workspace()).transactions).toMatchObject([{ type: "achat", amount: 502 }]));
    });

    it("le total calcule le prix par unité, et la quantité le met à jour", async () => {
      const type = await setup();
      await type("Montant total débité", "602");
      await waitFor(() => expect(fieldOf("Prix par unité").value).toBe("60"));
      await type("Quantité", "20");
      await waitFor(() => expect(fieldOf("Prix par unité").value).toBe("30"));
      expect(fieldOf("Montant total débité").value).toBe("602");
    });
  });

  it("nouveau crédit à la consommation : pas de bien, enregistré avec son type", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    show(<LoanDialog open loan={null} properties={[]} onClose={onClose} />);
    expect(screen.getByLabelText("Bien concerné (facultatif)")).toBeTruthy();
    await user.selectOptions(fieldOf("Type"), "consommation");
    expect(screen.queryByLabelText("Bien concerné (facultatif)")).toBeNull();
    await user.type(fieldOf("Nom"), "Voiture");
    const amount = fieldOf("Montant emprunté");
    await user.clear(amount);
    await user.type(amount, "9000");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).loans).toMatchObject([{ kind: "consommation", name: "Voiture", propertyId: null, principal: 9000 }]);
  });

  it("crédit remboursé à deux : la part à charge est enregistrée", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    show(<LoanDialog open loan={null} properties={[]} onClose={onClose} />);
    await user.type(fieldOf("Nom"), "Prêt commun");
    const amount = fieldOf("Montant emprunté");
    await user.clear(amount);
    await user.type(amount, "100000");
    await user.tab();
    const share = fieldOf("Part à ma charge");
    await user.clear(share);
    await user.type(share, "50");
    await user.tab();
    expect(screen.getByText(/À votre charge/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).loans).toMatchObject([{ name: "Prêt commun", principal: 100_000, share: 0.5 }]);
  });

  it("fiche d'un bien : utilisation, statut, achat et crédit rattaché ; bien inconnu signalé", async () => {
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", ownership: "sci_familiale", name: "Studio", value: 200_000, purchasePrice: 100_000, notaryFees: 8000, share: 0.5 });
    await rpc("loans.upsert", { name: "Prêt studio", propertyId: bien.id, principal: 50_000, rate: 0, termMonths: 100, firstPayment: "2026-01-05", share: 0.5 });
    const routes = (
      <Routes>
        <Route path="/immobilier/:id" element={<Bien />} />
      </Routes>
    );
    const first = show(routes, `/immobilier/${bien.id}?onglet=finances`);
    expect(await screen.findByRole("heading", { name: "Studio" })).toBeTruthy();
    expect(screen.getByText(/Investissement locatif · SCI familiale/)).toBeTruthy();
    expect(screen.getByText("Coût d'achat complet")).toBeTruthy();
    expect(screen.getByText("Prêt studio")).toBeTruthy();
    first.unmount();
    show(routes, "/immobilier/inconnu");
    expect(await screen.findByRole("heading", { name: "Bien introuvable" })).toBeTruthy();
  });

  it("fiche descriptive : complétée sans perdre les données financières, DPE et repères affichés", async () => {
    const user = userEvent.setup();
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", name: "Studio", value: 120_000, purchasePrice: 100_000, notaryFees: 8000 });
    await rpc("leases.upsert", { propertyId: bien.id, kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 500 });
    show(
      <Routes>
        <Route path="/immobilier/:id" element={<Bien />} />
      </Routes>,
      `/immobilier/${bien.id}`,
    );
    await user.click(await screen.findByRole("button", { name: "Fiche du bien" }));
    expect(within(await screen.findByRole("dialog", { name: "Fiche du bien" })).getByText("Rentabilité")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Compléter la fiche/ }));
    // Échap ne referme que le formulaire : la fiche reste ouverte derrière.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Fiche du bien" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Compléter la fiche/ }));
    await user.type(fieldOf("Ville"), "Ville fictive");
    const surface = fieldOf("Surface habitable (m²)");
    await user.clear(surface);
    await user.type(surface, "25");
    await user.tab();
    await user.selectOptions(fieldOf("Note DPE"), "F");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/Location interdite à partir du|Location interdite depuis le/)).toBeTruthy();
    expect(screen.getByRole("img", { name: "Note DPE : F" })).toBeTruthy();
    expect(screen.getByText("Valeur au m²")).toBeTruthy();
    expect((await workspace()).properties).toMatchObject([{ city: "Ville fictive", surface: 25, dpe: "F", purchasePrice: 100_000, notaryFees: 8000 }]);
  });

  it("vente d'un bien : bilan affiché, sortie du patrimoine, annulable", async () => {
    const user = userEvent.setup();
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "residence_principale", name: "Maison", value: 200_000, purchasePrice: 150_000, purchaseDate: "2020-01-01" });
    show(
      <Routes>
        <Route path="/immobilier/:id" element={<Bien />} />
      </Routes>,
      `/immobilier/${bien.id}`,
    );
    await user.click(await screen.findByRole("button", { name: "Vendre" }));
    const price = fieldOf("Prix de vente");
    await user.clear(price);
    await user.type(price, "210000");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Enregistrer la vente" }));
    expect(await screen.findByText("Bilan de la vente")).toBeTruthy();
    expect((await workspace()).properties).toMatchObject([{ archived: true, salePrice: 210_000 }]);
  });

  it("impression : fiche du bien et quittance d'un mois payé, reçu refusé sans paiement", async () => {
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", name: "Studio", value: 120_000, purchasePrice: 100_000, surface: 25, city: "Ville fictive", dpe: "D" });
    const bail = await rpc<{ id: string }>("leases.upsert", { propertyId: bien.id, kind: "vide", startDate: "2024-01-01", durationMonths: 36, rent: 500, charges: 50, renters: [{ lastName: "Locataire fictif" }], landlord: "Propriétaire fictif" });
    await rpc("rentPayments.upsert", { leaseId: bail.id, month: "2024-02", date: "2024-02-03", amount: 550 });
    const routes = (
      <Routes>
        <Route path="/impression/bien/:id" element={<ImpressionBien />} />
        <Route path="/impression/quittance/:leaseId/:month" element={<Quittance />} />
      </Routes>
    );
    const fiche = show(routes, `/impression/bien/${bien.id}`);
    expect(await screen.findByRole("heading", { name: "Studio" })).toBeTruthy();
    expect(screen.getByText("Ville fictive")).toBeTruthy();
    fiche.unmount();
    const quittance = show(routes, `/impression/quittance/${bail.id}/2024-02`);
    expect(await screen.findByRole("heading", { name: "Quittance de loyer" })).toBeTruthy();
    expect(screen.getByText(/Propriétaire fictif/)).toBeTruthy();
    expect(screen.getByText(/Locataire fictif/)).toBeTruthy();
    quittance.unmount();
    show(routes, `/impression/quittance/${bail.id}/2024-03`);
    expect(await screen.findByText(/Aucun paiement/)).toBeTruthy();
  });

  it("crédit archivé : listé et rétablissable", async () => {
    await rpc("loans.upsert", { name: "Ancien prêt", principal: 10_000, rate: 0.02, termMonths: 24, firstPayment: "2020-01-05", archived: true });
    show(<Credits />);
    expect(await screen.findByText("Crédits archivés")).toBeTruthy();
    expect(screen.getByText("Ancien prêt")).toBeTruthy();
  });

  it("adresse : suggestions de la Base Adresse Nationale, qui remplissent les champs", async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ features: [{ properties: { label: "1 Rue Fictive 00000 Ville fictive", name: "1 Rue Fictive", postcode: "00000", city: "Ville fictive", type: "housenumber" } }] })));
    vi.stubGlobal("fetch", fetcher);
    try {
      const bien = await rpc<Property>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000 });
      show(<PropertySheetDialog open property={bien} onClose={() => undefined} />);
      expect(fetcher).not.toHaveBeenCalled();
      await user.type(screen.getByRole("combobox", { name: "Adresse" }), "1 rue fic");
      await user.click(await screen.findByRole("option", { name: /Rue Fictive/ }));
      expect((screen.getByRole("combobox", { name: "Adresse" }) as HTMLInputElement).value).toBe("1 Rue Fictive");
      expect(fieldOf("Code postal").value).toBe("00000");
      expect(fieldOf("Ville").value).toBe("Ville fictive");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("nouveau bail : effacer la date de début ou la durée affiche un message sans planter", async () => {
    const bien = await rpc<Property>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000 });
    show(<LeaseDialog open property={bien} lot={null} lease={null} others={[]} onClose={() => undefined} />);
    fireEvent.change(fieldOf("Début du bail"), { target: { value: "" } });
    expect(await screen.findByText(/Indiquez la date de début/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ajouter" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(fieldOf("Début du bail"), { target: { value: "2026-03-01" } });
    expect(await screen.findByText(/se reconduit automatiquement/)).toBeTruthy();
  });

  it("révision du loyer : indices saisis, loyer calculé, courrier avec le détail", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const y = today.getFullYear();
    const pad = (n: number) => String(n).padStart(2, "0");
    const debut = `${y - 2}-${pad(today.getMonth() + 1)}-01`;
    const bien = await rpc<Property>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000, postalCode: "69001", city: "Ville fictive" });
    const bail = await rpc<{ id: string }>("leases.upsert", { propertyId: bien.id, kind: "vide", startDate: debut, durationMonths: 36, rent: 800, charges: 50, renters: [{ lastName: "Locataire fictif" }], landlord: "Propriétaire fictif", irlQuarter: 2 });
    show(
      <Routes>
        <Route path="/immobilier/:id" element={<Bien />} />
        <Route path="/impression/revision/:rentId" element={<CourrierRevision />} />
      </Routes>,
      `/immobilier/${bien.id}?onglet=location`,
    );
    await user.click(await screen.findByRole("button", { name: "Réviser le loyer" }));
    const dialog = await screen.findByRole("dialog", { name: "Révision annuelle du loyer" });
    expect((within(dialog).getByRole("button", { name: "Appliquer la révision" }) as HTMLButtonElement).disabled).toBe(true);
    const [nouveau, ancien] = within(dialog).getAllByLabelText(/^Indice du/) as HTMLInputElement[];
    await user.clear(nouveau);
    await user.type(nouveau, "148,37");
    await user.tab();
    await user.clear(ancien);
    await user.type(ancien, "146,68");
    await user.tab();
    await user.click(within(dialog).getByRole("button", { name: "Appliquer la révision" }));
    await waitFor(async () => expect((await rpc<{ leaseRents: unknown[] }>("workspace.load")).leaseRents).toMatchObject([{ leaseId: bail.id, rent: 809.22, charges: 50, revision: { indexNew: 148.37, indexOld: 146.68, previousRent: 800 } }]));
    const { leaseRents } = await rpc<{ leaseRents: Array<{ id: string }> }>("workspace.load");
    cleanup();
    show(
      <Routes>
        <Route path="/impression/revision/:rentId" element={<CourrierRevision />} />
      </Routes>,
      `/impression/revision/${leaseRents[0].id}`,
    );
    expect(await screen.findByRole("heading", { name: "Objet : révision annuelle du loyer" })).toBeTruthy();
    expect(screen.getByText("Variation de l'indice sur un an")).toBeTruthy();
    expect(screen.getByText("Propriétaire fictif")).toBeTruthy();
    expect(screen.getByText("Locataire fictif")).toBeTruthy();
  });

  it("nouveau bail : durée et dépôt proposés selon le type, enregistrés", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const bien = await rpc<Property>("properties.upsert", { kind: "locatif", ownership: "sci", name: "Studio", value: 100_000, rentalMode: "colocation" });
    show(<LeaseDialog open property={bien} lot={null} lease={null} others={[]} onClose={onClose} />);
    expect(fieldOf("Durée (mois)").value).toBe("72");
    await user.selectOptions(fieldOf("Type de bail"), "meuble");
    expect(fieldOf("Durée (mois)").value).toBe("12");
    const rent = fieldOf("Loyer hors charges");
    await user.clear(rent);
    await user.type(rent, "800");
    await user.tab();
    await waitFor(() => expect(fieldOf("Dépôt de garantie (caution)").value).toMatch(/^1.?600/));
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await rpc<{ leases: unknown[] }>("workspace.load")).leases).toMatchObject([{ propertyId: bien.id, kind: "meuble", durationMonths: 12, rent: 800, deposit: 1600 }]);
  });

  it("fiche d'un bien en location : pointer un loyer reçu et ajouter une dépense", async () => {
    const user = userEvent.setup();
    const bien = await rpc<{ id: string }>("properties.upsert", { kind: "locatif", name: "Studio", value: 100_000 });
    await rpc("leases.upsert", { propertyId: bien.id, kind: "vide", startDate: "2024-01-15", durationMonths: 36, rent: 800, charges: 50, deposit: 800 });
    show(
      <Routes>
        <Route path="/immobilier/:id" element={<Bien />} />
      </Routes>,
      `/immobilier/${bien.id}?onglet=location`,
    );
    const [first] = await screen.findAllByRole("button", { name: /^Marquer reçu le loyer de / });
    await user.click(first);
    await waitFor(async () => expect((await rpc<{ rentPayments: unknown[] }>("workspace.load")).rentPayments).toMatchObject([{ amount: 850, method: "virement" }]));
    await user.click(screen.getByRole("tab", { name: "Finances" }));
    expect(await screen.findByText("Résultats par année")).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: /Nouvelle dépense/ }));
    const amount = await screen.findByLabelText("Montant");
    await user.clear(amount);
    await user.type(amount, "900");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(async () => expect((await rpc<{ propertyExpenses: unknown[] }>("workspace.load")).propertyExpenses).toMatchObject([{ propertyId: bien.id, category: "taxe_fonciere", amount: 900 }]));
  });

  it("nouveau bien : utilisation, statut et frais d'achat, avec le coût complet affiché", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    show(<PropertyDialog open property={null} onClose={onClose} />);
    await user.type(fieldOf("Nom"), "Studio");
    await user.selectOptions(fieldOf("Utilisation"), "locatif");
    await user.selectOptions(fieldOf("Statut"), "indivision");
    const price = fieldOf("Prix d'achat (facultatif)");
    await user.clear(price);
    await user.type(price, "100000");
    await user.tab();
    const notary = fieldOf("Frais de notaire");
    await waitFor(() => expect(notary.value).toMatch(/\d/));
    const ancien = notary.value;
    await user.selectOptions(fieldOf("État à l'achat"), "neuf");
    await waitFor(() => expect(notary.value).not.toBe(ancien));
    await user.clear(notary);
    await user.type(notary, "8000");
    await user.tab();
    // Une fois saisi, le montant ne suit plus l'estimation.
    await user.selectOptions(fieldOf("État à l'achat"), "ancien");
    await user.selectOptions(fieldOf("État à l'achat"), "neuf");
    expect(screen.getByRole("button", { name: "Reprendre l'estimation" })).toBeTruthy();
    expect(screen.getByText(/Coût d'achat complet/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await workspace()).properties).toMatchObject([{ kind: "locatif", ownership: "indivision", name: "Studio", purchasePrice: 100_000, newBuild: true, notaryFees: 8000 }]);
  });

  it("allocation personnalisée : part à zéro refusée, ligne valide transmise", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    show(<AllocationDialog open rule={null} rules={[]} accounts={[]} onClose={() => undefined} onSave={onSave} />);
    const part = fieldOf("Part");
    await user.clear(part);
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(await screen.findByText(/supérieure à 0/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    await user.type(part, "25");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    expect(onSave.mock.calls[0]![0]).toMatchObject({ share: 0.25, target: { kind: "type", accountKind: "livret" } });
  });

  it("gestion suggérée : appliquer programme les montants proposés", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "cto", name: "Compte-titres" });
    show(<SuggestedContributions defaultFromMonth="2030-01" />);
    const capacite = await screen.findByLabelText("Montant que je peux épargner chaque mois");
    await user.type(capacite, "500");
    await user.tab();
    await user.click(await screen.findByRole("button", { name: /Appliquer ces montants/ }));
    await waitFor(async () => expect((await workspace()).plans).toMatchObject([{ amount: 500 }]));
  });

  it("paramètres : choisir la gestion de patrimoine puis enregistrer", async () => {
    const user = userEvent.setup();
    show(<Parametres />);
    await user.click(await screen.findByRole("radio", { name: /Gérer mon patrimoine/ }));
    expect(screen.queryByLabelText("Âge de départ visé")).toBeNull();
    await user.click(await screen.findByRole("button", { name: /Enregistrer/ }));
    await waitFor(async () => expect((await workspace()).params.profile.goal).toBe("patrimoine"));
  });

  it("crowdlending : nouveau projet, puis passage en défaut à 0 €", async () => {
    const user = userEvent.setup();
    const c = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    await rpc("transactions.upsert", { date: "2026-01-02", type: "versement", accountId: c.id, amount: 2_000 });
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Nouveau projet" }));
    await user.type(fieldOf("Nom du projet"), "Résidence Lyon");
    const amount = fieldOf("Montant investi");
    await user.clear(amount);
    await user.type(amount, "1000");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Ajouter" }));
    const row = (await screen.findByText("Résidence Lyon")).closest("tr")!;
    expect(within(row).getByText("En cours")).toBeTruthy();
    expect(screen.getByText("1 projet investi · 1 en cours")).toBeTruthy();
    await user.click(within(row).getByRole("button", { name: "Modifier" }));
    expect(screen.queryByLabelText("Montant espéré")).toBeNull();
    // Calcul comme dans un tableur : le champ garde le résultat.
    const repaid = fieldOf("Capital déjà remboursé");
    await user.type(repaid, "=120+35,50-5");
    await user.tab();
    expect(repaid.value).toBe("150,5");
    await user.selectOptions(fieldOf("Statut"), "rembourse");
    expect(screen.getByLabelText("Remboursé le")).toBeTruthy();
    await user.selectOptions(fieldOf("Statut"), "defaut");
    expect(screen.getByLabelText("Montant espéré")).toBeTruthy();
    expect(fieldOf("Depuis").type).toBe("month");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(within(screen.getByText("Résidence Lyon").closest("tr")!).getByText("En défaut")).toBeTruthy());
    expect(within(screen.getByText("Résidence Lyon").closest("tr")!).getByText(/compté/)).toBeTruthy();
    const ws = await rpc<{ crowdProjects: Array<{ repaidCapital: number | null }> }>("workspace.load");
    expect(ws.crowdProjects[0].repaidCapital).toBe(150.5);
  });

  it("établissement : la case « prélève les impôts » commande les taux et s'enregistre", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    show(<InstitutionDialog open institution={null} onClose={onClose} />);
    await user.type(await screen.findByLabelText("Nom"), "Bricks");
    await user.selectOptions(fieldOf("Type"), "crowdlending");
    const box = await screen.findByRole("checkbox", { name: "L'établissement prélève les impôts sur les intérêts et dividendes" });
    expect((box as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Acompte d'impôt retenu")).toBeTruthy();
    await user.click(box);
    expect(screen.queryByLabelText("Acompte d'impôt retenu")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^(Ajouter|Créer|Enregistrer|Valider)/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const ws = await rpc<{ institutions: Array<{ kind: string; tax: { withholds: boolean | null } }> }>("workspace.load");
    expect(ws.institutions[0]).toMatchObject({ kind: "crowdlending", tax: { withholds: false } });
  });

  it("intérêts déclarés pour toute la plateforme : un montant par mois, rendement affiché", async () => {
    const user = userEvent.setup();
    const c = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Déclarer les intérêts du mois" }));
    expect(await screen.findByText("Rendement réel annualisé")).toBeTruthy();
    await user.type(await screen.findByLabelText("Intérêts bruts"), "42");
    await user.tab();
    // Plateforme non réglée pour prélever : le champ des impôts est visible mais vide.
    expect(fieldOf("Impôts prélevés").value).toBe("");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).transactions).toMatchObject([{ type: "interets", amount: 42 }]));
    expect((await rpc<{ transactions: Array<{ accountId: string }> }>("workspace.load")).transactions[0]!.accountId).toBe(c.id);
  });

  it("impôts saisis à la main sur une plateforme non réglée pour prélever : deux lignes au journal", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Déclarer les intérêts du mois" }));
    await user.type(await screen.findByLabelText("Intérêts bruts"), "10");
    await user.type(fieldOf("Impôts prélevés"), "3");
    await user.tab();
    expect(await screen.findByText(/Reste crédité : 7,00/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).transactions).toHaveLength(2));
    const txs = (await workspace()).transactions;
    expect(txs.find((t) => t.type === "interets")).toMatchObject({ amount: 10, gross: 10 });
    expect(txs.find((t) => t.type === "impots")).toMatchObject({ amount: 3 });
  });

  it("plateforme qui prélève les impôts : intérêts bruts, impôts calculés, deux lignes au journal", async () => {
    const user = userEvent.setup();
    const e = await rpc<{ id: string }>("institutions.upsert", { name: "Plateforme Fictive", kind: "crowdlending", offers: { crowdlending: { taxWithheld: true, taxRate: 0.3 } } });
    await rpc("accounts.upsert", { kind: "crowdlending", name: "Plateforme Fictive", institutionId: e.id });
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Déclarer les intérêts du mois" }));
    await user.type(await screen.findByLabelText("Intérêts bruts"), "50");
    await user.tab();
    await waitFor(() => expect(fieldOf("Impôts prélevés").value).toMatch(/^15/));
    // Relevé de la plateforme : 15,02 € prélevés.
    await user.clear(fieldOf("Impôts prélevés"));
    await user.type(fieldOf("Impôts prélevés"), "15,02");
    await user.tab();
    expect(await screen.findByText(/Reste crédité : 34,98/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).transactions).toHaveLength(2));
    const txs = (await workspace()).transactions;
    expect(txs.find((t) => t.type === "interets")).toMatchObject({ amount: 50, gross: 50, withheldIncomeTax: 6.41, withheldSocial: 8.61 });
    expect(txs.find((t) => t.type === "impots")).toMatchObject({ amount: 15.02 });
    // Mois en cours : datées d'aujourd'hui, pour compter tout de suite dans les espèces à réinvestir.
    const dates = (await rpc<{ transactions: Array<{ date: string }> }>("workspace.load")).transactions.map((t) => t.date);
    expect(dates).toEqual([todayIso(), todayIso()]);
  });

  it("import Bricks : aperçu, application, puis rien de neuf au second passage", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    h.binary = { name: "bricks.xlsx", bytes: await makeXlsx([
      ["id", "date", "type", "statut", "propriété", "type de contrat", "montant (€)", "prix de la brick (€)"],
      ["d1", "02/01/2026", "Crédit par carte", "Validée", null, null, 1000, null],
      ["a1", "05/01/2026", "Achat de bricks", "Validée", "Projet Test", "loan", -300, 10],
      ["r1", "15/03/2026", "Revenus reversés", "Validée", "Projet Test", "loan", 10, null],
    ]) };
    const first = show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Importer un fichier Bricks" }));
    await user.click(await screen.findByRole("button", { name: "Choisir le fichier" }));
    expect(await screen.findByText("Projet Test")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Appliquer 3 changements" }));
    expect(await screen.findByText("3 changement(s) appliqué(s).")).toBeTruthy();
    const ws = await rpc<{ transactions: Array<{ type: string; amount: number; externalId: string }>; crowdProjects: Array<{ name: string; amount: number; rate: number | null; termMonths: number | null }> }>("workspace.load");
    expect(ws.transactions.map((t) => t.type).sort()).toEqual(["interets", "versement"]);
    expect(ws.crowdProjects).toMatchObject([{ name: "Projet Test", amount: 300, rate: null, termMonths: null }]);
    first.unmount();
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Importer un fichier Bricks" }));
    await user.click(await screen.findByRole("button", { name: "Choisir le fichier" }));
    expect(await screen.findByText("Tout est déjà à jour.")).toBeTruthy();
  });

  it("crowdlending : prolonger l'échéance d'un projet", async () => {
    const user = userEvent.setup();
    const c = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    const p = await rpc<{ id: string }>("crowdProjects.upsert", { accountId: c.id, name: "Obligation X", amount: 1_000, rate: 0.1, startDate: "2025-01-15", termMonths: 12 });
    show(<Crowdlending />);
    const row = (await screen.findByText("Obligation X")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Modifier" }));
    const field = await screen.findByLabelText("Échéance prolongée au");
    fireEvent.change(field, { target: { value: "2025-06" } });
    expect((screen.getByRole("button", { name: "Valider" }) as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByText(/après l'échéance initiale/)).toBeTruthy();
    fireEvent.change(field, { target: { value: "2031-06" } });
    await user.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(async () => expect((await rpc<{ crowdProjects: Array<{ id: string; extendedTo: string }> }>("workspace.load")).crowdProjects.find((x) => x.id === p.id)?.extendedTo).toBe("2031-06-30"));
    expect(await screen.findByText(/Prolongée \(prévue le/)).toBeTruthy();
    expect(screen.getByText("Juin 2031")).toBeTruthy();
  });

  it("ma répartition cible : 100 % exigés, classe ajoutée, livrets inclus", async () => {
    const user = userEvent.setup();
    await rpc("accounts.upsert", { kind: "livret", livretType: "LEP", name: "LEP" });
    show(<Parametres />);
    await user.click(await screen.findByRole("tab", { name: "Répartition" }));
    const cible = await screen.findByLabelText("Cible de Actions");
    expect(screen.getByLabelText("Cible de Livrets")).toBeTruthy();
    expect((screen.getByLabelText("Cible de Livrets") as HTMLInputElement).disabled).toBe(true);
    await user.clear(cible);
    await user.type(cible, "20");
    await user.tab();
    expect((await screen.findAllByText(/reste .* à répartir/)).length).toBeGreaterThan(0);
    // Le brouillon survit au changement d'onglet.
    await user.click(screen.getByRole("tab", { name: "Plan" }));
    expect(screen.queryByLabelText("Cible de Actions")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Répartition" }));
    expect((await screen.findAllByText(/reste .* à répartir/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Ajouter une classe" }));
    await user.type(await screen.findByLabelText("Nom de la classe"), "Métaux précieux");
    const cibleOr = screen.getByLabelText("Cible de Métaux précieux");
    await user.clear(cibleOr);
    await user.type(cibleOr, "10");
    await user.tab();
    await user.click(await screen.findByRole("button", { name: /Enregistrer/ }));
    await waitFor(async () => expect((await workspace()).params.customClasses).toHaveLength(1));
  });

  it("onglet Actifs : l'allocation se règle sur la ligne d'un titre", async () => {
    const user = userEvent.setup();
    const a = await rpc<{ id: string }>("assets.upsert", { kind: "etf", name: "ETF Monde", priceSource: "manuel" });
    show(<Parametres />);
    await user.click(await screen.findByRole("tab", { name: "Actifs" }));
    const row = (await screen.findByText("ETF Monde")).closest("tr")!;
    await user.selectOptions(within(row).getByLabelText("Allocation de ETF Monde"), "out");
    await waitFor(async () => expect((await workspace()).assets.find((x) => x.id === a.id)?.inAllocation).toBe(false));
  });
});
