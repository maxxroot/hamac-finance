import { z } from "zod";
import type { Workspace } from "@hamac/api";
import { buildImport, CSV_ROLES, detectFormat, findHeaderRow, guessRoles, linesFromCsv, normalizeParams, parseCsv, parseOfx, parseQif, Schedule, TX_LABELS, TX_TYPES, type CsvRole, type ImportProposal, type StatementLine } from "@hamac/core";
import { cents, parisToday, ToolError, type Call } from "../engine";
import { UNDO_TTL_MS, type Draft, type DraftStore } from "../drafts";
import type { ToolRegistrar } from "./registrar";

/**
 * Import en deux temps (décision 0009) : `prepare_import` compare des lignes au journal avec `buildImport`
 * de `@hamac/core` et garde l'aperçu ; `apply_import` n'écrit que cet aperçu, s'il est toujours à jour.
 */

const MAX_LINES = 2000;
/** Un relevé CSV de plusieurs années tient largement dans cette taille. */
const MAX_FILE_CHARS = 5_000_000;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");

const LineInput = z.object({
  date: isoDate,
  amount: z.number().finite().describe("Montant signé, tel que sur le relevé : positif quand l'argent arrive sur le compte (versement, vente, dividende), négatif quand il en sort (retrait, achat, frais)."),
  label: z.string().max(500).default("").describe("Libellé du relevé, gardé en commentaire."),
  type: z.enum(TX_TYPES).optional().describe("Type d'opération, si le document le dit clairement ; sinon Hamac le devine d'après le libellé et le signe."),
  isin: z.string().max(12).optional(),
  assetName: z.string().max(120).optional().describe("Nom du titre tel qu'écrit dans le document."),
  assetId: z.string().optional().describe("Identifiant d'un titre de list_assets, si vous l'avez reconnu."),
  quantity: z.number().positive().optional().describe("Achat, vente : nombre de parts."),
  fee: z.number().min(0).optional().describe("Achat, vente : frais compris dans le montant."),
});

const FileInput = z.object({
  content: z.string().max(MAX_FILE_CHARS).describe("Texte intégral du fichier CSV, OFX ou QIF, sans le modifier."),
  name: z.string().max(200).default("").describe("Nom du fichier : aide à reconnaître le format."),
  columns: z.array(z.enum([...CSV_ROLES, ""])).optional().describe("CSV seulement : rôle de chaque colonne, si celui deviné par Hamac (renvoyé dans l'aperçu) est faux."),
});

const toLine = (l: z.output<typeof LineInput>): StatementLine => ({ date: l.date, amount: l.amount, label: l.label, typeHint: "", quantity: l.quantity ?? null, isin: l.isin?.trim().toUpperCase() || null, assetName: l.assetName?.trim() || null, fee: l.fee ?? null, type: l.type ?? null, assetId: l.assetId ?? null });

/** Même lecture que la fenêtre d'import de l'interface (`StatementImportDialog`). */
function linesFromFile(file: z.output<typeof FileInput>): { lines: StatementLine[]; format: string; columns?: Array<{ header: string; role: CsvRole }> } {
  const format = detectFormat(file.content, file.name);
  if (format === "ofx") return { lines: parseOfx(file.content).lines, format };
  if (format === "qif") return { lines: parseQif(file.content), format };
  const rows = parseCsv(file.content);
  const h = findHeaderRow(rows);
  const headers = rows[h] ?? [];
  const roles = file.columns ?? guessRoles(headers);
  if (roles.length !== headers.length) throw new ToolError(`Le fichier a ${headers.length} colonnes (${headers.join(" | ")}) : donnez un rôle par colonne.`);
  return { lines: linesFromCsv(rows.slice(h + 1), roles), format, columns: headers.map((header, i) => ({ header, role: roles[i] ?? "" })) };
}

function propose(ws: Workspace, draft: Pick<Draft, "accountId" | "lines" | "defaultType">, today: string): ImportProposal[] {
  const accounts = new Map(ws.accounts.map((a) => [a.id, a]));
  const account = accounts.get(draft.accountId);
  if (!account) throw new ToolError("Compte introuvable : appelez list_accounts pour obtenir les identifiants.");
  const { profile } = normalizeParams(ws.params);
  const schedule = new Schedule(ws.plans, ws.skips, profile.startMonth, profile.contributionDay);
  return buildImport({ lines: draft.lines, account, accounts, assets: ws.assets, existing: ws.transactions, schedule, today, defaultType: draft.defaultType });
}

const STATUS_HELP = {
  ok: "nouvelle opération, sera importée",
  doublon: "déjà au journal (même date, type, montant et titre, ou transfert déjà saisi) : écartée sauf si include la reprend",
  programme: "versement déjà compté par le calendrier des versements programmés : écarté sauf si include le reprend",
  erreur: "invalide : ne peut pas être importée, voir errors",
};

export function registerImportTools(tool: ToolRegistrar, call: Call, drafts: DraftStore, tenantId: string): void {
  tool(
    "prepare_import",
    {
      title: "Préparer un import d'opérations",
      description:
        "Compare des opérations au journal d'un compte et renvoie un aperçu, SANS RIEN ÉCRIRE. Donnez soit `lines` (ce que vous avez lu dans un PDF, une image, un tableau), soit `file` (le texte brut d'un fichier CSV, OFX ou QIF, que Hamac lit lui-même). Pour chaque ligne : type retenu, titre reconnu, statut (ok, doublon, programme, erreur) et raison. Montrez l'aperçu à l'utilisateur avant d'appeler apply_import avec l'identifiant renvoyé.",
      inputSchema: {
        accountId: z.string().describe("Compte de list_accounts sur lequel portent les opérations."),
        lines: z.array(LineInput).min(1).max(MAX_LINES).optional(),
        file: FileInput.optional(),
        defaultType: z.enum([...TX_TYPES, "auto"]).default("auto").describe("Type appliqué aux lignes sans type ; auto = deviné."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ accountId, lines, file, defaultType }) => {
      if (!!lines === !!file) throw new ToolError("Donnez soit `lines`, soit `file`, pas les deux.");
      const read = file ? linesFromFile(file) : { lines: lines!.map(toLine), format: "lignes" };
      if (read.lines.length === 0) throw new ToolError("Aucune ligne lue dans ce fichier.");
      if (read.lines.length > MAX_LINES) throw new ToolError(`Plus de ${MAX_LINES} lignes : découpez l'import par période.`);
      const ws = await call("workspace.load");
      const proposals = propose(ws, { accountId, lines: read.lines, defaultType }, parisToday());
      const draft = drafts.add(tenantId, { accountId, lines: read.lines, defaultType, statuses: proposals.map((p) => p.status) });
      const count = (s: ImportProposal["status"]) => proposals.filter((p) => p.status === s).length;
      const unknown = new Map<string, { isin: string | null; name: string; lines: number[] }>();
      proposals.forEach((p, index) => {
        if (!p.unknownAsset) return;
        const u = unknown.get(p.unknownAsset.key) ?? { isin: p.unknownAsset.isin, name: p.unknownAsset.name, lines: [] };
        u.lines.push(index);
        unknown.set(p.unknownAsset.key, u);
      });
      return {
        importId: draft.id,
        account: ws.accounts.find((a) => a.id === accountId)?.name,
        format: read.format,
        ...(read.columns ? { columns: read.columns } : {}),
        summary: { lines: proposals.length, ok: count("ok"), duplicates: count("doublon"), scheduled: count("programme"), errors: count("erreur") },
        statusHelp: STATUS_HELP,
        unknownAssets: [...unknown.values()],
        lines: proposals.map((p, index) => ({
          index,
          status: p.status,
          date: p.tx.date,
          type: p.tx.type,
          typeLabel: TX_LABELS[p.tx.type],
          amount: cents(p.tx.amount),
          asset: p.assetName,
          assetId: p.tx.assetId,
          quantity: p.tx.quantity,
          fee: p.tx.fee,
          label: p.tx.comment,
          ...(p.errors.length ? { errors: p.errors } : {}),
        })),
        next: "Montrez ce résumé à l'utilisateur et demandez son accord avant apply_import. Un titre inconnu se crée avec save_asset (après accord), puis on refait prepare_import.",
      };
    },
  );

  tool(
    "apply_import",
    {
      title: "Appliquer un import préparé",
      description:
        "Écrit dans le journal les lignes d'un aperçu de prepare_import, après accord explicite de l'utilisateur : toutes les lignes `ok`, sauf celles de `exclude`, plus les doublons ou versements programmés que l'utilisateur veut garder (`include`). Refuse si le journal a changé depuis l'aperçu. L'import peut être annulé ensuite avec undo_import.",
      inputSchema: {
        importId: z.string().describe("Identifiant renvoyé par prepare_import."),
        exclude: z.array(z.number().int().min(0)).default([]).describe("Lignes `ok` à ne pas importer (index de l'aperçu)."),
        include: z.array(z.number().int().min(0)).default([]).describe("Lignes `doublon` ou `programme` à importer quand même (index de l'aperçu)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ importId, exclude, include }) => {
      const draft = drafts.get(tenantId, importId);
      if (!draft) throw new ToolError("Aperçu introuvable ou expiré (une heure) : refaites prepare_import.");
      if (draft.applied) throw new ToolError("Cet aperçu a déjà été appliqué.");
      const proposals = propose(await call("workspace.load"), draft, parisToday());
      if (proposals.some((p, i) => p.status !== draft.statuses[i])) throw new ToolError("Le journal a changé depuis l'aperçu : refaites prepare_import et montrez le nouvel aperçu.");
      const bad = include.filter((i) => proposals[i]?.status !== "doublon" && proposals[i]?.status !== "programme");
      if (bad.length) throw new ToolError(`include ne peut reprendre que des lignes doublon ou programme ; refusé : ${bad.join(", ")}.`);
      const skip = new Set(exclude);
      const keep = new Set(include);
      const chosen = proposals.filter((p, i) => (p.status === "ok" && !skip.has(i)) || keep.has(i));
      if (!chosen.length) throw new ToolError("Aucune ligne à importer.");
      const result = await call("transactions.bulkCreate", { items: chosen.map((p) => p.tx) });
      drafts.markApplied(tenantId, importId, result.ids);
      return {
        created: result.created,
        notImported: proposals.length - result.created,
        errors: result.errors,
        undo: `Annulable avec undo_import jusqu'au ${new Date(Date.now() + UNDO_TTL_MS).toISOString().slice(0, 16).replace("T", " ")} (UTC), tant que le serveur ne redémarre pas.`,
      };
    },
  );

  tool(
    "undo_import",
    {
      title: "Annuler un import",
      description: "Supprime du journal les opérations créées par un apply_import des dernières 24 heures, y compris celles modifiées depuis dans Hamac. Demandez confirmation à l'utilisateur.",
      inputSchema: { importId: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ importId }) => {
      const draft = drafts.get(tenantId, importId);
      if (!draft?.applied) throw new ToolError("Aucun import appliqué sous cet identifiant dans les dernières 24 heures.");
      let deleted = 0;
      for (const id of draft.applied.ids) {
        try {
          await call("transactions.delete", { id });
          deleted++;
        } catch {
          // Déjà supprimée dans l'interface : rien à faire.
        }
      }
      drafts.remove(tenantId, importId);
      return { deleted, alreadyGone: draft.applied.ids.length - deleted };
    },
  );
}

