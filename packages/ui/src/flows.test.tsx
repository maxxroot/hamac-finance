import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBackend, type Backend } from "@hamac/backend";
import { SuggestedContributions } from "@/components/SuggestedContributions";
import { InstitutionDialog } from "@/dialogs/InstitutionDialog";
import { AllocationDialog } from "@/dialogs/AllocationDialog";
import { LoanDialog } from "@/dialogs/LoanDialog";
import { StatementImportDialog } from "@/dialogs/StatementImportDialog";
import { ToastProvider } from "@/lib/toast";
import { Crowdlending } from "@/pages/Crowdlending";
import { Parametres } from "@/pages/Parametres";

/** Parcours réels : l'interface parle au vrai backend, sur une base en mémoire. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend, file: { name: "", content: "" } }));

vi.mock("@/lib/transport", () => ({
  isDesktop: true,
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));
vi.mock("@/lib/files", () => ({ pickTextFile: async () => h.file, downloadText: () => undefined }));

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const r = await h.backend.dispatch(name, input);
  if (!r.ok) throw new Error(r.error.message);
  return r.data as T;
}
interface Ws {
  params: Record<string, never> & { profile: { goal: string }; customClasses: unknown[] };
  transactions: Array<{ type: string; amount: number }>;
  loans: Array<{ kind: string; name: string; propertyId: string | null; principal: number }>;
  plans: Array<{ accountId: string; amount: number }>;
  assets: Array<{ id: string; inAllocation: boolean | null }>;
}
const workspace = () => rpc<Ws>("workspace.load");

function show(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.backend = createBackend({ databasePath: ":memory:", mode: "desktop", appVersion: "test", backupsDir: null }) as Backend;
});
afterEach(() => {
  cleanup();
  h.backend.close();
});

const fieldOf = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("parcours de l'interface", () => {
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
    await user.selectOptions(fieldOf("Statut"), "defaut");
    expect(screen.getByLabelText("Montant espéré")).toBeTruthy();
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
