import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { ToastProvider } from "@/lib/toast";
import { Simulateurs } from "@/pages/Simulateurs";

/** Parcours réel de la page Simulateurs : l'interface parle au vrai backend (réglages fiscaux), sur une base en mémoire. */
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

beforeEach(async () => {
  h.backend = await testBackend();
});
afterEach(() => {
  cleanup();
  h.backend.close();
});

describe("page Simulateurs", () => {
  it("obligation par défaut, ajout d'un ETF en PEA, comparaison côte à côte", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    expect(await screen.findByText("Comparer")).toBeTruthy();
    expect(screen.getByText("Prélèvement forfaitaire ou barème ?")).toBeTruthy();
    expect(screen.getByText(/prime de remboursement, imposée comme des intérêts/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "ETF et actions" }));
    const table = screen.getByText("Comparer").closest("div.rounded-2xl") as HTMLElement;
    expect(within(table).getAllByText("ETF et actions").length).toBeGreaterThan(0);
    expect(within(table).getByText("meilleur")).toBeTruthy();
    expect(screen.getByText(/PEA de plus de 5 ans à la sortie/)).toBeTruthy();
  });

  it("saisie au clavier : le champ garde le focus et le texte tapé", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");
    await user.click(screen.getByRole("button", { name: "ETF et actions" }));
    const field = screen.getByRole("textbox", { name: "Durée" }) as HTMLInputElement;
    await user.click(field);
    await user.keyboard("{End}{Backspace}{Backspace}15");
    const after = screen.getByRole("textbox", { name: "Durée" }) as HTMLInputElement;
    expect(after).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(after.value).toBe("15");
  });

  it("saisie au clavier avec le routeur de l'application : la date et le nom tapés restent", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Routeur « data » comme l'application : la mise à jour de l'adresse n'est pas immédiate.
    const router = createMemoryRouter([{ path: "/simulateurs", element: <Simulateurs /> }], { initialEntries: ["/simulateurs"] });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("Comparer");
    const name = screen.getByLabelText("Nom de la simulation (Obligation)") as HTMLInputElement;
    await user.click(name);
    await user.keyboard(" à 5 ans");
    expect(name.value).toBe("Obligation à 5 ans");
    const maturity = screen.getByLabelText("Échéance") as HTMLInputElement;
    // Pendant la frappe, le navigateur annonce une date vide, puis une année partielle : rien ne doit revenir en arrière.
    fireEvent.change(maturity, { target: { value: "" } });
    expect(maturity.value).toBe("");
    fireEvent.change(maturity, { target: { value: "0003-03-01" } });
    expect(maturity.value).toBe("0003-03-01");
    expect(screen.queryByText(/Ces données ne permettent pas de calcul/)).toBeNull();
    fireEvent.change(maturity, { target: { value: "2032-03-01" } });
    expect(maturity.value).toBe("2032-03-01");
    expect(screen.getByText("01/03/2032")).toBeTruthy();
  });

  it("modifier, renommer, supprimer et annuler depuis le comparateur ; durée commune", async () => {
    const user = userEvent.setup();
    show(<Simulateurs />, "/simulateurs");
    await screen.findByText("Comparer");
    await user.click(screen.getByRole("button", { name: "Fonds euros" }));
    await user.click(screen.getByRole("button", { name: "Supprimer « Fonds euros »" }));
    expect(screen.getByText("« Fonds euros » supprimée.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Supprimer « Fonds euros »" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.getByRole("button", { name: "Supprimer « Fonds euros »" })).toBeTruthy();

    // La dernière simulation peut aussi partir.
    await user.click(screen.getByRole("button", { name: "Supprimer « Fonds euros »" }));
    await user.click(screen.getByRole("button", { name: "Supprimer « Obligation »" }));
    expect(screen.getByText(/Aucune simulation/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Annuler" }));

    await user.click(screen.getByRole("button", { name: "Renommer « Obligation »" }));
    const name = screen.getByLabelText("Nom de la simulation (Obligation)") as HTMLInputElement;
    await user.clear(name);
    await user.type(name, "OAT 2031");
    expect(screen.getByRole("button", { name: "Modifier « OAT 2031 »" })).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Durée de comparaison"), "commune");
    expect(screen.getByText(/toutes sur 5 ans, jusqu'au même jour/)).toBeTruthy();
    expect((screen.getByLabelText("Durée de détention") as HTMLInputElement).disabled).toBe(true);
  });
});
