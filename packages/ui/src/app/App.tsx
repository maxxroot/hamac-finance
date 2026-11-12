import { createHashRouter, Navigate, RouterProvider } from "react-router";
import { AuthGate } from "@/app/layout/AuthGate";
import { RouteError } from "@/app/layout/RouteError";
import { Shell } from "@/app/layout/Shell";
import { ALL_ITEMS } from "@/shared/nav";
import { Actions, Crowdlending, Crypto, Obligations } from "@/features/investments";
import { AttestationLoyer, AvisEcheance, Bien, CourrierRevision, GestionLocative, Immobilier, ImpressionBien, Quittance, Relance } from "@/features/realestate";
import { Credits } from "@/features/loans";
import { Comptes, FondsEuros, Livrets } from "@/features/accounts";
import { Exposition, Historique, Performance } from "@/features/analysis";
import { Projection, Projets, Simulateurs } from "@/features/planning";
import { Compteurs, Declaration, Impots } from "@/features/tax";
import { Journal, Versements } from "@/features/journal";
import { Notice } from "@/features/help";
import { TableauDeBord } from "@/features/dashboard";
import { Parametres } from "@/features/settings";
import type { ReactNode } from "react";
import { Placeholder } from "@/app/Placeholder";
import { AutresBiens } from "@/features/other-assets";

const PAGES: Record<string, ReactNode> = {
  "/": <TableauDeBord />,
  "/projection": <Projection />,
  "/notice": <Notice />,
  "/parametres": <Parametres />,
  "/journal": <Journal />,
  "/versements": <Versements />,
  "/comptes": <Comptes />,
  "/livrets": <Livrets />,
  "/fonds-euros": <FondsEuros />,
  "/obligations": <Obligations />,
  "/actions": <Actions />,
  "/exposition": <Exposition />,
  "/crypto": <Crypto />,
  "/crowdlending": <Crowdlending />,
  "/immobilier": <Immobilier />,
  "/gestion-locative": <GestionLocative />,
  "/autres-biens": <AutresBiens />,
  "/credits": <Credits />,
  "/performance": <Performance />,
  "/impots": <Impots />,
  "/declaration": <Declaration />,
  "/compteurs": <Compteurs />,
  "/projets": <Projets />,
  "/historique": <Historique />,
  "/simulateurs": <Simulateurs />,
};

// Routeur par hash : aucune configuration de réécriture d'URL côté reverse proxy.
const router = createHashRouter([
  {
    element: <Shell />,
    errorElement: <RouteError />,
    children: [
      ...ALL_ITEMS.map((item) => ({
        path: item.path,
        element: PAGES[item.path] ?? <Placeholder item={item} />,
        // Une erreur dans une page n'emporte pas la navigation.
        errorElement: <RouteError />,
      })),
      { path: "/immobilier/:id", element: <Bien />, errorElement: <RouteError /> },
      // Ancienne adresse de « Mes comptes » (favoris).
      { path: "/enveloppes", element: <Navigate to="/comptes" replace /> },
    ],
  },
  // Pages à imprimer : sans menu ni fond sombre.
  { path: "/impression/bien/:id", element: <ImpressionBien />, errorElement: <RouteError /> },
  { path: "/impression/quittance/:leaseId/:month", element: <Quittance />, errorElement: <RouteError /> },
  { path: "/impression/revision/:rentId", element: <CourrierRevision />, errorElement: <RouteError /> },
  { path: "/impression/relance/:leaseId/:level", element: <Relance />, errorElement: <RouteError /> },
  { path: "/impression/avis/:leaseId/:month", element: <AvisEcheance />, errorElement: <RouteError /> },
  { path: "/impression/attestation/:leaseId", element: <AttestationLoyer />, errorElement: <RouteError /> },
]);

export function App() {
  return <AuthGate>{() => <RouterProvider router={router} />}</AuthGate>;
}
