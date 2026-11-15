import { Archive, Download, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { DataDump } from "@hamac/api";
import { Modal } from "@/shared/components/form";
import { downloadText, pickTextFile } from "@/shared/lib/files";
import { call } from "@/shared/lib/transport";
import { useToast } from "@/shared/lib/toast";
import { useState } from "react";
import { AppearanceCard } from "@/features/settings/components/AppearanceCard";
import { AssistantsCard } from "@/features/settings/components/AssistantsCard";
import { PasswordCard } from "@/features/settings/components/PasswordCard";
import { TwoFactorCard } from "@/features/settings/components/TwoFactorCard";
import { Button, Card, CardTitle } from "@/shared/components/ui";
import { formatDate } from "@/shared/lib/numbers";
import { useSystemInfo } from "@/shared/lib/queries";

export function AppTab() {
  const info = useSystemInfo();
  return (
    <div className="max-w-3xl space-y-5">
      <AppearanceCard />
      <PasswordCard />
      <TwoFactorCard />
      <AssistantsCard />
      <BackupCard />
      <AppInfo info={info} />
    </div>
  );
}

export const TABLE_LABELS: Record<string, string> = {
  accounts: "comptes",
  assets: "titres",
  transactions: "opérations",
  contribution_plans: "versements programmés",
  prices: "cours",
};

export function BackupCard() {
  const toast = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<{ name: string; dump: DataDump } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportAll = async () => {
    const dump = await call("data.export");
    downloadText(`hamac-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dump), "application/json");
  };
  const choose = async () => {
    const f = await pickTextFile(".json,application/json");
    if (!f) return;
    try {
      const dump = JSON.parse(f.content) as DataDump;
      if (dump.format !== "hamac") throw new Error("format");
      setPending({ name: f.name, dump });
    } catch {
      toast("error", "Ce fichier n'est pas une sauvegarde Hamac.");
    }
  };
  const restore = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await call("data.import", { dump: pending.dump, confirm: "REMPLACER" });
      await qc.invalidateQueries();
      toast("success", "Sauvegarde restaurée.");
      setPending(null);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardTitle>Sauvegarde et transfert</CardTitle>
      <p className="mb-4 text-sm text-fg-muted">
        Un fichier unique avec toutes vos données : pour une copie de sécurité, ou pour passer d'une instance Hamac à une autre.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportAll}>
          <Download size={15} /> Exporter une sauvegarde
        </Button>
        <Button variant="ghost" onClick={choose}>
          <Upload size={15} /> Restaurer une sauvegarde…
        </Button>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restaurer une sauvegarde"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Annuler
            </Button>
            <Button variant="primary" onClick={restore} disabled={busy}>
              Remplacer toutes mes données
            </Button>
          </>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm">
            <p>
              <b>{pending.name}</b>, exportée le {formatDate(pending.dump.exportedAt.slice(0, 10))} (version {pending.dump.appVersion}).
            </p>
            <p className="text-fg-muted">
              Contenu :{" "}
              {Object.entries(TABLE_LABELS)
                .map(([t, l]) => `${pending.dump.tables[t]?.length ?? 0} ${l}`)
                .join(", ")}
              .
            </p>
            <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2">
              Toutes les données actuelles seront remplacées, sans retour possible. Exportez d'abord une sauvegarde pour pouvoir revenir en arrière.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
}

export function AppInfo({ info }: { info: ReturnType<typeof useSystemInfo> }) {
  return (
    <Card>
      <CardTitle>
        <span className="inline-flex items-center gap-2">
          <Archive size={15} /> Données et application
        </span>
      </CardTitle>
      {info.isLoading && <p className="text-sm text-fg-muted">Chargement…</p>}
      {info.error && <p className="text-sm text-negative">Backend injoignable : {(info.error as Error).message}</p>}
      {info.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
          <dt className="text-fg-muted">Version</dt>
          <dd>{info.data.appVersion}</dd>
          <dt className="text-fg-muted">Base de données</dt>
          <dd>
            <code className="text-xs break-all">{info.data.databasePath}</code>
          </dd>
          <dt className="text-fg-muted">Sauvegardes</dt>
          <dd>{info.data.backupsDir ?? "désactivées"}</dd>
          <dt className="text-fg-muted">Schéma</dt>
          <dd>{info.data.schemaVersion}</dd>
          <dt className="text-fg-muted">PostgreSQL</dt>
          <dd>{info.data.databaseVersion}</dd>
        </dl>
      )}
    </Card>
  );
}
