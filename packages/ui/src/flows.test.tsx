import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { SuggestedContributions } from "@/components/SuggestedContributions";
import { InstitutionDialog } from "@/dialogs/InstitutionDialog";
import { AllocationDialog } from "@/dialogs/AllocationDialog";
import { LoanDialog } from "@/dialogs/LoanDialog";
import { PropertyDialog } from "@/dialogs/PropertyDialog";
import { StatementImportDialog } from "@/dialogs/StatementImportDialog";
import { TransactionDialog } from "@/dialogs/TransactionDialog";
import { makeXlsx } from "@/lib/xlsx.fixture";
import { ToastProvider } from "@/lib/toast";
import { useWorkspaceIndex } from "@/lib/workspace";
import { Bien } from "@/pages/Bien";
import { Crowdlending } from "@/pages/Crowdlending";
import { Notice, NOTICE_PLAN } from "@/pages/Notice";
import { Declaration } from "@/pages/Declaration";
import { Parametres } from "@/pages/Parametres";

/** Parcours réels : l'interface parle au vrai backend, sur une base en mémoire. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, file: { name: "", content: "" }, binary: { name: "", bytes: new Uint8Array() as Uint8Array } }));

vi.mock("@/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
vi.mock("@/lib/files", () => ({ pickTextFile: async () => h.file, pickBinaryFile: async () => h.binary, downloadText: () => undefined }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
interface Ws {
  params: Record<string, never> & { profile: { goal: string }; customClasses: unknown[] };
  transactions: Array<{ type: string; amount: number }>;
  loans: Array<{ kind: string; name: string; propertyId: string | null; principal: number; share: number }>;
  properties: Array<{ kind: string; ownership: string; name: string; purchasePrice: number | null; newBuild: boolean; notaryFees: number }>;
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
});
afterEach(() => {
  cleanup();
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
    const first = show(routes, `/immobilier/${bien.id}`);
    expect(await screen.findByRole("heading", { name: "Studio" })).toBeTruthy();
    expect(screen.getByText(/Investissement locatif · SCI familiale/)).toBeTruthy();
    expect(screen.getByText("Coût d'achat complet")).toBeTruthy();
    expect(screen.getByText("Prêt studio")).toBeTruthy();
    first.unmount();
    show(routes, "/immobilier/inconnu");
    expect(await screen.findByRole("heading", { name: "Bien introuvable" })).toBeTruthy();
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
    await user.click(within(row).getByRole("button", { name: "Modifier" }));
    expect(screen.queryByLabelText("Montant espéré")).toBeNull();
    await user.selectOptions(fieldOf("Statut"), "rembourse");
    expect(screen.getByLabelText("Remboursé le")).toBeTruthy();
    await user.selectOptions(fieldOf("Statut"), "defaut");
    expect(screen.getByLabelText("Montant espéré")).toBeTruthy();
    expect(fieldOf("Depuis").type).toBe("month");
    await user.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() => expect(within(screen.getByText("Résidence Lyon").closest("tr")!).getByText("En défaut")).toBeTruthy());
    expect(within(screen.getByText("Résidence Lyon").closest("tr")!).getByText(/compté/)).toBeTruthy();
  });

  it("établissement de crowdlending : prélèvement d'impôts et taux, proposé au forfait", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    show(<InstitutionDialog open institution={null} onClose={onClose} />);
    await user.type(await screen.findByLabelText("Nom"), "Bricks");
    await user.selectOptions(fieldOf("Type"), "crowdlending");
    const box = await screen.findByRole("checkbox", { name: "La plateforme prélève les impôts automatiquement" });
    expect(screen.queryByLabelText("Taux prélevé")).toBeNull();
    await user.click(box);
    await waitFor(() => expect(fieldOf("Taux prélevé").value).toMatch(/31,4/));
    await user.click(screen.getByRole("button", { name: /^(Ajouter|Créer|Enregistrer|Valider)/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const ws = await rpc<{ institutions: Array<{ kind: string; offers: { crowdlending?: { taxWithheld: boolean; taxRate: number } } }> }>("workspace.load");
    expect(ws.institutions[0]).toMatchObject({ kind: "crowdlending", offers: { crowdlending: { taxWithheld: true } } });
    expect(ws.institutions[0]!.offers.crowdlending!.taxRate).toBeCloseTo(0.314);
  });

  it("intérêts déclarés pour toute la plateforme : un montant par mois, rendement affiché", async () => {
    const user = userEvent.setup();
    const c = await rpc<{ id: string }>("accounts.upsert", { kind: "crowdlending", name: "Bricks" });
    show(<Crowdlending />);
    await user.click(await screen.findByRole("button", { name: "Déclarer les intérêts du mois" }));
    expect(await screen.findByText("Rendement réel annualisé")).toBeTruthy();
    await user.type(await screen.findByLabelText("Intérêts reçus"), "42");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(async () => expect((await workspace()).transactions).toMatchObject([{ type: "interets", amount: 42 }]));
    expect((await rpc<{ transactions: Array<{ accountId: string }> }>("workspace.load")).transactions[0]!.accountId).toBe(c.id);
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
    await user.click(await screen.findByRole("button", { name: "Répartition" }));
    const cible = await screen.findByLabelText("Cible de Actions");
    expect(screen.getByLabelText("Cible de Livrets")).toBeTruthy();
    expect((screen.getByLabelText("Cible de Livrets") as HTMLInputElement).disabled).toBe(true);
    await user.clear(cible);
    await user.type(cible, "20");
    await user.tab();
    expect((await screen.findAllByText(/reste .* à répartir/)).length).toBeGreaterThan(0);
    // Le brouillon survit au changement d'onglet.
    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.queryByLabelText("Cible de Actions")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Répartition" }));
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
    await user.click(await screen.findByRole("button", { name: "Actifs" }));
    const row = (await screen.findByText("ETF Monde")).closest("tr")!;
    await user.selectOptions(within(row).getByLabelText("Allocation de ETF Monde"), "out");
    await waitFor(async () => expect((await workspace()).assets.find((x) => x.id === a.id)?.inAllocation).toBe(false));
  });
});
