import { AlertTriangle, RotateCw } from "lucide-react";
import { useRouteError } from "react-router";
import { Button, Card } from "@/components/ui";

/** Erreur inattendue dans une page : message clair, le reste de l'application reste utilisable. */
export function RouteError() {
  const error = useRouteError() as Error | undefined;
  return (
    <Card className="mx-auto mt-10 max-w-xl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={20} />
        <div className="min-w-0">
          <h1 className="font-semibold">Cette page a rencontré une erreur</h1>
          <p className="mt-1 text-sm text-fg-muted">Vos données ne sont pas touchées. Rechargez la page ; si l'erreur revient, notez le message ci-dessous pour la signaler.</p>
          {error?.message && <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-fg-muted">{error.message}</pre>}
          {import.meta.env.DEV && (
            <p className="mt-3 text-xs text-fg-faint">Développement : si l'interface et le backend ne sont plus synchronisés, relancez `pnpm dev`.</p>
          )}
          <Button className="mt-4" onClick={() => window.location.reload()}>
            <RotateCw size={14} /> Recharger
          </Button>
        </div>
      </div>
    </Card>
  );
}
