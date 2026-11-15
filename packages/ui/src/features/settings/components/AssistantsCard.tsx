import { Bot, Copy } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Field, Select, TextInput } from "@/shared/components/form";
import { Badge, Button, Card, CardTitle } from "@/shared/components/ui";
import { auth } from "@/features/settings/lib/auth";
import { claudeCodeCommand, DAYS_LABELS, jsonConfig, lastUsedText, SCOPE_HELP, SCOPE_LABELS, TOKEN_DAYS, type ApiToken, type TokenScope } from "@/features/settings/lib/assistants";
import { formatDate } from "@/shared/lib/numbers";
import { useToast } from "@/shared/lib/toast";

/** Paramètres › Application : jetons d'accès des assistants branchés en MCP (docs/assistants-mcp/guide.md). */
export function AssistantsCard() {
  const toast = useToast();
  const [state, setState] = useState<{ enabled: boolean; tokens: ApiToken[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const refresh = useCallback(() => auth.tokens.list().then(setState, () => setState(null)), []);
  useEffect(() => void refresh(), [refresh]);

  if (!state) return null;

  const revoke = async (id: string) => {
    try {
      await auth.tokens.revoke(id);
      setConfirming(null);
      toast("success", "Jeton révoqué : l'assistant n'a plus accès.");
      await refresh();
    } catch (err) {
      toast("error", (err as Error).message);
    }
  };

  return (
    <Card>
      <CardTitle hint={state.tokens.length ? <Badge tone="accent">{state.tokens.length} jeton{state.tokens.length > 1 ? "s" : ""}</Badge> : undefined}>Assistants (MCP)</CardTitle>
      {!state.enabled ? (
        <p className="text-sm text-fg-muted">Les assistants sont désactivés sur cette instance par la personne qui l'administre.</p>
      ) : (
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Bot size={17} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Branchez un assistant compatible MCP (Claude Code, Claude Desktop…) pour interroger votre patrimoine ou lui confier vos relevés à importer. Ce que l'assistant lit part chez le fournisseur du modèle : ne créez un jeton que si vous l'acceptez.
            </span>
          </p>
          {created && <NewToken token={created} onDone={() => setCreated(null)} />}
          {creating ? (
            <TokenForm
              onCancel={() => setCreating(false)}
              onCreated={async (token) => {
                setCreating(false);
                setCreated(token);
                await refresh();
              }}
            />
          ) : (
            !created && <Button onClick={() => setCreating(true)}>Créer un jeton</Button>
          )}
          {state.tokens.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {state.tokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{t.name}</span> <Badge tone={t.scope === "write" ? "accent" : "neutral"}>{SCOPE_LABELS[t.scope]}</Badge>
                    <span className="block text-xs text-fg-muted">
                      Expire le {formatDate(t.expiresAt.slice(0, 10))} · {lastUsedText(t.lastUsedAt)}
                    </span>
                  </span>
                  {confirming === t.id ? (
                    <span className="flex gap-2">
                      <Button variant="ghost" onClick={() => setConfirming(null)}>Garder</Button>
                      <Button onClick={() => void revoke(t.id)}>Confirmer la révocation</Button>
                    </span>
                  ) : (
                    <Button variant="ghost" onClick={() => setConfirming(t.id)}>Révoquer</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function TokenForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (token: string) => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<TokenScope>("read");
  const [days, setDays] = useState<(typeof TOKEN_DAYS)[number]>(90);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { token } = await auth.tokens.create(name, scope, days, password);
      await onCreated(token);
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
      <Field label="Nom" help="Pour le reconnaître : l'assistant ou l'appareil.">{(id) => <TextInput id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Claude, ordinateur portable" required />}</Field>
      <Field label="Accès" help={SCOPE_HELP[scope]}>
        {(id) => (
          <Select id={id} value={scope} onChange={(e) => setScope(e.target.value as TokenScope)}>
            <option value="read">{SCOPE_LABELS.read}</option>
            <option value="write">{SCOPE_LABELS.write}</option>
          </Select>
        )}
      </Field>
      <Field label="Durée">
        {(id) => (
          <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof TOKEN_DAYS)[number])}>
            {TOKEN_DAYS.map((d) => (
              <option key={d} value={d}>{DAYS_LABELS[d]}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Mot de passe" help="Votre mot de passe Hamac, pour confirmer.">{(id) => <TextInput id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" disabled={busy || !name.trim() || !password}>Créer le jeton</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </form>
  );
}

/** Le jeton n'est affiché qu'ici, une seule fois : le serveur n'en garde que l'empreinte. */
function NewToken({ token, onDone }: { token: string; onDone: () => void }) {
  const toast = useToast();
  const origin = window.location.origin;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("success", "Copié.");
    } catch {
      toast("error", "Copie impossible : sélectionnez le texte à la main.");
    }
  };
  const block = (label: string, text: string) => (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-fg-muted">
        {label}
        <Button variant="ghost" className="h-7 px-2" onClick={() => void copy(text)}>
          <Copy size={14} /> Copier
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">{text}</pre>
    </div>
  );
  return (
    <div className="space-y-3 rounded-lg border border-accent/40 p-3">
      <p className="text-sm">Copiez ce jeton maintenant : il ne sera plus jamais affiché. Gardez-le comme un mot de passe.</p>
      {block("Jeton", token)}
      {block("Claude Code (terminal)", claudeCodeCommand(origin, token))}
      {block("Autres clients (fichier de configuration)", jsonConfig(origin, token))}
      <Button variant="primary" onClick={onDone}>J'ai copié le jeton</Button>
    </div>
  );
}
