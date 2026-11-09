import { ShieldCheck, ShieldAlert, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Field, TextInput } from "./form";
import { Badge, Button, Card, CardTitle } from "./ui";
import { useAccount } from "@/lib/account";
import { auth } from "@/lib/auth";
import { downloadText } from "@/lib/files";
import { qrDrawing } from "@/lib/qr";
import { useToast } from "@/lib/toast";
import { cleanAppCode, groupKey, recoveryCodesFile, recoveryCodesLeftText } from "@/lib/twoFactor";

type Stage = { name: "idle" } | { name: "password" } | { name: "scan"; secret: string; uri: string } | { name: "codes"; codes: string[]; first: boolean } | { name: "disable" } | { name: "regenerate" };

const IDLE: Stage = { name: "idle" };

/** Paramètres › Application : activer, désactiver, renouveler les codes de secours. */
export function TwoFactorCard() {
  const account = useAccount();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>(IDLE);
  const [search, setSearch] = useSearchParams();
  const card = useRef<HTMLDivElement>(null);
  const status = account?.me.twoFactor;
  const canStart = !!status && status.available && !status.enabled;
  const wanted = search.get("activer2fa") === "1";

  // Arrivée depuis le bandeau ou la fenêtre : l'activation s'ouvre directement.
  useEffect(() => {
    if (!wanted) return;
    setSearch(
      (s) => {
        s.delete("activer2fa");
        return s;
      },
      { replace: true },
    );
    if (canStart) setStage((current) => (current.name === "idle" ? { name: "password" } : current));
    card.current?.scrollIntoView({ block: "center" });
  }, [wanted, canStart, setSearch]);

  if (!account || !status) return null;

  const done = (message: string) => {
    setStage(IDLE);
    toast("success", message);
  };

  let body: ReactNode;
  switch (stage.name) {
    case "password":
      body = (
        <PasswordStep
          onCancel={() => setStage(IDLE)}
          onDone={(s) => setStage({ name: "scan", ...s })}
        />
      );
      break;
    case "scan":
      body = (
        <ScanStep
          secret={stage.secret}
          uri={stage.uri}
          onCancel={() => setStage(IDLE)}
          onDone={async (codes) => {
            setStage({ name: "codes", codes, first: true });
            await account.refresh();
          }}
        />
      );
      break;
    case "codes":
      body = <RecoveryCodes codes={stage.codes} first={stage.first} email={account.me.email} onDone={() => setStage(IDLE)} />;
      break;
    case "disable":
      body = (
        <ProofForm
          intro="Votre compte ne sera plus protégé que par son mot de passe."
          action="Désactiver"
          onCancel={() => setStage(IDLE)}
          onSubmit={async (password, code) => {
            await auth.twoFactor.disable(password, code);
            await account.refresh();
            done("Double authentification désactivée.");
          }}
        />
      );
      break;
    case "regenerate":
      body = (
        <ProofForm
          intro="Vos anciens codes de secours cesseront de fonctionner."
          action="Créer de nouveaux codes"
          onCancel={() => setStage(IDLE)}
          onSubmit={async (password, code) => {
            const { recoveryCodes } = await auth.twoFactor.regenerate(password, code);
            setStage({ name: "codes", codes: recoveryCodes, first: false });
            await account.refresh();
          }}
        />
      );
      break;
    default:
      body = status.enabled ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-positive" aria-hidden />
            <span>
              À chaque connexion, votre mot de passe et un code de votre application sont demandés.
              {status.available ? ` ${recoveryCodesLeftText(status.recoveryCodesLeft)}` : ""}
            </span>
          </p>
          {status.available ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setStage({ name: "regenerate" })}>Nouveaux codes de secours</Button>
              <Button variant="ghost" onClick={() => setStage({ name: "disable" })}>
                Désactiver
              </Button>
            </div>
          ) : (
            <Unavailable />
          )}
        </div>
      ) : status.available ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <ShieldAlert size={17} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <span>Un mot de passe seul ne suffit pas à protéger des données financières. Ajoutez un code à 6 chiffres, affiché par une application sur votre téléphone.</span>
          </p>
          <Button variant="primary" onClick={() => setStage({ name: "password" })}>
            Activer
          </Button>
        </div>
      ) : (
        <Unavailable />
      );
  }

  return (
    <div ref={card}>
      <Card>
        <CardTitle hint={status.enabled ? <Badge tone="positive">Activée</Badge> : <Badge tone="negative">Non activée</Badge>}>Double authentification</CardTitle>
        {body}
      </Card>
    </div>
  );
}

function Unavailable() {
  return <p className="text-sm text-fg-muted">Indisponible pour l'instant : la clé de sécurité de ce serveur est absente ou invalide. Prévenez la personne qui gère cette instance.</p>;
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (e: FormEvent, action: () => Promise<void>, clearOnError?: () => void) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
      clearOnError?.();
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function PasswordStep({ onCancel, onDone }: { onCancel: () => void; onDone: (s: { secret: string; uri: string }) => void }) {
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form className="space-y-3" onSubmit={(e) => run(e, async () => onDone(await auth.twoFactor.setup(password)), () => setPassword(""))}>
      <Field label="Votre mot de passe" help="Pour vérifier que c'est bien vous." error={error}>
        {(id) => <TextInput id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus className="max-w-xs" />}
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy || !password}>
          Continuer
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function ScanStep({ secret, uri, onCancel, onDone }: { secret: string; uri: string; onCancel: () => void; onDone: (codes: string[]) => Promise<void> }) {
  const [code, setCode] = useState("");
  const { busy, error, run } = useSubmit();
  const qr = useMemo(() => qrDrawing(uri), [uri]);
  return (
    <form className="space-y-4" onSubmit={(e) => run(e, async () => onDone((await auth.twoFactor.confirm(code)).recoveryCodes), () => setCode(""))}>
      <p className="text-sm text-fg-muted">Installez sur votre téléphone une application de codes, par exemple Aegis, 2FAS, Google Authenticator ou Microsoft Authenticator, puis scannez ce QR code.</p>
      <div className="flex flex-wrap items-start gap-5">
        <svg viewBox={`0 0 ${qr.size} ${qr.size}`} className="h-48 w-48 shrink-0 rounded-lg" role="img" aria-label="QR code à scanner avec votre application" shapeRendering="crispEdges">
          <rect width={qr.size} height={qr.size} fill="#fff" />
          <path d={qr.path} fill="#000" />
        </svg>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium text-fg-muted">Impossible de scanner ? Saisissez cette clé dans l'application :</p>
            <code className="mt-1 block text-sm break-all" data-testid="cle-manuelle">
              {groupKey(secret)}
            </code>
          </div>
          <Field label="Code affiché par l'application" error={error}>
            {(id) => <TextInput id={id} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(cleanAppCode(e.target.value))} required autoFocus className="max-w-[10rem] font-mono" />}
          </Field>
        </div>
      </div>
      <p className="text-xs text-fg-faint">Rien n'est activé tant que ce code n'est pas confirmé.</p>
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy || code.length !== 6}>
          Confirmer
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function RecoveryCodes({ codes, first, email, onDone }: { codes: string[]; first: boolean; email: string; onDone: () => void }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast("success", "Codes copiés.");
    } catch {
      toast("error", "Copie impossible : téléchargez-les ou notez-les.");
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-muted">
        {first ? "Double authentification activée. Vos autres appareils ont été déconnectés. " : ""}
        Gardez ces codes à l'abri : ils permettent d'entrer si vous perdez votre téléphone. Chacun ne sert qu'une fois, et <b className="text-fg">ils ne seront plus jamais affichés</b>.
      </p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-surface-2 p-4 font-mono text-sm sm:grid-cols-5" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void copy()}>
          <Copy size={15} /> Copier
        </Button>
        <Button onClick={() => downloadText("hamac-codes-de-secours.txt", recoveryCodesFile(email, codes, new Date()))}>
          <Download size={15} /> Télécharger
        </Button>
        <Button variant="primary" onClick={onDone}>
          J'ai mis ces codes à l'abri
        </Button>
      </div>
    </div>
  );
}

function ProofForm({ intro, action, onCancel, onSubmit }: { intro: string; action: string; onCancel: () => void; onSubmit: (password: string, code: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) =>
        run(
          e,
          () => onSubmit(password, code),
          () => setCode(""),
        )
      }
    >
      <p className="text-sm text-fg-muted">{intro}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Votre mot de passe">{(id) => <TextInput id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />}</Field>
        <Field label="Code de l'application ou code de secours">{(id) => <TextInput id={id} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required className="font-mono" />}</Field>
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy || !password || !code}>
          {action}
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
