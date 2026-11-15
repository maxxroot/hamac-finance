import { z } from "zod";
import { CROWD_INSTRUMENT_LABELS, INSTITUTION_KIND_LABELS, INSTITUTION_KINDS, Offers, PROTECTION_COUNTRIES, type Institution } from "@hamac/core";
import { ToolError, type Call } from "../engine";
import { AFTER_CONSENT, found, merge, READ_ONLY, WRITE } from "./fields";
import type { ToolRegistrar } from "./registrar";

/** Établissements : banques, courtiers, assureurs, plateformes. Leur fiscalité oriente le récapitulatif fiscal. */

const TaxPatch = z
  .object({
    report: z.boolean().optional().describe("true : Hamac rédige le récapitulatif fiscal de cet établissement (il n'envoie pas d'IFU utilisable, ou on veut le contrôler) ; false : on s'en tient à son IFU."),
    withholds: z.boolean().optional().describe("L'établissement prélève lui-même l'acompte d'impôt et les prélèvements sociaux sur les intérêts et dividendes."),
    withheldIncomeTax: z.number().min(0).max(0.9).nullable().optional().describe("Taux d'acompte retenu, s'il diffère du taux par défaut (fraction ; null = défaut, 0 = rien)."),
    withheldSocial: z.number().min(0).max(0.9).nullable().optional().describe("Taux de prélèvements sociaux retenus, s'il diffère du défaut (fraction ; null = défaut, 0 = rien)."),
    crowdInstrument: z.enum(["prets", "obligations"]).optional().describe(`Crowdlending : ${Object.values(CROWD_INSTRUMENT_LABELS).join(" ; ")}.`),
  })
  .optional();

export function registerInstitutionTools(tool: ToolRegistrar, call: Call, canWrite: boolean): void {
  tool(
    "list_institutions",
    {
      title: "Établissements",
      description: "Liste les établissements (banques, courtiers, assureurs, plateformes de crowdlending et de crypto) avec leur identifiant, leurs comptes, leur fiscalité (récapitulatif rédigé par Hamac ou IFU, impôts prélevés à la source), leur protection en cas de faillite et leurs grilles de frais.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const ws = await call("workspace.load");
      return ws.institutions.map((i) => ({
        id: i.id,
        name: i.name,
        kind: i.kind,
        kindLabel: INSTITUTION_KIND_LABELS[i.kind],
        website: i.website,
        score: i.score,
        comment: i.comment,
        tax: i.tax,
        protection: i.protection,
        offers: i.offers,
        accounts: ws.accounts.filter((a) => a.institutionId === i.id).map((a) => ({ id: a.id, name: a.name, kind: a.kind, archived: a.archived })),
      }));
    },
  );

  if (!canWrite) return;

  tool(
    "save_institution",
    {
      title: "Créer ou modifier un établissement",
      description: `Sans id : crée un établissement (name et kind requis). Avec id : modifie seulement les champs donnés, le reste est gardé. tax, protection et chaque grille de offers sont fusionnés avec l'existant. Rattachez ensuite les comptes avec save_account (institutionId). ${AFTER_CONSENT}`,
      inputSchema: {
        id: z.string().optional().describe("Identifiant de list_institutions, pour une modification."),
        name: z.string().trim().min(1).max(80).optional(),
        kind: z.enum(INSTITUTION_KINDS).optional(),
        website: z.string().trim().max(200).optional(),
        score: z.number().min(0).max(10).nullable().optional().describe("Note personnelle sur 10."),
        comment: z.string().trim().max(1000).optional(),
        tax: TaxPatch,
        protection: z.object({ guarantor: z.string().trim().max(80).optional().describe("Établissement agréé qui porte la garantie, s'il diffère."), country: z.enum(PROTECTION_COUNTRIES).optional() }).optional(),
        offers: Offers.optional().describe("Grilles de frais par type de compte (pea, cto, assurance_vie, crypto) : une grille donnée remplace l'ancienne grille du même type."),
      },
      annotations: WRITE,
    },
    async ({ id, tax, protection, offers, ...fields }) => {
      const ws = id ? await call("workspace.load") : null;
      const existing: Institution | undefined = id && ws ? found(ws.institutions, id, "Établissement", "list_institutions") : undefined;
      if (!existing && (!fields.name || !fields.kind)) throw new ToolError("Pour créer un établissement, donnez au moins name et kind.");
      const input = merge(existing, {
        ...fields,
        tax: tax ? merge(existing?.tax, tax) : undefined,
        protection: protection ? merge(existing?.protection, protection) : undefined,
        offers: offers ? { ...existing?.offers, ...offers } : undefined,
      });
      const saved = await call("institutions.upsert", input as never);
      return { created: !existing, id: saved.id, name: saved.name, kind: saved.kind, tax: saved.tax };
    },
  );
}
