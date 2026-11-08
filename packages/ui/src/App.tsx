import { createHashRouter, RouterProvider } from "react-router";
import { AuthGate } from "@/layout/AuthGate";
import { RouteError } from "@/layout/RouteError";
import { Shell } from "@/layout/Shell";
import { ALL_ITEMS } from "@/nav";
import { Actions } from "@/pages/Actions";
import { Credits } from "@/pages/Credits";
import { Crypto } from "@/pages/Crypto";
import { FondsEuros } from "@/pages/FondsEuros";
import { Historique } from "@/pages/Historique";
import { Immobilier } from "@/pages/Immobilier";
import { Impots } from "@/pages/Impots";
import { Journal } from "@/pages/Journal";
import { Livrets } from "@/pages/Livrets";
import { Obligations } from "@/pages/Obligations";
import { Performance } from "@/pages/Performance";
import { Notice } from "@/pages/Notice";
import { Etablissements } from "@/pages/Etablissements";
import { Projection } from "@/pages/Projection";
import { Regles } from "@/pages/Regles";
import { Synthese } from "@/pages/Synthese";
import { TableauDeBord } from "@/pages/TableauDeBord";
import { Parametres } from "@/pages/Parametres";
import { Versements } from "@/pages/Versements";
import type { ReactNode } from "react";
import { Placeholder } from "@/pages/Placeholder";

const PAGES: Record<string, ReactNode> = {
  "/": <TableauDeBord />,
  "/projection": <Projection />,
  "/notice": <Notice />,
  "/regles": <Regles />,
  "/etablissements": <Etablissements />,
  "/parametres": <Parametres />,
  "/journal": <Journal />,
  "/versements": <Versements />,
  "/enveloppes": <Synthese />,
  "/livrets": <Livrets />,
  "/fonds-euros": <FondsEuros />,
  "/obligations": <Obligations />,
  "/actions": <Actions />,
  "/crypto": <Crypto />,
  "/immobilier": <Immobilier />,
  "/credits": <Credits />,
  "/performance": <Performance />,
  "/impots": <Impots />,
  "/historique": <Historique />,
};

// Routeur par hash : fonctionne en file:// (bureau) comme derrière un serveur web.
const router = createHashRouter([
  {
    element: <Shell />,
    errorElement: <RouteError />,
    children: ALL_ITEMS.map((item) => ({
      path: item.path,
      element: PAGES[item.path] ?? <Placeholder item={item} />,
      // Une erreur dans une page n'emporte pas la navigation.
      errorElement: <RouteError />,
    })),
  },
]);

export function App() {
  return <AuthGate>{() => <RouterProvider router={router} />}</AuthGate>;
}
