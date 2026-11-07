import { createHashRouter, RouterProvider } from "react-router";
import { Shell } from "@/layout/Shell";
import { ALL_ITEMS } from "@/nav";
import { Journal } from "@/pages/Journal";
import { Parametres } from "@/pages/Parametres";
import { Versements } from "@/pages/Versements";
import type { ReactNode } from "react";
import { Placeholder } from "@/pages/Placeholder";

const PAGES: Record<string, ReactNode> = {
  "/parametres": <Parametres />,
  "/journal": <Journal />,
  "/versements": <Versements />,
};

// Routeur par hash : fonctionne en file:// (bureau) comme derrière un serveur web.
const router = createHashRouter([
  {
    element: <Shell />,
    children: ALL_ITEMS.map((item) => ({
      path: item.path,
      element: PAGES[item.path] ?? <Placeholder item={item} />,
    })),
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
