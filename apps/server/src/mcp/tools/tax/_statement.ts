import { z } from "zod";
import type { ConfirmationStore } from "../../confirmations";
import { loadEngine, ToolError, type Call } from "../../engine";
import { found, READ_ONLY, WRITE } from "../fields";
import type { ToolRegistrar } from "../registrar";
import { comparison, savedStatement, taxReportFor } from "./_report";

/**
 * Montants de l'IFU d'un établissement, en deux temps comme tout ce qui est lu dans un document :
 * `prepare_tax_statement` compare au calcul de Hamac sans rien écrire, `apply_tax_statement` enregistre.
 */

const KIND = "tax_statement";

interface Payload {
  year: number;
  amounts: Array<{ box: string; amount: number }>;
}

export function registerTaxStatementTools(tool: ToolRegistrar, call: Call, confirmations: ConfirmationStore, tenantId: string): void {
  tool(
    "prepare_tax_statement",
    {
      title: "Préparer la saisie d'un IFU",
      description:
        "Compare les montants lus sur l'IFU (imprimé fiscal unique) d'un établissement aux montants que Hamac calcule, case par case, SANS RIEN ÉCRIRE, et renvoie un identifiant de confirmation valable 15 minutes. Les montants déjà saisis pour cet établissement et cette année seront remplacés. Montrez les écarts à l'utilisateur ; n'appelez apply_tax_statement qu'après son accord.",
      inputSchema: {
        institutionId: z.string().describe("Établissement de list_institutions qui a émis l'IFU."),
        year: z.number().int().min(2000).max(2100).describe("Année des revenus (l'IFU de 2026 porte sur les revenus 2025)."),
        amounts: z
          .array(z.object({ box: z.string().trim().toUpperCase().min(1).max(8).describe("Case de la déclaration, ex. 2DC, 2TR, 3VG."), amount: z.number().finite().describe("Montant de la case, en euros.") }))
          .min(1)
          .max(40),
      },
      annotations: READ_ONLY,
    },
    async ({ institutionId, year, amounts }) => {
      const engine = await loadEngine(call);
      const institution = found(engine.ws.institutions, institutionId, "Établissement", "list_institutions");
      const boxes = amounts.map((a) => a.box);
      const twice = boxes.filter((b, i) => boxes.indexOf(b) !== i);
      if (twice.length) throw new ToolError(`Case donnée plusieurs fois : ${[...new Set(twice)].join(", ")}.`);
      const { report } = taxReportFor(engine, year);
      const sheet = report.sheets.find((s) => s.institutionId === institutionId);
      const compared = sheet ? comparison(sheet, report, new Map(amounts.map((a) => [a.box, a.amount]))) : [];
      const comparedBoxes = new Set(compared.map((c) => c.box));
      const previous = [...savedStatement(engine, institutionId, year)].map(([box, amount]) => ({ box, amount }));
      const pending = confirmations.add(tenantId, { kind: KIND, targetId: institutionId, label: `IFU ${year} de ${institution.name}`, payload: { year, amounts } satisfies Payload });
      return {
        confirmationId: pending.id,
        institution: institution.name,
        year,
        comparison: compared,
        notComparedBoxes: amounts.filter((a) => !comparedBoxes.has(a.box)),
        replaces: previous,
        ...(sheet ? {} : { note: "Hamac n'a pas de fiche pour cet établissement cette année (aucun revenu ni cession de compte-titres, de crowdlending ou de crypto) : les montants sont gardés sans comparaison." }),
        next: "Montrez les écarts à l'utilisateur (un écart vient souvent d'une opération manquante ou d'un brut mal saisi). Seulement après son accord : apply_tax_statement avec confirmationId.",
      };
    },
  );

  tool(
    "apply_tax_statement",
    {
      title: "Enregistrer un IFU",
      description: "Enregistre les montants d'IFU annoncés par prepare_tax_statement, après accord explicite de l'utilisateur. Ils remplacent ceux déjà saisis pour cet établissement et cette année ; get_tax_report signale ensuite les écarts.",
      inputSchema: { confirmationId: z.string().describe("Identifiant renvoyé par prepare_tax_statement.") },
      annotations: WRITE,
    },
    async ({ confirmationId }) => {
      const pending = confirmations.take(tenantId, confirmationId, [KIND]);
      if (!pending) throw new ToolError("Confirmation introuvable, déjà utilisée ou expirée (15 minutes) : refaites prepare_tax_statement.");
      const { year, amounts } = pending.payload as Payload;
      await call("taxStatements.save", { institutionId: pending.targetId, year, amounts });
      return { saved: pending.label, boxes: amounts.length };
    },
  );
}
