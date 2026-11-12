import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { EtfExposure } from "@hamac/api";
import { Field, Modal, TextInput } from "@/components/form";
import { Button } from "@/components/ui";
import { compositionStatus, EXPOSURE_KEY } from "@/lib/exposure";
import { useToast } from "@/lib/toast";
import { call } from "@/lib/transport";

/**
 * Choix de l'ETF physique équivalent d'un ETF synthétique ou d'un émetteur non géré, pour en reprendre la composition.
 * Le choix ne vaut que pour soi ; le premier choix vérifié de l'instance devient la proposition des autres utilisateurs.
 */
export function EquivalentDialog({ etf, onClose }: { etf: EtfExposure | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [isin, setIsin] = useState("");
  const choose = useMutation({
    mutationFn: (proxyIsin: string | null) => call("exposure.choose", { assetId: etf!.assetId, proxyIsin }),
    onSuccess: (_r, proxyIsin) => {
      void qc.invalidateQueries({ queryKey: [EXPOSURE_KEY] });
      toast("success", proxyIsin ? "Équivalent enregistré" : "Choix retiré");
      onClose();
    },
  });
  const { reset } = choose;
  useEffect(() => {
    if (etf) {
      setIsin("");
      reset();
    }
  }, [etf, reset]);
  if (!etf) return null;
  const valid = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin);
  const suggestion = etf.suggestion && etf.suggestion.isin !== etf.choice ? etf.suggestion : null;

  return (
    <Modal
      open={!!etf}
      onClose={onClose}
      title={`Équivalent pour « ${etf.name} »`}
      footer={
        <>
          {etf.choice && (
            <Button variant="ghost" className="mr-auto" onClick={() => choose.mutate(null)} disabled={choose.isPending}>
              {etf.link ? "Revenir à la proposition commune" : "Retirer mon choix"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-fg-muted">{compositionStatus(etf).text}</p>
        <p className="text-fg-muted">
          Choisissez un ETF <strong className="text-fg">physique</strong> qui suit le même indice : Hamac reprendra sa composition pour l'exposition réelle. Il doit être publié par Amundi ou iShares. Ce
          choix ne vaut que pour vous.
        </p>
        {suggestion && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
            <span>
              {suggestion.name} <span className="text-xs text-fg-faint">· {suggestion.index} · {suggestion.isin}</span>
            </span>
            <Button variant="primary" className="h-8" onClick={() => choose.mutate(suggestion.isin)} disabled={choose.isPending}>
              Utiliser
            </Button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) choose.mutate(isin);
          }}
        >
          <Field label={suggestion ? "Ou un autre ETF physique (ISIN)" : "ETF physique équivalent (ISIN)"} className="flex-1">
            {(id) => <TextInput id={id} value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase().trim())} placeholder="IE00B4L5Y983" className="font-mono" />}
          </Field>
          <Button type="submit" disabled={!valid || choose.isPending}>
            {choose.isPending ? "Vérification…" : "Vérifier et utiliser"}
          </Button>
        </form>
        {choose.isError && <p className="text-xs text-negative">{(choose.error as Error).message}</p>}
      </div>
    </Modal>
  );
}
