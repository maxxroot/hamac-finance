import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Gauge } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testBackend } from "@hamac/backend/testkit";
import { HamacCurve, HamacMark, Wordmark } from "@/shared/components/Brand";
import { PrintLine, PrintPage, PrintSection } from "@/shared/components/PrintPage";
import { DetailRow, EmptyRow, ExpandButton, Table, Td, Th, Tr, stopRowClick, useExpandedRow } from "@/shared/components/table";
import { AccountContext, useAccount, type Account } from "@/features/settings/lib/account";
import { CUSTOM_CLASS_COLORS, DPE_COLORS, GES_COLORS, BUCKET_COLORS, chartColors, useChartColors } from "@/shared/lib/colors";
import { useSetSetting, useSetting, useSystemInfo } from "@/shared/lib/queries";
import { SortTh, useSortable } from "@/shared/lib/sort";
import { Placeholder } from "@/app/Placeholder";

/** Petits modules transverses : tri des tableaux, tableaux dépliables, couleurs, réglages, logo, impression. */
const h = vi.hoisted(() => ({ backend: null as unknown as import("@hamac/backend").Backend }));

vi.mock("@/shared/lib/transport", () => ({
  call: async (name: string, input?: unknown) => {
    const r = await h.backend.dispatch(name, input);
    if (!r.ok) throw new Error(r.error.message);
    return r.data;
  },
}));

beforeEach(async () => {
  h.backend = await testBackend();
});
afterEach(() => {
  cleanup();
  document.documentElement.className = "";
  vi.restoreAllMocks();
  h.backend.close();
});

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("tri d'un tableau par colonne", () => {
  interface Ligne {
    nom: string;
    montant: number | null;
  }
  const LIGNES: Ligne[] = [
    { nom: "Béta", montant: 20 },
    { nom: "Alpha", montant: 100 },
    { nom: "Gamma", montant: null },
    { nom: "Delta", montant: 5 },
  ];

  function Tableau({ initial }: { initial?: { key: string; dir: "asc" | "desc" } }) {
    const { sorted, by } = useSortable(LIGNES, { nom: (l) => l.nom, montant: (l) => l.montant }, initial ?? null);
    return (
      <table>
        <thead>
          <tr>
            <SortTh {...by("nom")}>Nom</SortTh>
            <SortTh {...by("montant")} align="right">
              Montant
            </SortTh>
            <SortTh {...by("inconnue")}>Sans tri</SortTh>
          </tr>
        </thead>
        <tbody>
          {sorted.map((l) => (
            <tr key={l.nom}>
              <td>{l.nom}</td>
              <td>{l.montant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const noms = () => screen.getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.textContent);
  const entete = (nom: string) => screen.getByRole("columnheader", { name: nom });

  it("sans tri choisi, garde l'ordre d'origine et n'annonce aucun sens", () => {
    render(<Tableau />);
    expect(noms()).toEqual(["Béta", "Alpha", "Gamma", "Delta"]);
    expect(entete("Nom").getAttribute("aria-sort")).toBe("none");
  });

  it("colonne de texte : premier clic croissant, second clic décroissant", async () => {
    const user = userEvent.setup();
    render(<Tableau />);
    await user.click(within(entete("Nom")).getByRole("button"));
    expect(noms()).toEqual(["Alpha", "Béta", "Delta", "Gamma"]);
    expect(entete("Nom").getAttribute("aria-sort")).toBe("ascending");
    await user.click(within(entete("Nom")).getByRole("button"));
    expect(noms()).toEqual(["Gamma", "Delta", "Béta", "Alpha"]);
    expect(entete("Nom").getAttribute("aria-sort")).toBe("descending");
  });

  it("colonne de nombres : premier clic décroissant (le plus grand d'abord), valeur absente toujours en fin", async () => {
    const user = userEvent.setup();
    render(<Tableau />);
    await user.click(within(entete("Montant")).getByRole("button"));
    expect(noms()).toEqual(["Alpha", "Béta", "Delta", "Gamma"]);
    expect(entete("Montant").getAttribute("aria-sort")).toBe("descending");
    await user.click(within(entete("Montant")).getByRole("button"));
    expect(noms()).toEqual(["Delta", "Béta", "Alpha", "Gamma"]);
  });

  it("changer de colonne remplace le tri, et le tri initial est appliqué dès l'affichage", async () => {
    const user = userEvent.setup();
    render(<Tableau initial={{ key: "montant", dir: "asc" }} />);
    expect(noms()).toEqual(["Delta", "Béta", "Alpha", "Gamma"]);
    await user.click(within(entete("Nom")).getByRole("button"));
    expect(entete("Montant").getAttribute("aria-sort")).toBe("none");
    expect(entete("Nom").getAttribute("aria-sort")).toBe("ascending");
  });

  it("une colonne sans fonction de tri ne casse rien : l'ordre reste celui d'origine", async () => {
    const user = userEvent.setup();
    render(<Tableau />);
    await user.click(within(entete("Sans tri")).getByRole("button"));
    expect(noms()).toEqual(["Béta", "Alpha", "Gamma", "Delta"]);
  });
});

describe("tableaux", () => {
  function Liste() {
    const ligne = useExpandedRow();
    return (
      <Table>
        <thead>
          <tr>
            <Th align="right">Compte</Th>
            <Th align="center">Solde</Th>
          </tr>
        </thead>
        <tbody>
          {["a", "b"].map((id) => (
            <Fragment key={id}>
              <Tr {...ligne.rowProps(id)} aria-label={`ligne ${id}`}>
                <Td align="right">
                  <ExpandButton open={ligne.isOpen(id)} label={`compte ${id}`} />
                  Compte {id}
                </Td>
                <Td align="center" onClick={stopRowClick}>
                  <button type="button">Actions {id}</button>
                </Td>
              </Tr>
              {ligne.isOpen(id) && (
                <DetailRow cols={2}>Détail du compte {id}</DetailRow>
              )}
            </Fragment>
          ))}
          <EmptyRow cols={2}>Rien d'autre</EmptyRow>
        </tbody>
      </Table>
    );
  }

  it("un clic sur la ligne déplie son détail, un second le replie", async () => {
    const user = userEvent.setup();
    render(<Liste />);
    expect(screen.queryByText("Détail du compte a")).toBeNull();
    await user.click(screen.getByLabelText("ligne a"));
    expect(screen.getByText("Détail du compte a")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Masquer le détail : compte a" }).getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByLabelText("ligne a"));
    expect(screen.queryByText("Détail du compte a")).toBeNull();
    expect(screen.getByRole("button", { name: "Afficher le détail : compte a" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("une seule ligne est dépliée à la fois", async () => {
    const user = userEvent.setup();
    render(<Liste />);
    await user.click(screen.getByLabelText("ligne a"));
    await user.click(screen.getByLabelText("ligne b"));
    expect(screen.queryByText("Détail du compte a")).toBeNull();
    expect(screen.getByText("Détail du compte b")).toBeTruthy();
  });

  it("un double-clic compte pour un seul : la ligne reste dépliée", async () => {
    const user = userEvent.setup();
    render(<Liste />);
    await user.dblClick(screen.getByLabelText("ligne a"));
    expect(screen.getByText("Détail du compte a")).toBeTruthy();
  });

  it("le clic sur les boutons d'une cellule protégée ne déplie pas la ligne", async () => {
    const user = userEvent.setup();
    render(<Liste />);
    await user.click(screen.getByRole("button", { name: "Actions a" }));
    expect(screen.queryByText("Détail du compte a")).toBeNull();
  });

  it("la ligne vide s'étend sur toutes les colonnes", () => {
    render(<Liste />);
    expect(screen.getByText("Rien d'autre").getAttribute("colspan")).toBe("2");
  });
});

describe("couleurs", () => {
  it("chaque thème a ses couleurs de graphique : vert le jour, or la nuit pour la série principale", () => {
    expect(chartColors("clair").primary).toBe("#1f4a3a");
    expect(chartColors("sombre").primary).toBe("#d0ae6a");
    expect(Object.keys(chartColors("clair").buckets)).toEqual(Object.keys(BUCKET_COLORS));
  });

  it("les graphiques suivent le thème affiché quand la classe de la page change", async () => {
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useChartColors());
    expect(result.current.primary).toBe("#1f4a3a");
    act(() => {
      document.documentElement.classList.replace("light", "dark");
    });
    await waitFor(() => expect(result.current.primary).toBe("#d0ae6a"));
  });

  it("les étiquettes DPE et climat ont une couleur de texte lisible pour chaque lettre de A à G", () => {
    for (const lettre of ["A", "B", "C", "D", "E", "F", "G"] as const) {
      expect(DPE_COLORS[lettre].background).toMatch(/^#[0-9a-f]{6}$/);
      expect(GES_COLORS[lettre].text).toMatch(/^#(000000|ffffff)$/);
    }
    expect(DPE_COLORS.G.text).toBe("#ffffff");
    expect(CUSTOM_CLASS_COLORS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("réglages et informations système", () => {
  it("useSystemInfo rend les informations du serveur", async () => {
    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(Object.keys(result.current.data as object).length).toBeGreaterThan(0);
  });

  it("useSetting rend la valeur de secours tant que rien n'est enregistré", async () => {
    const { result } = renderHook(() => useSetting<string>("ui.theme", "systeme"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.value).toBe("systeme");
  });

  it("useSetSetting enregistre le réglage, que useSetting relit ensuite", async () => {
    const { result } = renderHook(() => ({ lu: useSetting<string>("ui.theme", "systeme"), ecrire: useSetSetting("ui.theme") }), { wrapper });
    await waitFor(() => expect(result.current.lu.isSuccess).toBe(true));
    await act(async () => {
      await result.current.ecrire.mutateAsync("sombre");
    });
    await waitFor(() => expect(result.current.lu.value).toBe("sombre"));
    const r = await h.backend.dispatch("settings.get", { key: "ui.theme" });
    expect(r).toMatchObject({ ok: true, data: "sombre" });
  });
});

describe("compte connecté (contexte)", () => {
  it("hors de l'application (aucun compte), useAccount rend null", () => {
    const { result } = renderHook(() => useAccount());
    expect(result.current).toBeNull();
  });

  it("dans l'application, rend le compte fourni et ses actions", () => {
    const refresh = vi.fn(async () => undefined);
    const compte = { me: { id: "u1", email: "marie@exemple.fr" }, refresh, justLoggedIn: true, closeLoginPrompt: vi.fn() } as unknown as Account;
    const { result } = renderHook(() => useAccount(), { wrapper: ({ children }) => <AccountContext.Provider value={compte}>{children}</AccountContext.Provider> });
    expect(result.current).toBe(compte);
    expect(result.current?.justLoggedIn).toBe(true);
  });
});

describe("logo et page à imprimer", () => {
  it("le logo prend la taille demandée, et le nom s'affiche", () => {
    const { container } = render(
      <>
        <HamacMark size={40} className="x" />
        <Wordmark />
      </>,
    );
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Hamac")).toBeTruthy();
  });

  it("la courbe dorée est cachée la nuit, sauf sur un fond vert (always)", () => {
    const { container } = render(
      <>
        <HamacCurve />
        <HamacCurve always />
      </>,
    );
    const [simple, toujours] = Array.from(container.querySelectorAll("svg"));
    expect(simple!.getAttribute("class")).toContain("dark:hidden");
    expect(toujours!.getAttribute("class")).not.toContain("dark:hidden");
  });

  it("la page d'impression propose d'imprimer, et ses sections affichent titre et lignes", async () => {
    const user = userEvent.setup();
    const imprimer = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(
      <PrintPage>
        <PrintSection title="Patrimoine">
          <PrintLine label="Total">12 000 €</PrintLine>
        </PrintSection>
      </PrintPage>,
    );
    expect(screen.getByRole("heading", { name: "Patrimoine" })).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
    expect(screen.getByText("12 000 €")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Imprimer ou enregistrer en PDF" }));
    expect(imprimer).toHaveBeenCalledTimes(1);
  });

  it("une page pas encore prête annonce son étape et son onglet d'origine", () => {
    render(<Placeholder item={{ path: "/x", label: "Bientôt", icon: Gauge, sheetTab: "Onglet fictif", step: 3, description: "Une page à venir" }} />);
    expect(screen.getByText("Bientôt")).toBeTruthy();
    expect(screen.getByText("Une page à venir")).toBeTruthy();
    expect(screen.getByText("Cette section arrive bientôt.")).toBeTruthy();
    expect(screen.getByText("Étape 3 · Calculs")).toBeTruthy();
    expect(screen.getByText("Onglet du sheet : Onglet fictif")).toBeTruthy();
  });
});
