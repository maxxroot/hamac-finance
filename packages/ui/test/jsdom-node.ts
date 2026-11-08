import { builtinEnvironments, type Environment } from "vitest/runtime";

/** DOM simulé, mais modules chargés comme sous Node : les tests d'interface utilisent le vrai backend (node:sqlite). */
export default { ...builtinEnvironments.jsdom, name: "jsdom-node", viteEnvironment: "ssr" } as Environment;
