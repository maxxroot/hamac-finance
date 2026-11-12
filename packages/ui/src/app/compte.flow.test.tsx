import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rawFor } from "@hamac/backend";
import { testProvider } from "@hamac/backend/testkit";
// Le vrai serveur web (routes /api/auth/* et /api/rpc/*) tourne en mémoire derrière un `fetch` simulé : l'interface
// parle donc à de vraies sessions, de vrais codes TOTP et au vrai backend de chaque compte.
import { createApp, type ServerConfig } from "@/../../../apps/server/src/app";
import { totp } from "@/../../../apps/server/src/totp";
import { AppearanceCard } from "@/features/settings/components/AppearanceCard";
import { App } from "@/app/App";
import { AuthGate } from "@/app/layout/AuthGate";
import { RouteError } from "@/app/layout/RouteError";
import { Shell } from "@/app/layout/Shell";
import { TwoFactorBanner, TwoFactorPrompt } from "@/app/components/TwoFactorNudge";
import { TwoFactorCard } from "@/features/settings/components/TwoFactorCard";
import { useTheme } from "@/shared/lib/theme";
import { ToastProvider } from "@/shared/lib/toast";
import { Onboarding } from "@/features/entry/components/Onboarding";
import { Parametres } from "@/features/settings/pages/Parametres";

type Server = Awaited<ReturnType<typeof createApp>>;

/** Parcours réels : l'interface parle au vrai serveur, sur une base en mémoire. */
const h = vi.hoisted(() => ({
  server: null as unknown as Awaited<ReturnType<typeof import("@/../../../apps/server/src/app").createApp>>,
  /** Cookie de session du « navigateur ». */
  cookie: "",
  /** Horloge du serveur : les codes TOTP et les étapes de connexion en dépendent. */
  clock: 0,
  /** Réponse imposée à une adresse (panne simulée), sinon la requête va au serveur. */
  override: null as null | ((url: string) => Response | null),
  downloads: [] as Array<{ name: string; content: string }>,
}));

// Le téléchargement des codes de secours passe par un lien temporaire que jsdom ne sait pas créer : on le note.
vi.mock("@/shared/lib/files", () => ({
  pickTextFile: async () => ({ name: "", content: "" }),
  pickBinaryFile: async () => ({ name: "", bytes: new Uint8Array() }),
  downloadText: (name: string, content: string) => h.downloads.push({ name, content }),
}));

const SETUP = "code-installation-test";
const KEY = Buffer.alloc(32, 7).toString("base64");
const EMAIL = "marie@exemple.fr";
const PASSWORD = "motdepasse-long";
const STEP = 30_000;

/** Le « navigateur » : garde le cookie de session, comme le ferait `credentials: "include"`. */
async function serve(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = String(input);
  // Aucun service externe pendant les parcours.
  if (!url.startsWith("/api/")) return new Response("", { status: 503 });
  const forced = h.override?.(url);
  if (forced) return forced;
  const headers = new Headers(init.headers);
  if (h.cookie) headers.set("cookie", h.cookie);
  headers.set("x-forwarded-for", "10.0.0.1");
  const res = await h.server.app.request(url, { ...init, headers });
  const set = res.headers.get("set-cookie");
  if (set) h.cookie = set.split(";")[0]!.endsWith("=") ? "" : set.split(";")[0]!;
  return res;
}

async function post<T = Record<string, any>>(path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await serve(path, { method: "POST", headers: { "Content-Type": "application/json", "X-Hamac": "1" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as T };
}

async function rpc<T = unknown>(name: string, input?: unknown): Promise<T> {
  const { json } = await post<{ ok: boolean; data: T; error?: { message: string } }>(`/api/rpc/${name}`, input ?? null);
  if (!json.ok) throw new Error(json.error?.message);
  return json.data;
}

/** Crée un compte directement auprès du serveur (le premier est administrateur) et y ouvre une session. */
async function signup(email = EMAIL, password = PASSWORD, invite = SETUP) {
  const res = await post("/api/auth/signup", { email, password, invite });
  expect(res.status).toBe(200);
}
const quit = () => post("/api/auth/logout");

function fromBase32(text: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}

/** Un code jamais utilisé : on avance d'un pas, l'horloge du serveur le tolère. */
function freshCode(secret: Buffer): string {
  h.clock += STEP;
  return totp(secret, h.clock);
}

/** Active la double authentification sur le compte connecté. */
async function activateTwoFactor() {
  const setup = await post<{ secret: string }>("/api/auth/2fa/setup", { password: PASSWORD });
  const secret = fromBase32(setup.json.secret);
  const confirm = await post<{ recoveryCodes: string[] }>("/api/auth/2fa/confirm", { code: totp(secret, h.clock) });
  expect(confirm.status).toBe(200);
  return { secret, recoveryCodes: confirm.json.recoveryCodes };
}

async function startServer(overrides: Partial<ServerConfig> = {}) {
  await h.server?.close();
  const server: Server = await createApp({ provider: testProvider(), dataDir: null, signup: "open", secureCookies: false, trustProxy: true, staticDir: null, appVersion: "test", autoRefreshPrices: false, setupCode: SETUP, twoFactorKey: KEY, now: () => h.clock, ...overrides });
  h.server = server;
  return server;
}

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

/** Adresse courante : les liens du bandeau et de la fenêtre se vérifient par là. */
function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="adresse">{pathname + search}</p>;
}

/** L'application connectée, sans le routeur par hash de App (qui garde son état d'un test à l'autre). */
function showShell(path = "/") {
  return show(
    <AuthGate>
      {() => (
        <>
          <Where />
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<Onboarding />} />
              <Route path="/parametres" element={<Parametres />} />
              <Route path="*" element={<p>Page sans contenu pour ce test</p>} />
            </Route>
          </Routes>
        </>
      )}
    </AuthGate>,
    path,
  );
}

/**
 * jsdom n'a pas matchMedia : on simule l'écran (largeur et thème du système), que les tests font varier
 * comme le ferait la fenêtre du navigateur en se redimensionnant ou à la tombée de la nuit.
 */
function stubScreen(initial: { wide: boolean; dark: boolean }) {
  const listeners = new Set<() => void>();
  const state = {
    ...initial,
    change(patch: Partial<typeof initial>) {
      Object.assign(state, patch);
      act(() => listeners.forEach((l) => l()));
    },
  };
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query.includes("min-width") ? state.wide : query.includes("prefers-color-scheme") ? state.dark : false;
    },
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  return state;
}

const fieldOf = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

/** Le serveur oublie tout entre deux tests : comptes, sessions, invitations. */
async function resetAccounts() {
  await rawFor(await testProvider().session()).exec("TRUNCATE comptes.users, comptes.tenants, comptes.sessions, comptes.invites CASCADE");
}

/** jsdom ne fait aucun défilement : on note les appels pour vérifier que la carte vient bien à l'écran. */
const scrollIntoView = vi.fn();

beforeEach(async () => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  h.clock = Date.now();
  h.cookie = "";
  h.override = null;
  h.downloads = [];
  await startServer();
  await resetAccounts();
  vi.stubGlobal("fetch", vi.fn(serve));
  stubScreen({ wide: true, dark: false });
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  await h.server.close();
});

describe("connexion et création de compte", () => {
  it("instance neuve : le compte administrateur se crée avec le code d'installation, puis la fenêtre de protection s'ouvre", async () => {
    const user = userEvent.setup();
    showShell();
    expect(await screen.findByRole("heading", { name: "Première connexion" })).toBeTruthy();
    expect(screen.getByText(/créez le compte administrateur de cette instance/)).toBeTruthy();
    // Un seul compte possible : pas de bascule entre connexion et création.
    expect(screen.queryByRole("button", { name: "Connexion" })).toBeNull();

    await user.type(fieldOf("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.type(fieldOf("Code d'installation"), "mauvais-code");
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText(/Code d'installation invalide/)).toBeTruthy();

    await user.clear(fieldOf("Code d'installation"));
    await user.type(fieldOf("Code d'installation"), SETUP);
    await user.clear(fieldOf("Mot de passe"));
    await user.type(fieldOf("Mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText("Mot de passe trop court (10 caractères minimum).")).toBeTruthy();

    await user.clear(fieldOf("Mot de passe"));
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));

    // Connecté : l'application s'affiche, avec l'adresse du compte dans la barre latérale.
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect(screen.getByText(EMAIL)).toBeTruthy();
    expect(await h.server.users.count()).toBe(1);
    // Compte administrateur sans double authentification : la fenêtre insiste.
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Protégez votre compte")).toBeTruthy();
    expect(dialog.getByText(/Vous utilisez le compte administrateur/)).toBeTruthy();
  });

  it("compte existant : un mauvais mot de passe est refusé, le bon ouvre la session", async () => {
    const user = userEvent.setup();
    await signup();
    await quit();
    showShell();
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    // Inscriptions ouvertes : on peut basculer vers la création de compte, qui n'exige pas de code.
    await user.click(await screen.findByRole("button", { name: "Créer un compte" }));
    expect(screen.getByRole("heading", { name: "Créer un compte" })).toBeTruthy();
    expect(screen.getByText("10 caractères minimum.")).toBeTruthy();
    expect(screen.queryByLabelText("Code d'invitation")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Connexion" }));

    await user.type(fieldOf("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), "pas-le-bon-mot-de-passe");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("E-mail ou mot de passe incorrect.")).toBeTruthy();

    await user.clear(fieldOf("Mot de passe"));
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect(screen.queryByText("E-mail ou mot de passe incorrect.")).toBeNull();
  });

  it("inscriptions ouvertes : un second compte se crée sans code, et ses données sont à lui", async () => {
    const user = userEvent.setup();
    await signup();
    await rpc("institutions.upsert", { name: "Banque de Marie", kind: "banque" });
    await quit();
    showShell();
    await user.click(await screen.findByRole("button", { name: "Créer un compte" }));
    await user.type(fieldOf("E-mail"), "ami@exemple.fr");
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect(screen.getByText("ami@exemple.fr")).toBeTruthy();
    expect((await rpc<{ institutions: unknown[] }>("workspace.load")).institutions).toEqual([]);
  });

  it("inscriptions fermées : aucune création de compte n'est proposée", async () => {
    await startServer({ signup: "closed" });
    await signup();
    await quit();
    showShell();
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Créer un compte" })).toBeNull();
  });

  it("sur invitation : le code est exigé, un code faux est refusé, un bon code crée un compte ordinaire", async () => {
    const user = userEvent.setup();
    await startServer({ signup: "invite" });
    await signup();
    await quit();
    showShell();
    await user.click(await screen.findByRole("button", { name: "Créer un compte" }));
    expect(screen.getByText("Fourni par la personne qui gère cette instance.")).toBeTruthy();

    await user.type(fieldOf("E-mail"), "ami@exemple.fr");
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.type(fieldOf("Code d'invitation"), "invitation-inventee");
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText("Code d'invitation invalide ou expiré.")).toBeTruthy();

    await user.clear(fieldOf("Code d'invitation"));
    await user.type(fieldOf("Code d'invitation"), await h.server.users.createInvite());
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect(screen.getByText("ami@exemple.fr")).toBeTruthy();
    // Ce n'est pas l'administrateur : la fenêtre n'emploie pas le ton réservé à ce compte.
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Ce compte contient vos données financières/)).toBeTruthy();
    expect(dialog.queryByText(/compte administrateur/)).toBeNull();
  });

  it("un lien d'invitation ouvre directement la création de compte, code déjà rempli", async () => {
    await startServer({ signup: "invite" });
    await signup();
    await quit();
    window.history.replaceState(null, "", "/?invitation=code-du-lien");
    showShell();
    expect(await screen.findByRole("heading", { name: "Créer un compte" })).toBeTruthy();
    expect(fieldOf("Code d'invitation").value).toBe("code-du-lien");
  });

  it("une réponse du serveur sans message (passerelle en panne) s'affiche avec son numéro d'erreur", async () => {
    const user = userEvent.setup();
    await signup();
    await quit();
    h.override = (url) => (url === "/api/auth/login" ? new Response("<html>Bad gateway</html>", { status: 502 }) : null);
    showShell();
    await user.type(await screen.findByLabelText("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText("Erreur 502")).toBeTruthy();
  });

  it("se déconnecter ramène à la connexion, et la session est bien fermée côté serveur", async () => {
    const user = userEvent.setup();
    await signup();
    showShell();
    await user.click(await screen.findByRole("button", { name: "Se déconnecter" }));
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    expect((await serve("/api/auth/me")).status).toBe(401);
  });

  it("une session qui expire pendant l'usage ramène à la connexion à la première action", async () => {
    const user = userEvent.setup();
    await signup();
    showShell();
    await user.click(await screen.findByRole("button", { name: "Mode discret" }));
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.privacyMode" })).toBe(true));
    // Le serveur oublie la session (sessions fermées depuis un autre appareil).
    await rawFor(await testProvider().session()).exec("DELETE FROM comptes.sessions");
    await user.click(screen.getByRole("button", { name: "Montants masqués" }));
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
  });
});

describe("connexion avec double authentification", () => {
  /** Un compte protégé, déconnecté : il reste à saisir le mot de passe puis un code. */
  async function protectedAccount() {
    await signup();
    const two = await activateTwoFactor();
    await quit();
    return two;
  }
  async function enterPassword(user: ReturnType<typeof userEvent.setup>) {
    await user.type(await screen.findByLabelText("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("heading", { name: "Vérification" })).toBeTruthy();
  }
  const validate = () => screen.getByRole("button", { name: "Valider" }) as HTMLButtonElement;

  it("la saisie du code est mise en forme, un faux code est refusé, puis le bon code ouvre la session", async () => {
    const user = userEvent.setup();
    const { secret } = await protectedAccount();
    showShell();
    await enterPassword(user);
    // Pas de session tant qu'aucun code n'est accepté.
    expect(screen.queryByText("Bienvenue dans Hamac")).toBeNull();
    expect(validate().disabled).toBe(true);

    // Seuls les chiffres sont gardés, six au plus.
    await user.type(fieldOf("Code de votre application"), "12ab34");
    expect(fieldOf("Code de votre application").value).toBe("1234");
    expect(validate().disabled).toBe(true);
    await user.clear(fieldOf("Code de votre application"));
    await user.type(fieldOf("Code de votre application"), "0000009");
    expect(fieldOf("Code de votre application").value).toBe("000000");
    await user.click(validate());
    expect(await screen.findByText(/Code incorrect ou déjà utilisé/)).toBeTruthy();
    expect(fieldOf("Code de votre application").value).toBe("");

    // Un code de secours se saisit en majuscules, avec un tiret au milieu.
    await user.click(screen.getByRole("button", { name: "Utiliser un code de secours" }));
    expect(screen.queryByText(/Code incorrect ou déjà utilisé/)).toBeNull();
    await user.type(fieldOf("Code de secours"), "abcd12345678");
    expect(fieldOf("Code de secours").value).toBe("ABCD-1234");
    await user.click(validate());
    expect(await screen.findByText(/Code incorrect ou déjà utilisé/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Utiliser le code de l'application" }));
    await user.type(fieldOf("Code de votre application"), freshCode(secret));
    await user.click(validate());
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect((await serve("/api/auth/me")).status).toBe(200);
  });

  it("un code de secours ouvre la session une seule fois", async () => {
    const user = userEvent.setup();
    const { recoveryCodes } = await protectedAccount();
    showShell();
    await enterPassword(user);
    await user.click(screen.getByRole("button", { name: "Utiliser un code de secours" }));
    await user.type(fieldOf("Code de secours"), recoveryCodes[0]!.toLowerCase());
    await user.click(validate());
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    expect((await (await serve("/api/auth/me")).json()).twoFactor.recoveryCodesLeft).toBe(9);

    // Même code, nouvelle connexion : refusé.
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await enterPassword(user);
    await user.click(screen.getByRole("button", { name: "Utiliser un code de secours" }));
    await user.type(fieldOf("Code de secours"), recoveryCodes[0]!);
    await user.click(validate());
    expect(await screen.findByText(/Code incorrect ou déjà utilisé/)).toBeTruthy();
    expect(screen.queryByText("Bienvenue dans Hamac")).toBeNull();
  });

  it("après cinq codes faux, il faut reprendre au mot de passe, avec le message du serveur", async () => {
    const user = userEvent.setup();
    await protectedAccount();
    showShell();
    await enterPassword(user);
    for (let i = 0; i < 5; i++) {
      await user.type(fieldOf("Code de votre application"), "000000");
      await user.click(validate());
      // Chaque essai raté vide le champ ; seul le dernier renvoie à la connexion.
      if (i < 4) await waitFor(() => expect(fieldOf("Code de votre application").value).toBe(""));
    }
    expect(await screen.findByRole("heading", { name: "Connexion" })).toBeTruthy();
    expect(screen.getByText("5 essais incorrects : reconnectez-vous.")).toBeTruthy();
    expect(fieldOf("E-mail").value).toBe(EMAIL);
    expect(fieldOf("Mot de passe").value).toBe("");
  });

  it("une étape de connexion trop ancienne renvoie au mot de passe", async () => {
    const user = userEvent.setup();
    const { secret } = await protectedAccount();
    showShell();
    await enterPassword(user);
    h.clock += 6 * 60_000;
    await user.type(fieldOf("Code de votre application"), freshCode(secret));
    await user.click(validate());
    expect(await screen.findByText("Cette étape a expiré : saisissez de nouveau votre mot de passe.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Connexion" })).toBeTruthy();
    expect(fieldOf("Mot de passe").value).toBe("");
  });

  it("clé de sécurité du serveur perdue : la connexion explique la panne au lieu de laisser entrer sans code", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await protectedAccount();
    await startServer({ twoFactorKey: undefined });
    showShell();
    await user.type(await screen.findByLabelText("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByText(/la clé de sécurité de ce serveur est absente ou a changé/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Vérification" })).toBeNull();
  });
});

describe("rappel de la double authentification", () => {
  it("sans compte connecté (aucune session à protéger), ni bandeau ni fenêtre", () => {
    show(
      <>
        <TwoFactorBanner />
        <TwoFactorPrompt />
      </>,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("à la connexion, « Activer maintenant » mène à l'activation ; « Plus tard » ferme la fenêtre mais garde le bandeau", async () => {
    const user = userEvent.setup();
    await signup();
    await quit();
    showShell();
    await user.type(await screen.findByLabelText("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Avec la double authentification, il faut aussi un code à 6 chiffres/)).toBeTruthy();
    await user.click(dialog.getByRole("button", { name: "Plus tard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("adresse").textContent).toBe("/");
    expect(screen.getByRole("alert").textContent).toContain("Ce compte administrateur protège toute l'instance");

    // Une nouvelle connexion rouvre la fenêtre : on choisit cette fois d'activer.
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await user.type(await screen.findByLabelText("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Activer maintenant" }));
    expect(await screen.findByLabelText("Votre mot de passe")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("adresse").textContent).toBe("/parametres?onglet=Application"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ouvrir l'application avec une session déjà valide n'affiche pas la fenêtre, seulement le bandeau", async () => {
    await signup();
    showShell();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("un compte ordinaire reçoit le texte du bandeau qui lui est destiné", async () => {
    await signup();
    await quit();
    await signup("ami@exemple.fr", PASSWORD, "");
    showShell();
    expect((await screen.findByRole("alert")).textContent).toContain("Votre compte contient des données financières et n'est protégé que par un mot de passe.");
  });

  it("depuis une page quelconque, le bouton du bandeau ouvre directement l'activation dans Paramètres", async () => {
    const user = userEvent.setup();
    await signup();
    showShell("/journal");
    await user.click(await screen.findByRole("button", { name: "Activer la double authentification" }));
    expect(await screen.findByLabelText("Votre mot de passe")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("adresse").textContent).toBe("/parametres?onglet=Application"));

    // Cliquer de nouveau sur le bandeau ne fait pas perdre la saisie en cours.
    await user.type(screen.getByLabelText("Votre mot de passe"), "debut");
    await user.click(screen.getByRole("button", { name: "Activer la double authentification" }));
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText("Votre mot de passe") as HTMLInputElement).value).toBe("debut");
  });

  it("sans compte connu (hors AuthGate), le menu s'affiche sans adresse et la carte de double authentification reste vide", async () => {
    await signup();
    show(
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<TwoFactorCard />} />
        </Route>
      </Routes>,
    );
    expect(await screen.findByRole("navigation")).toBeTruthy();
    expect(screen.queryByText(EMAIL)).toBeNull();
    // Sans compte connu, rien à configurer.
    expect(screen.queryByRole("heading", { name: "Double authentification" })).toBeNull();
  });

  it("sans clé de sécurité sur le serveur, aucun rappel : l'activation échouerait", async () => {
    await startServer({ twoFactorKey: undefined });
    await signup();
    showShell("/parametres?onglet=Application");
    expect(await screen.findByText(/Indisponible pour l'instant/)).toBeTruthy();
    expect(screen.getByText("Non activée")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Activer" })).toBeNull();
  });
});

describe("Paramètres : double authentification", () => {
  /** La carte « Double authentification » : la page a d'autres boutons « Annuler » (barre d'enregistrement). */
  const card = () => within(screen.getByRole("heading", { name: "Double authentification" }).closest("div.rounded-2xl") as HTMLElement);
  const codesOf = () => within(screen.getByRole("list", { name: "Codes de secours" })).getAllByRole("listitem").map((li) => li.textContent!);
  const secretOf = () => fromBase32(screen.getByTestId("cle-manuelle").textContent!.replace(/\s/g, ""));

  it("activation de bout en bout : mot de passe, QR code, code de l'application, codes de secours", async () => {
    const user = userEvent.setup();
    await signup();
    showShell("/parametres?onglet=Application");
    expect(await screen.findByText("Non activée")).toBeTruthy();
    expect(screen.getByText(/Un mot de passe seul ne suffit pas à protéger des données financières/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Activer" }));

    // Étape 1 : le mot de passe, vérifié par le serveur.
    expect((screen.getByRole("button", { name: "Continuer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Votre mot de passe"), "pas-le-bon-mot-de-passe");
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    expect(await screen.findByText("Mot de passe incorrect.")).toBeTruthy();
    expect((screen.getByLabelText("Votre mot de passe") as HTMLInputElement).value).toBe("");
    await user.type(screen.getByLabelText("Votre mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Continuer" }));

    // Étape 2 : le QR code et la clé à saisir à la main, rien n'est activé encore.
    expect(await screen.findByRole("img", { name: "QR code à scanner avec votre application" })).toBeTruthy();
    // Sur un téléphone, le QR code doit être à l'écran sans avoir à chercher.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(screen.getByTestId("cle-manuelle").textContent).toMatch(/^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
    expect((screen.getByRole("button", { name: "Confirmer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(card().getByRole("button", { name: "Annuler" }));
    expect(screen.getByText("Non activée")).toBeTruthy();
    // On peut aussi renoncer dès la première étape.
    await user.click(screen.getByRole("button", { name: "Activer" }));
    await user.click(card().getByRole("button", { name: "Annuler" }));
    expect(screen.queryByLabelText("Votre mot de passe")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Activer" }));
    await user.type(screen.getByLabelText("Votre mot de passe"), PASSWORD);
    await user.click(screen.getByRole("button", { name: "Continuer" }));
    await screen.findByTestId("cle-manuelle");
    const secret = secretOf();

    await user.type(screen.getByLabelText("Code affiché par l'application"), "12345");
    expect((screen.getByRole("button", { name: "Confirmer" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText("Code affiché par l'application"), "6");
    await user.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(await screen.findByText(/Code incorrect\. Vérifiez qu'il s'agit bien du code affiché pour Hamac/)).toBeTruthy();
    expect((screen.getByLabelText("Code affiché par l'application") as HTMLInputElement).value).toBe("");

    await user.type(screen.getByLabelText("Code affiché par l'application"), totp(secret, h.clock));
    await user.click(screen.getByRole("button", { name: "Confirmer" }));

    // Étape 3 : les codes de secours, montrés une seule fois.
    expect(await screen.findByText(/Double authentification activée\. Vos autres appareils ont été déconnectés/)).toBeTruthy();
    const codes = codesOf();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    await user.click(screen.getByRole("button", { name: "Copier" }));
    expect(await screen.findByText("Codes copiés.")).toBeTruthy();
    expect(await navigator.clipboard.readText()).toBe(codes.join("\n"));
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("refusé"));
    await user.click(screen.getByRole("button", { name: "Copier" }));
    expect(await screen.findByText("Copie impossible : téléchargez-les ou notez-les.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Télécharger" }));
    expect(h.downloads).toHaveLength(1);
    expect(h.downloads[0]!.name).toBe("hamac-codes-de-secours.txt");
    expect(h.downloads[0]!.content).toContain(`Compte : ${EMAIL}`);
    for (const code of codes) expect(h.downloads[0]!.content).toContain(code);

    await user.click(screen.getByRole("button", { name: "J'ai mis ces codes à l'abri" }));
    expect(screen.getByText("Activée")).toBeTruthy();
    expect(screen.getByText(/Il vous reste 10 codes de secours\./)).toBeTruthy();
    // Le bandeau disparaît : le compte est protégé.
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect((await (await serve("/api/auth/me")).json()).twoFactor).toEqual({ enabled: true, available: true, recoveryCodesLeft: 10 });
  });

  it("renouveler les codes de secours demande le mot de passe et un code, et remplace les anciens", async () => {
    const user = userEvent.setup();
    await signup();
    const { secret, recoveryCodes } = await activateTwoFactor();
    showShell("/parametres?onglet=Application");
    await user.click(await screen.findByRole("button", { name: "Nouveaux codes de secours" }));
    expect(screen.getByText("Vos anciens codes de secours cesseront de fonctionner.")).toBeTruthy();
    const create = () => screen.getByRole("button", { name: "Créer de nouveaux codes" }) as HTMLButtonElement;
    expect(create().disabled).toBe(true);
    await user.type(screen.getByLabelText("Votre mot de passe"), PASSWORD);
    expect(create().disabled).toBe(true);
    await user.type(screen.getByLabelText("Code de l'application ou code de secours"), "000000");
    await user.click(create());
    expect(await screen.findByText("Mot de passe ou code incorrect.")).toBeTruthy();
    // Le code est vidé, le mot de passe reste.
    expect((screen.getByLabelText("Code de l'application ou code de secours") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Votre mot de passe") as HTMLInputElement).value).toBe(PASSWORD);

    await user.click(card().getByRole("button", { name: "Annuler" }));
    expect(screen.getByText("Activée")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Nouveaux codes de secours" }));
    await user.type(screen.getByLabelText("Votre mot de passe"), PASSWORD);
    await user.type(screen.getByLabelText("Code de l'application ou code de secours"), freshCode(secret));
    await user.click(create());

    // Pas de phrase sur les autres appareils : ce n'est pas une première activation.
    await screen.findByRole("list", { name: "Codes de secours" });
    expect(screen.queryByText(/Vos autres appareils ont été déconnectés/)).toBeNull();
    const codes = codesOf();
    expect(codes).toHaveLength(10);
    expect(codes.filter((c) => recoveryCodes.includes(c))).toEqual([]);
    await user.click(screen.getByRole("button", { name: "J'ai mis ces codes à l'abri" }));
    expect(screen.getByText(/Il vous reste 10 codes de secours\./)).toBeTruthy();
  });

  it("désactiver la double authentification avec un code de secours, et le bandeau revient", async () => {
    const user = userEvent.setup();
    await signup();
    const { recoveryCodes } = await activateTwoFactor();
    showShell("/parametres?onglet=Application");
    expect(await screen.findByText("Activée")).toBeTruthy();
    expect(screen.getByText(/À chaque connexion, votre mot de passe et un code de votre application sont demandés/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    expect(screen.getByText("Votre compte ne sera plus protégé que par son mot de passe.")).toBeTruthy();
    // Renoncer ne change rien : le compte reste protégé.
    await user.click(card().getByRole("button", { name: "Annuler" }));
    expect(screen.getByText("Activée")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    await user.type(screen.getByLabelText("Votre mot de passe"), "pas-le-bon-mot-de-passe");
    await user.type(screen.getByLabelText("Code de l'application ou code de secours"), recoveryCodes[0]!);
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    expect(await screen.findByText("Mot de passe ou code incorrect.")).toBeTruthy();

    await user.clear(screen.getByLabelText("Votre mot de passe"));
    await user.type(screen.getByLabelText("Votre mot de passe"), PASSWORD);
    await user.type(screen.getByLabelText("Code de l'application ou code de secours"), recoveryCodes[0]!);
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    expect(await screen.findByText("Double authentification désactivée.")).toBeTruthy();
    expect(screen.getByText("Non activée")).toBeTruthy();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((await (await serve("/api/auth/me")).json()).twoFactor.enabled).toBe(false);
  });

  it("un lien d'activation ouvre le mot de passe tout de suite, puis disparaît de l'adresse", async () => {
    await signup();
    showShell("/parametres?onglet=Application&activer2fa=1");
    expect(await screen.findByLabelText("Votre mot de passe")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("adresse").textContent).toBe("/parametres?onglet=Application"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("le même lien sur un compte déjà protégé n'ouvre rien", async () => {
    await signup();
    await activateTwoFactor();
    showShell("/parametres?onglet=Application&activer2fa=1");
    expect(await screen.findByText("Activée")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("adresse").textContent).toBe("/parametres?onglet=Application"));
    expect(screen.queryByLabelText("Votre mot de passe")).toBeNull();
  });

  it("clé de sécurité perdue sur un compte protégé : l'état reste lisible, sans action possible", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await signup();
    await activateTwoFactor();
    await startServer({ twoFactorKey: undefined });
    showShell("/parametres?onglet=Application");
    expect(await screen.findByText("Activée")).toBeTruthy();
    expect(screen.getByText(/Indisponible pour l'instant/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nouveaux codes de secours" })).toBeNull();
    expect(screen.queryByText(/codes de secours\./)).toBeNull();
  });
});

describe("Paramètres : mot de passe", () => {
  it("le bouton attend un mot de passe assez long et bien confirmé ; une erreur du serveur s'affiche, un succès vide les champs", async () => {
    const user = userEvent.setup();
    await signup();
    showShell("/parametres?onglet=Application");
    await screen.findByText("Mot de passe actuel");
    const change = () => screen.getByRole("button", { name: "Changer le mot de passe" }) as HTMLButtonElement;
    const NEW_PASSWORD = "nouveau-mot-de-passe";
    expect(change().disabled).toBe(true);

    await user.type(screen.getByLabelText("Mot de passe actuel"), "pas-le-bon-mot-de-passe");
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "court");
    await user.type(screen.getByLabelText("Confirmation"), "court");
    expect(change().disabled).toBe(true);

    await user.clear(screen.getByLabelText("Nouveau mot de passe"));
    await user.type(screen.getByLabelText("Nouveau mot de passe"), NEW_PASSWORD);
    expect(screen.getByText("Les deux mots de passe diffèrent.")).toBeTruthy();
    expect(change().disabled).toBe(true);
    await user.clear(screen.getByLabelText("Confirmation"));
    await user.type(screen.getByLabelText("Confirmation"), NEW_PASSWORD);
    expect(screen.queryByText("Les deux mots de passe diffèrent.")).toBeNull();
    expect(change().disabled).toBe(false);

    await user.click(change());
    expect(await screen.findByText("Mot de passe actuel incorrect.")).toBeTruthy();
    expect((screen.getByLabelText("Nouveau mot de passe") as HTMLInputElement).value).toBe(NEW_PASSWORD);

    await user.clear(screen.getByLabelText("Mot de passe actuel"));
    await user.type(screen.getByLabelText("Mot de passe actuel"), PASSWORD);
    await user.click(change());
    expect(await screen.findByText("Mot de passe changé. Les autres appareils sont déconnectés.")).toBeTruthy();
    for (const label of ["Mot de passe actuel", "Nouveau mot de passe", "Confirmation"]) expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");

    // Côté serveur, seul le nouveau mot de passe ouvre une session.
    await quit();
    expect((await post("/api/auth/login", { email: EMAIL, password: PASSWORD })).status).toBe(401);
    expect((await post("/api/auth/login", { email: EMAIL, password: NEW_PASSWORD })).status).toBe(200);
  });
});

describe("apparence", () => {
  const radio = (name: string) => screen.getByRole("radio", { name: new RegExp(name) });
  const dark = () => document.documentElement.classList.contains("dark");

  it("le thème choisi est appliqué à la page, copié dans le navigateur et gardé dans le compte", async () => {
    const user = userEvent.setup();
    await signup();
    const ecran = stubScreen({ wide: true, dark: false });
    show(<AppearanceCard />);
    expect(screen.getByRole("radiogroup", { name: "Thème" })).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Comme le système", "Clair", "Sombre"]);
    expect(radio("Comme le système").getAttribute("aria-checked")).toBe("true");

    await user.click(radio("Sombre"));
    expect(radio("Sombre").getAttribute("aria-checked")).toBe("true");
    expect(radio("Comme le système").getAttribute("aria-checked")).toBe("false");
    expect(dark()).toBe(true);
    expect(localStorage.getItem("hamac.theme")).toBe("sombre");
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("sombre"));

    await user.click(radio("Clair"));
    expect(dark()).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("clair"));

    // « Comme le système » suit l'appareil : ici, la nuit est tombée.
    ecran.dark = true;
    await user.click(radio("Comme le système"));
    expect(dark()).toBe(true);
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("systeme"));
  });

  it("le thème choisi sur un autre appareil s'applique dès l'ouverture", async () => {
    await signup();
    await rpc("settings.set", { key: "ui.theme", value: "sombre" });
    show(<AppearanceCard />);
    await waitFor(() => expect(radio("Sombre").getAttribute("aria-checked")).toBe("true"));
    expect(dark()).toBe(true);
    expect(localStorage.getItem("hamac.theme")).toBe("sombre");
  });

  it("une valeur inconnue dans le compte est ignorée : la copie du navigateur sert de repli", async () => {
    await signup();
    await rpc("settings.set", { key: "ui.theme", value: "bleu" });
    localStorage.setItem("hamac.theme", "clair");
    show(<AppearanceCard />);
    expect(radio("Clair").getAttribute("aria-checked")).toBe("true");
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("bleu"));
    expect(dark()).toBe(false);
    // Une copie illisible vaut « Comme le système ».
    cleanup();
    localStorage.setItem("hamac.theme", "violet");
    show(<AppearanceCard />);
    expect(radio("Comme le système").getAttribute("aria-checked")).toBe("true");
  });

  it("navigation privée : le stockage du navigateur refuse tout, le thème s'applique quand même", async () => {
    const user = userEvent.setup();
    await signup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("stockage bloqué", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("stockage bloqué", "SecurityError");
    });
    show(<AppearanceCard />);
    expect(radio("Comme le système").getAttribute("aria-checked")).toBe("true");
    await user.click(radio("Sombre"));
    expect(dark()).toBe(true);
    expect(radio("Sombre").getAttribute("aria-checked")).toBe("true");
  });

  /** Affiche le thème que renvoie useTheme, comme le font les graphiques. */
  function ThemeProbe() {
    return <p data-testid="theme">{useTheme()}</p>;
  }

  it("useTheme suit la classe de la page, et le système quand la page n'en a pas", async () => {
    const ecran = stubScreen({ wide: true, dark: true });
    show(<ThemeProbe />);
    expect(screen.getByTestId("theme").textContent).toBe("sombre");
    act(() => document.documentElement.classList.add("light"));
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("clair"));
    act(() => document.documentElement.classList.replace("light", "dark"));
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("sombre"));
    act(() => document.documentElement.classList.remove("dark"));
    ecran.dark = false;
    act(() => document.documentElement.classList.add("light"));
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("clair"));
  });

  it("useTheme sans matchMedia : thème clair, et il suit quand même la classe de la page", async () => {
    vi.stubGlobal("matchMedia", undefined);
    show(<ThemeProbe />);
    expect(screen.getByTestId("theme").textContent).toBe("clair");
    act(() => document.documentElement.classList.add("dark"));
    await waitFor(() => expect(screen.getByTestId("theme").textContent).toBe("sombre"));
  });

  it("sans matchMedia (navigateur très ancien), « Comme le système » donne le thème clair", async () => {
    const user = userEvent.setup();
    await signup();
    vi.stubGlobal("matchMedia", undefined);
    show(<AppearanceCard />);
    await user.click(radio("Sombre"));
    expect(dark()).toBe(true);
    await user.click(radio("Comme le système"));
    expect(dark()).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});

describe("barre latérale et barre du haut", () => {
  const nav = () => within(screen.getByRole("navigation"));
  /** Le menu n'existe qu'une fois le compte chargé. */
  const ready = () => screen.findByRole("navigation");
  const root = (container: HTMLElement) => container.querySelector("div.print-flow.h-full")!;
  const toggle = () => screen.getByRole("button", { name: /(Agrandir|Réduire) le menu/ });
  const dark = () => document.documentElement.classList.contains("dark");

  it("le menu regroupe les pages, marque la page ouverte et mène aux autres", async () => {
    const user = userEvent.setup();
    await signup();
    showShell();
    await ready();
    expect(await nav().findByText("Vue d'ensemble")).toBeTruthy();
    for (const group of ["Saisie", "Placements", "Emprunts", "Fiscalité", "Aide"]) expect(nav().getByText(group)).toBeTruthy();
    for (const page of ["Tableau de bord", "Projection", "Journal", "Actions & ETF", "Crédits", "Notice"]) expect(nav().getByRole("link", { name: page })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Paramètres" })).toBeTruthy();
    expect(screen.getByText(EMAIL)).toBeTruthy();
    // Le tableau de bord est la page ouverte : lui seul est marqué, pas « / » pour toutes les pages.
    expect(nav().getByRole("link", { name: "Tableau de bord" }).getAttribute("aria-current")).toBe("page");
    expect(nav().getByRole("link", { name: "Journal" }).getAttribute("aria-current")).toBeNull();

    await user.click(nav().getByRole("link", { name: "Journal" }));
    expect(screen.getByTestId("adresse").textContent).toBe("/journal");
    expect(nav().getByRole("link", { name: "Journal" }).getAttribute("aria-current")).toBe("page");
    expect(nav().getByRole("link", { name: "Tableau de bord" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Page sans contenu pour ce test")).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Paramètres" }));
    expect(await screen.findByRole("heading", { name: "Paramètres" })).toBeTruthy();
  });

  it("gestion de patrimoine et modules désactivés : le menu ne propose que les pages utiles", async () => {
    await signup();
    const first = showShell();
    await ready();
    expect(await nav().findByRole("link", { name: "Projection" })).toBeTruthy();
    expect(nav().getByRole("link", { name: "Crypto" })).toBeTruthy();
    first.unmount();

    const { params } = await rpc<{ params: { profile: Record<string, unknown>; modules: Record<string, boolean> } }>("workspace.load");
    await rpc("params.update", { ...params, profile: { ...params.profile, goal: "patrimoine" }, modules: { ...params.modules, crypto: false, impots: false } });
    showShell();
    await ready();
    await waitFor(() => expect(nav().queryByRole("link", { name: "Projection" })).toBeNull());
    // Un module désactivé retire toutes ses pages.
    expect(nav().queryByRole("link", { name: "Crypto" })).toBeNull();
    for (const page of ["Impôts", "Compteurs et plafonds", "Aide à la déclaration"]) expect(nav().queryByRole("link", { name: page })).toBeNull();
    expect(nav().queryByText("Fiscalité")).toBeNull();
    expect(nav().getByRole("link", { name: "Actions & ETF" })).toBeTruthy();
    expect(nav().getByRole("link", { name: "Journal" })).toBeTruthy();
  });

  it("sur grand écran, la barre se réduit à ses icônes, et ce choix est retenu pour la prochaine visite", async () => {
    const user = userEvent.setup();
    await signup();
    const first = showShell();
    await ready();
    expect(await nav().findByText("Vue d'ensemble")).toBeTruthy();
    expect(toggle().getAttribute("aria-label")).toBe("Réduire le menu");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle());
    expect(toggle().getAttribute("aria-label")).toBe("Agrandir le menu");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    // Réduite : plus de titres ni d'adresse, mais chaque page reste atteignable par son nom.
    expect(nav().queryByText("Vue d'ensemble")).toBeNull();
    expect(screen.queryByText(EMAIL)).toBeNull();
    expect(nav().getByRole("link", { name: "Journal" }).getAttribute("title")).toBe("Journal");
    // L'adresse du compte reste lisible en survolant le bouton de déconnexion.
    expect(screen.getByRole("button", { name: "Se déconnecter" }).parentElement!.getAttribute("title")).toBe(EMAIL);
    expect(localStorage.getItem("hamac.sidebar.collapsed")).toBe("1");
    first.unmount();

    // Réouverture : la barre reste réduite.
    showShell();
    expect(await screen.findByRole("button", { name: "Agrandir le menu" })).toBeTruthy();
    await user.click(toggle());
    await ready();
    expect(await nav().findByText("Vue d'ensemble")).toBeTruthy();
    expect(localStorage.getItem("hamac.sidebar.collapsed")).toBe("0");
  });

  it("sur petit écran, la barre est réduite, s'ouvre par-dessus le contenu et se referme d'un clic ailleurs ou sur une page", async () => {
    const user = userEvent.setup();
    await signup();
    const ecran = stubScreen({ wide: false, dark: false });
    const { container } = showShell();
    expect(await screen.findByRole("button", { name: "Agrandir le menu" })).toBeTruthy();
    await ready();
    const backdrop = () => container.querySelector("div.fixed.inset-0");
    expect(backdrop()).toBeNull();

    await user.click(toggle());
    expect(await nav().findByText("Vue d'ensemble")).toBeTruthy();
    expect(backdrop()).toBeTruthy();
    // Un clic sur le fond referme la barre.
    await user.click(backdrop()!);
    expect(backdrop()).toBeNull();
    expect(nav().queryByText("Vue d'ensemble")).toBeNull();

    // Choisir une page la referme aussi.
    await user.click(toggle());
    await user.click(await nav().findByRole("link", { name: "Journal" }));
    expect(screen.getByTestId("adresse").textContent).toBe("/journal");
    expect(backdrop()).toBeNull();
    expect(nav().queryByText("Vue d'ensemble")).toBeNull();
    // Le bouton refermait la barre ouverte : on le vérifie aussi.
    await user.click(toggle());
    expect(backdrop()).toBeTruthy();
    await user.click(toggle());
    expect(backdrop()).toBeNull();

    // La fenêtre s'agrandit : la barre suit la préférence (ouverte).
    ecran.change({ wide: true });
    expect(await nav().findByText("Vue d'ensemble")).toBeTruthy();
    expect(toggle().getAttribute("aria-label")).toBe("Réduire le menu");
  });

  it("mode discret : les montants se masquent, et le réglage est gardé dans le compte", async () => {
    const user = userEvent.setup();
    await signup();
    const { container } = showShell();
    await user.click(await screen.findByRole("button", { name: "Mode discret" }));
    expect(await screen.findByRole("button", { name: "Montants masqués" })).toBeTruthy();
    expect(root(container).classList.contains("privacy")).toBe(true);
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.privacyMode" })).toBe(true));
    await user.click(screen.getByRole("button", { name: "Montants masqués" }));
    expect(await screen.findByRole("button", { name: "Mode discret" })).toBeTruthy();
    expect(root(container).classList.contains("privacy")).toBe(false);
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.privacyMode" })).toBe(false));
  });

  it("le mode discret déjà réglé sur un autre appareil est appliqué à l'ouverture", async () => {
    await signup();
    await rpc("settings.set", { key: "ui.privacyMode", value: true });
    const { container } = showShell();
    expect(await screen.findByRole("button", { name: "Montants masqués" })).toBeTruthy();
    expect(root(container).classList.contains("privacy")).toBe(true);
  });

  it("le bouton du thème bascule entre clair et sombre, et le choix suit le compte", async () => {
    const user = userEvent.setup();
    await signup();
    showShell();
    await user.click(await screen.findByRole("button", { name: "Passer au thème sombre" }));
    expect(dark()).toBe(true);
    expect(await screen.findByRole("button", { name: "Passer au thème clair" })).toBeTruthy();
    expect(localStorage.getItem("hamac.theme")).toBe("sombre");
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("sombre"));
    await user.click(screen.getByRole("button", { name: "Passer au thème clair" }));
    expect(dark()).toBe(false);
    expect(await screen.findByRole("button", { name: "Passer au thème sombre" })).toBeTruthy();
    await waitFor(async () => expect(await rpc("settings.get", { key: "ui.theme" })).toBe("clair"));
  });

  it("« Comme le système » : la tombée de la nuit change le thème, un thème choisi à la main ne bouge pas", async () => {
    await signup();
    const ecran = stubScreen({ wide: true, dark: false });
    const first = showShell();
    expect(await screen.findByRole("button", { name: "Passer au thème sombre" })).toBeTruthy();
    ecran.change({ dark: true });
    await waitFor(() => expect(dark()).toBe(true));
    expect(await screen.findByRole("button", { name: "Passer au thème clair" })).toBeTruthy();
    ecran.change({ dark: false });
    await waitFor(() => expect(dark()).toBe(false));
    first.unmount();

    // Thème « Clair » choisi : la nuit ne le change pas.
    localStorage.setItem("hamac.theme", "clair");
    document.documentElement.classList.add("light");
    showShell();
    expect(await screen.findByRole("button", { name: "Passer au thème sombre" })).toBeTruthy();
    ecran.change({ dark: true });
    expect(dark()).toBe(false);
    expect(screen.getByRole("button", { name: "Passer au thème sombre" })).toBeTruthy();
  });
});

describe("application complète", () => {
  /** Comme main.tsx : l'application a son propre routeur par hash. */
  function showApp() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryClientProvider>,
    );
  }

  it("ouverture sans session : connexion, puis les pages s'ouvrent depuis le menu, avec la page d'accueil du premier lancement", async () => {
    const user = userEvent.setup();
    showApp();
    expect(await screen.findByRole("heading", { name: "Première connexion" })).toBeTruthy();
    await user.type(fieldOf("E-mail"), EMAIL);
    await user.type(fieldOf("Mot de passe"), PASSWORD);
    await user.type(fieldOf("Code d'installation"), SETUP);
    await user.click(screen.getByRole("button", { name: "Créer le compte" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Plus tard" }));

    // Aucun compte saisi : le tableau de bord propose les trois étapes de démarrage.
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
    await user.click(within(screen.getByRole("navigation")).getByRole("link", { name: "Notice" }));
    expect(await screen.findByRole("heading", { name: "Notice" })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Paramètres" }));
    expect(await screen.findByRole("heading", { name: "Paramètres" })).toBeTruthy();
    await user.click(within(screen.getByRole("navigation")).getByRole("link", { name: "Tableau de bord" }));
    expect(await screen.findByText("Bienvenue dans Hamac")).toBeTruthy();
  });

  it("une page qui plante affiche une erreur claire sans emporter le menu", async () => {
    // React journalise l'erreur attrapée par le routeur : bruit inutile ici.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error("Panne de démonstration");
    };
    const router = createMemoryRouter([{ element: <Shell />, errorElement: <RouteError />, children: [{ path: "/", element: <p>Accueil</p> }, { path: "/casse", element: <Broken />, errorElement: <RouteError /> }] }], { initialEntries: ["/casse"] });
    await signup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <AuthGate>{() => <RouterProvider router={router} />}</AuthGate>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Cette page a rencontré une erreur" })).toBeTruthy();
    expect(screen.getByText("Panne de démonstration")).toBeTruthy();
    expect(screen.getByText(/Vos données ne sont pas touchées/)).toBeTruthy();
    expect(screen.getByText(/relancez `pnpm dev`/)).toBeTruthy();
    // Le menu reste utilisable.
    const user = userEvent.setup();
    await user.click(within(screen.getByRole("navigation")).getByRole("link", { name: "Tableau de bord" }));
    expect(await screen.findByText("Accueil")).toBeTruthy();
  });

  it("en production, l'erreur n'affiche pas l'aide de développement ; sans message, pas de cadre vide ; « Recharger » recharge la page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("DEV", false);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const Broken = () => {
      throw new Error("");
    };
    const router = createMemoryRouter([{ path: "/", element: <Broken />, errorElement: <RouteError /> }]);
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { name: "Cette page a rencontré une erreur" })).toBeTruthy();
    expect(screen.queryByText(/relancez `pnpm dev`/)).toBeNull();
    expect(document.querySelector("pre")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Recharger" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe("premier lancement", () => {
  it("trois étapes : profil, établissements (le lien change une fois un établissement créé) et comptes à ajouter", async () => {
    const user = userEvent.setup();
    await signup();
    show(<Onboarding />);
    expect(screen.getByRole("heading", { name: "Bienvenue dans Hamac" })).toBeTruthy();
    for (const title of ["Votre profil", "Vos établissements", "Vos comptes"]) expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ouvrir Paramètres › Plan" }).getAttribute("href")).toBe("/parametres");
    expect(await screen.findByRole("link", { name: "Ajouter un établissement" })).toBeTruthy();

    await rpc("institutions.upsert", { name: "Banque Fictive", kind: "banque" });
    cleanup();
    show(<Onboarding />);
    const link = await screen.findByRole("link", { name: "Ajouter un autre établissement" });
    expect(decodeURIComponent(link.getAttribute("href")!)).toBe("/parametres?onglet=Établissements&nouveau=1");

    // Chaque type de compte ouvre sa fiche, déjà réglée sur ce type.
    for (const label of ["Livret", "Assurance-vie", "PEA", "Compte-titres", "Plateforme crypto"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Livret" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
