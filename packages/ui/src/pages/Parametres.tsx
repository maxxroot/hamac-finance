import { Card, CardTitle, PageHeader } from "@/components/ui";
import { useSystemInfo } from "@/lib/queries";
import { SETTINGS_ITEM } from "@/nav";

export function Parametres() {
  const info = useSystemInfo();
  return (
    <>
      <PageHeader title="Paramètres" description={SETTINGS_ITEM.description} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle hint="étape 5">Profil et hypothèses</CardTitle>
          <p className="text-sm text-fg-muted">
            Année de naissance, âge de départ, rendements attendus, allocation cible et fiscalité : arrivent à l'étape 5.
          </p>
        </Card>
        <Card>
          <CardTitle>Données et application</CardTitle>
          {info.isLoading && <p className="text-sm text-fg-muted">Chargement…</p>}
          {info.error && <p className="text-sm text-negative">Backend injoignable : {(info.error as Error).message}</p>}
          {info.data && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
              <Row label="Version">{info.data.appVersion}</Row>
              <Row label="Mode">{info.data.mode === "desktop" ? "Application de bureau" : "Serveur web"}</Row>
              <Row label="Base de données">
                <code className="break-all text-xs">{info.data.databasePath}</code>
              </Row>
              <Row label="Sauvegardes">
                {info.data.backupsDir ? <code className="break-all text-xs">{info.data.backupsDir}</code> : "désactivées"}
              </Row>
              <Row label="Schéma">{info.data.schemaVersion}</Row>
              <Row label="SQLite">{info.data.sqliteVersion}</Row>
            </dl>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-fg-muted">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
