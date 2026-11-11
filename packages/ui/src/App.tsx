import { createHashRouter, RouterProvider } from "react-router";
import { AuthGate } from "@/layout/AuthGate";
import { RouteError } from "@/layout/RouteError";
import { Shell } from "@/layout/Shell";
import { ALL_ITEMS } from "@/nav";
import { Actions } from "@/pages/Actions";
import { Bien } from "@/pages/Bien";
import { CourrierRevision } from "@/pages/CourrierRevision";
import { Credits } from "@/pages/Credits";
import { Crowdlending } from "@/pages/Crowdlending";
import { Crypto } from "@/pages/Crypto";
import { FondsEuros } from "@/pages/FondsEuros";
import { Historique } from "@/pages/Historique";
import { Simulateurs } from "@/pages/Simulateurs";
import { Immobilier } from "@/pages/Immobilier";
import { ImpressionBien } from "@/pages/ImpressionBien";
import { Quittance } from "@/pages/Quittance";
import { Declaration } from "@/pages/Declaration";
import { Impots } from "@/pages/Impots";
import { Journal } from "@/pages/Journal";
import { Livrets } from "@/pages/Livrets";
import { Obligations } from "@/pages/Obligations";
import { Performance } from "@/pages/Performance";
import { Notice } from "@/pages/Notice";
import { Projection } from "@/pages/Projection";
import { Synthese } from "@/pages/Synthese";
import { TableauDeBord } from "@/pages/TableauDeBord";
import { Parametres } from "@/pages/Parametres";
import { Versements } from "@/pages/Versements";
import type { ReactNode } from "react";
import { Placeholder } from "@/pages/Placeholder";
import { AutresBiens } from "@/pages/AutresBiens";
import { Rapprochement } from "@/pages/Rapprochement";

const PAGES: Record<string, ReactNode> = {
  "/": <TableauDeBord />,
  "/projection": <Projection />,
  "/notice": <Notice />,
  "/parametres": <Parametres />,
  "/journal": <Journal />,
  "/versements": <Versements />,
  "/rapprochement": <Rapprochement />,
  "/enveloppes": <Synthese />,
  "/livrets": <Livrets />,
  "/fonds-euros": <FondsEuros />,
  "/obligations": <Obligations />,
  "/actions": <Actions />,
  "/crypto": <Crypto />,
  "/crowdlending": <Crowdlending />,
  "/immobilier": <Immobilier />,
  "/autres-biens": <AutresBiens />,
  "/credits": <Credits />,
  "/performance": <Performance />,
  "/impots": <Impots />,
  "/declaration": <Declaration />,
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
    ],
  },
  // Pages à imprimer : sans menu ni fond sombre.
  { path: "/impression/bien/:id", element: <ImpressionBien />, errorElement: <RouteError /> },
  { path: "/impression/quittance/:leaseId/:month", element: <Quittance />, errorElement: <RouteError /> },
  { path: "/impression/revision/:rentId", element: <CourrierRevision />, errorElement: <RouteError /> },
]);

export function App() {
  return <AuthGate>{() => <RouterProvider router={router} />}</AuthGate>;
}
