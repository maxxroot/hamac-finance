import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Field, TextInput } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { AccountContext, type Account } from "@/lib/account";
import { auth, AuthError, type Me } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { cleanAppCode, cleanRecoveryCode, loginCodeReady } from "@/lib/twoFactor";

/** Affiche la connexion tant qu'aucune session n'est ouverte. */
export function AuthGate({ children }: { children: (email: string | null) => ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; me: Me | null; justLoggedIn: boolean }>({ loading: true, me: null, justLoggedIn: false });
  const qc = useQueryClient();

  useEffect(() => {
    void auth.me().then((me) => setState({ loading: false, me, justLoggedIn: false }));
    const onUnauthorized = () => setState({ loading: false, me: null, justLoggedIn: false });
    window.addEventListener("hamac:unauthorized", onUnauthorized);
    return () => window.removeEventListener("hamac:unauthorized", onUnauthorized);
  }, []);

  const refresh = useCallback(async () => {
    const me = await auth.me();
    setState((s) => ({ ...s, me }));
  }, []);
  const closeLoginPrompt = useCallback(() => setState((s) => ({ ...s, justLoggedIn: false })), []);
  const account = useMemo<Account | null>(() => (state.me ? { me: state.me, refresh, justLoggedIn: state.justLoggedIn, closeLoginPrompt } : null), [state.me, state.justLoggedIn, refresh, closeLoginPrompt]);

  if (state.loading) return null;
  if (!account)
    return (
      <Login
        onDone={async () => {
          qc.clear();
          setState({ loading: false, me: await auth.me(), justLoggedIn: true });
        }}
      />
    );
  return <AccountContext.Provider value={account}>{children(account.me.email)}</AccountContext.Provider>;
}

function Login({ onDone }: { onDone: () => Promise<void> }) {
  const [cfg, setCfg] = useState<{ signup: "invite" | "open" | "closed"; firstUser: boolean } | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("invitation") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  useEffect(() => {
    void auth.config().then((c) => {
      setCfg(c);
      if (c.firstUser || new URLSearchParams(window.location.search).has("invitation")) setMode("signup");
    });
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await auth.signup(email, password, invite || undefined);
      else {
        const r = await auth.login(email, password);
        if (r.challenge) return setChallenge(r.challenge);
      }
      await onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSignup = cfg && (cfg.firstUser || cfg.signup !== "closed");
  const needInvite = cfg && (cfg.firstUser || cfg.signup === "invite");

  if (challenge)
    return (
      <LoginCard>
        <CodeStep
          challenge={challenge}
          onDone={onDone}
          onRestart={(message) => {
            setChallenge(null);
            setPassword("");
            setError(message);
          }}
        />
      </LoginCard>
    );

  return (
    <LoginCard>
        {cfg?.firstUser && <p className="mb-4 text-sm text-fg-muted">Première connexion : créez le compte administrateur de cette instance.</p>}
        {canSignup && !cfg?.firstUser && (
          <div className="mb-5 grid grid-cols-2 rounded-lg bg-surface-2 p-1 text-sm">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md py-1.5", mode === m ? "bg-surface-3 text-fg" : "text-fg-muted")}>
                {m === "login" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>
        )}
        <form className="space-y-4" onSubmit={submit}>
          <Field label="E-mail">{(id) => <TextInput id={id} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />}</Field>
          <Field label="Mot de passe" help={mode === "signup" ? "10 caractères minimum." : undefined}>
            {(id) => <TextInput id={id} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} required />}
          </Field>
          {mode === "signup" && needInvite && (
            <Field label={cfg?.firstUser ? "Code d'installation" : "Code d'invitation"} help={cfg?.firstUser ? "Affiché dans les journaux du serveur : docker compose logs hamac" : "Fourni par la personne qui gère cette instance."}>
              {(id) => <TextInput id={id} value={invite} onChange={(e) => setInvite(e.target.value)} required className="font-mono" />}
            </Field>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button variant="primary" type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Se connecter" : "Créer le compte"}
          </Button>
        </form>
    </LoginCard>
  );
}

function LoginCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
            <path d="M6 10 C 10 23, 22 23, 26 10" fill="none" stroke="var(--color-accent-fg)" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <span className="text-xl font-semibold">Hamac</span>
        </div>
        {children}
        <p className="mt-5 text-xs text-fg-faint">Vos données sont stockées dans une base personnelle sur ce serveur, séparée de celle des autres utilisateurs.</p>
      </Card>
    </div>
  );
}

/** Deuxième étape : aucune session n'est ouverte tant qu'un code n'est pas accepté. */
function CodeStep({ challenge, onDone, onRestart }: { challenge: string; onDone: () => Promise<void>; onRestart: (message: string) => void }) {
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.submitCode(challenge, code, recovery);
      await onDone();
    } catch (err) {
      if (err instanceof AuthError && err.restart) return onRestart(err.message);
      setError((err as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setRecovery(!recovery);
    setCode("");
    setError(null);
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      {recovery ? (
        <Field key="secours" label="Code de secours" help="Un des codes que vous avez mis de côté. Il ne servira qu'une fois.">
          {(id) => <TextInput id={id} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX" value={code} onChange={(e) => setCode(cleanRecoveryCode(e.target.value))} required autoFocus className="font-mono" />}
        </Field>
      ) : (
        <Field key="application" label="Code de votre application" help="Les 6 chiffres affichés pour Hamac sur votre téléphone.">
          {(id) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(cleanAppCode(e.target.value))} required autoFocus className="font-mono" />}
        </Field>
      )}
      {error && <p className="text-sm text-negative">{error}</p>}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || !loginCodeReady(code, recovery)}>
        Valider
      </Button>
      <button type="button" onClick={switchMode} className="w-full text-center text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline">
        {recovery ? "Utiliser le code de l'application" : "Utiliser un code de secours"}
      </button>
    </form>
  );
}
