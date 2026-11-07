import { createHashRouter, RouterProvider } from "react-router";
import { Shell } from "@/layout/Shell";
import { ALL_ITEMS } from "@/nav";
import { Parametres } from "@/pages/Parametres";
import { Placeholder } from "@/pages/Placeholder";

// Routeur par hash : fonctionne en file:// (bureau) comme derrière un serveur web.
const router = createHashRouter([
  {
    element: <Shell />,
    children: ALL_ITEMS.map((item) => ({
      path: item.path,
      element: item.path === "/parametres" ? <Parametres /> : <Placeholder item={item} />,
    })),
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
