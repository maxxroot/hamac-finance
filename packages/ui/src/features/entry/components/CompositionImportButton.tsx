import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui";
import { EXPOSURE_KEY } from "@/features/entry/lib/exposure";
import { formatDate } from "@/shared/lib/numbers";
import { pickTextFile } from "@/shared/lib/files";
import { useToast } from "@/shared/lib/toast";
import { call } from "@/shared/lib/transport";

/** Où trouver le fichier : la version anglaise du site, celle que lit Hamac. */
export const ISHARES_FILE_HINT = "Sur ishares.com (version anglaise, ishares.com/uk), page du fonds › Holdings › Download : déposez le fichier tel quel, sans l'ouvrir dans un tableur.";

/**
 * Administrateur : dépose le fichier de composition d'iShares téléchargé depuis son navigateur,
 * quand iShares refuse les requêtes du serveur. La composition sert ensuite à toute l'instance.
 */
export function CompositionImportButton({ isin, name, className }: Readonly<{ isin: string; name: string | null; className?: string }>) {
  const qc = useQueryClient();
  const toast = useToast();
  const upload = useMutation({
    mutationFn: (csv: string) => call("exposure.importFile", { isin, csv, name }),
    onSuccess: (info) => {
      void qc.invalidateQueries({ queryKey: [EXPOSURE_KEY] });
      toast("success", `Composition enregistrée : ${info.lineCount.toLocaleString("fr-FR")} lignes au ${formatDate(info.asOf)}`);
    },
    onError: (e: Error) => toast("error", e.message),
  });
  return (
    <Button
      variant="ghost"
      className={className ?? "h-7 text-accent"}
      title={ISHARES_FILE_HINT}
      disabled={upload.isPending}
      onClick={async () => {
        const f = await pickTextFile(".csv,text/csv");
        if (f) upload.mutate(f.content);
      }}
    >
      {upload.isPending ? "Lecture…" : "Déposer le fichier iShares"}
    </Button>
  );
}
