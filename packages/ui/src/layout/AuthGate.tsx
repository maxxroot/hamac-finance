import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Field, TextInput } from "@/components/form";
import { Button, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { isDesktop } from "@/lib/transport";

/** Mode web : affiche la connexion tant qu'aucune session n'est ouverte. Mode bureau : transparent. */
export function AuthGate({ children }: { children: (email: string | null) => ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; email: string | null }>({ loading: !isDesktop, email: null });
  const qc = useQueryClient();

  useEffect(() => {
    if (isDesktop) return;
    void auth.me().then((email) => setState({ loading: false, email }));
    const onUnauthorized = () => setState({ loading: false, email: null });
    window.addEventListener("hamac:unauthorized", onUnauthorized);
    return () => window.removeEventListener("hamac:unauthorized", onUnauthorized);
  }, []);

  if (isDesktop) return <>{children(null)}</>;
  if (state.loading) return null;
  if (!state.email)
    return (
      <Login
        onDone={(email) => {
          qc.clear();
          setState({ loading: false, email });
        }}
      />
    );
  return <>{children(state.email)}</>;
}

function Login({ onDone }: { onDone: (email: string) => void }) {
  const [cfg, setCfg] = useState<{ signup: "invite" | "open" | "closed"; firstUser: boolean } | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("invitation") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void auth.config().then((c) => {
      setCfg(c);
      if (c.firstUser || new URLSearchParams(window.location.search).has("invitation")) setMode("signup");
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = mode === "login" ? await auth.login(email, password) : await auth.signup(email, password, invite || undefined);
      onDone(r.email!);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSignup = cfg && (cfg.firstUser || cfg.signup !== "closed");
  const needInvite = cfg && !cfg.firstUser && cfg.signup === "invite";

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
            <Field label="Code d'invitation" help="Fourni par la personne qui gère cette instance.">
              {(id) => <TextInput id={id} value={invite} onChange={(e) => setInvite(e.target.value)} required className="font-mono" />}
            </Field>
          )}
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button variant="primary" type="submit" className="w-full" disabled={busy}>
            {mode === "login" ? "Se connecter" : "Créer le compte"}
          </Button>
        </form>
        <p className="mt-5 text-xs text-fg-faint">Vos données sont stockées dans une base personnelle sur ce serveur, séparée de celle des autres utilisateurs.</p>
      </Card>
    </div>
  );
}
