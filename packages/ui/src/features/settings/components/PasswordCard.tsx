import { useState, type FormEvent } from "react";
import { Field, TextInput } from "@/shared/components/form";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { auth } from "@/features/settings/lib/auth";
import { useToast } from "@/shared/lib/toast";

const MIN_LENGTH = 10;

/** Changement du mot de passe : ferme aussi les sessions ouvertes sur les autres appareils. */
export function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await auth.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("success", "Mot de passe changé. Les autres appareils sont déconnectés.");
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Mot de passe</CardTitle>
      <form className="grid gap-3 sm:grid-cols-3" onSubmit={submit}>
        <Field label="Mot de passe actuel">{(id) => <TextInput id={id} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />}</Field>
        <Field label="Nouveau mot de passe" help={`${MIN_LENGTH} caractères minimum.`}>
          {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />}
        </Field>
        <Field label="Confirmation" help={mismatch ? "Les deux mots de passe diffèrent." : undefined}>
          {(id) => <TextInput id={id} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />}
        </Field>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy || !current || next.length < MIN_LENGTH || next !== confirm}>
            Changer le mot de passe
          </Button>
        </div>
      </form>
    </Card>
  );
}
