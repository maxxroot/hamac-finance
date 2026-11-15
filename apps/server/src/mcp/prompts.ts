import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TokenScope } from "../auth/apiTokens";

/**
 * Scénarios prêts à l'emploi (« prompts » du protocole) : l'utilisateur les choisit dans son assistant,
 * qui reçoit la marche à suivre avec les outils de Hamac.
 */

const user = (text: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text } }] });

export function registerPrompts(server: McpServer, scope: TokenScope): void {
  const canWrite = scope === "write";

  server.registerPrompt(
    "prepare_tax_return",
    {
      title: "Préparer ma déclaration de revenus",
      description: "Contrôle les données, rapproche les IFU des établissements et donne les cases à reporter pour une année de revenus.",
      argsSchema: { year: z.string().regex(/^\d{4}$/).optional().describe("Année de revenus (AAAA) ; par défaut l'an dernier.") },
    },
    ({ year }) =>
      user(`Aide-moi à préparer ma déclaration de revenus${year ? ` pour les revenus ${year}` : " pour les revenus de l'an dernier"} avec Hamac.

1. check_data : signale-moi d'abord les incohérences qui fausseraient les montants (achat manquant, opération en double, compte sans établissement).
2. get_tax_report${year ? ` avec year ${year}` : ""} : dis-moi si les règles de l'année sont vérifiées, puis liste les points à contrôler.
3. Pour chaque établissement qui m'envoie un IFU, demande-moi le document. ${canWrite ? "Lis-le, puis prepare_tax_statement pour comparer ses cases au calcul de Hamac ; explique chaque écart et propose la correction (opération manquante, brut ou retenues à corriger). N'enregistre l'IFU (apply_tax_statement) et ne corrige le journal qu'avec mon accord." : "Compare ses cases au détail de get_tax_report avec institutionId et explique chaque écart."}
4. Donne-moi ensuite le tableau final des cases à reporter : case, formulaire (2042, 2042 C, 2074, 2086), montant, et si je dois le saisir ou seulement vérifier le prérempli.
5. Termine par les rappels (formulaires à joindre, options) et get_tax_estimate pour l'impôt restant à payer.

Cite les montants de Hamac tels quels et rappelle que c'est une aide : je reste responsable de ma déclaration.`),
  );

  server.registerPrompt(
    "year_end_review",
    {
      title: "Bilan fiscal de fin d'année",
      description: "Passe en revue ce qui peut encore réduire l'impôt avant le 31 décembre.",
    },
    () =>
      user(`Fais le point fiscal de fin d'année avec Hamac.

1. get_year_end_checklist : pour chaque point non coché, explique ce qu'il faut faire, avant quand, et l'économie estimée.
2. Dispense d'acompte : dis-moi quels établissements contacter avant le 30 novembre, d'après withholdingDispense.
3. get_tax_estimate : rappelle ce qui reste à payer à la prochaine déclaration.
4. Classe les actions par montant économisé. Ne fais aucune opération à ma place.`),
  );
}
