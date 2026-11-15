import { z } from "zod";
import type { ProcName, Workspace } from "@hamac/api";
import { TX_LABELS } from "@hamac/core";
import type { ConfirmationStore } from "../confirmations";
import { ToolError, type Call } from "../engine";
import { READ_ONLY } from "./fields";
import type { ToolRegistrar } from "./registrar";

/**
 * Suppressions avec accord préalable : `prepare_deletion` décrit ce qui va disparaître sans rien toucher,
 * `apply_deletion` supprime seulement après confirmation, avec l'identifiant renvoyé.
 */

interface Described {
  label: string;
  /** Ce qui part avec l'objet, ou ce qui en est détaché. */
  consequences: string[];
  /** Raison de refuser la suppression (l'objet est encore utilisé). */
  blocker?: string;
}

interface DeletionKind {
  procedure: ProcName;
  listTool: string;
  describe: (ws: Workspace, id: string) => Described | null;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const opsOf = (ws: Workspace, pred: (t: Workspace["transactions"][number]) => boolean) => ws.transactions.filter(pred).length;

const KINDS: Record<string, DeletionKind> = {
  institution: {
    procedure: "institutions.delete",
    listTool: "list_institutions",
    describe: (ws, id) => {
      const i = ws.institutions.find((x) => x.id === id);
      if (!i) return null;
      const accounts = ws.accounts.filter((a) => a.institutionId === id);
      const tax = ws.taxStatements.filter((s) => s.institutionId === id).length;
      return {
        label: `Établissement « ${i.name} »`,
        consequences: [
          ...(accounts.length ? [`${count(accounts.length, "compte")} détaché(s), sans être supprimé(s) : ${accounts.map((a) => a.name).join(", ")}`] : []),
          ...(tax ? [`${count(tax, "montant")} de document fiscal (IFU) supprimé(s)`] : []),
        ],
      };
    },
  },
  account: {
    procedure: "accounts.delete",
    listTool: "list_accounts",
    describe: (ws, id) => {
      const a = ws.accounts.find((x) => x.id === id);
      if (!a) return null;
      const ops = opsOf(ws, (t) => t.accountId === id || t.counterAccountId === id);
      const projects = ws.crowdProjects.filter((p) => p.accountId === id).length;
      const blocker = ops ? `Ce compte a ${count(ops, "opération")} : archivez-le avec save_account (archived: true) plutôt que de le supprimer.` : projects ? `Cette plateforme a ${count(projects, "projet")} : archivez-la plutôt que de la supprimer.` : undefined;
      const statements = ws.statements.filter((s) => s.accountId === id).length;
      const plans = ws.plans.filter((p) => p.accountId === id).length;
      return {
        label: `Compte « ${a.name} »`,
        consequences: [...(statements ? [`${count(statements, "relevé")} de situation supprimé(s)`] : []), ...(plans ? [`versements programmés supprimés`] : []), "taux datés et taux servis du compte supprimés"],
        blocker,
      };
    },
  },
  asset: {
    procedure: "assets.delete",
    listTool: "list_assets",
    describe: (ws, id) => {
      const a = ws.assets.find((x) => x.id === id);
      if (!a) return null;
      const ops = opsOf(ws, (t) => t.assetId === id || t.counterAssetId === id);
      return {
        label: `Titre « ${a.name} »${a.isin ? ` (${a.isin})` : ""}`,
        consequences: ["historique des cours saisis supprimé"],
        blocker: ops ? `Ce titre apparaît dans ${count(ops, "opération")} : archivez-le avec save_asset (archived: true) plutôt que de le supprimer.` : undefined,
      };
    },
  },
  transaction: {
    procedure: "transactions.delete",
    listTool: "list_transactions",
    describe: (ws, id) => {
      const t = ws.transactions.find((x) => x.id === id);
      if (!t) return null;
      const account = ws.accounts.find((a) => a.id === t.accountId)?.name ?? t.accountId;
      const asset = t.assetId ? ws.assets.find((a) => a.id === t.assetId)?.name : null;
      return { label: `Opération du ${t.date} : ${TX_LABELS[t.type]} de ${t.amount} € sur « ${account} »${asset ? `, ${asset}` : ""}`, consequences: ["les encours, plus-values et impôts calculés changent en conséquence"] };
    },
  },
  statement: {
    procedure: "statements.delete",
    listTool: "get_account",
    describe: (ws, id) => {
      const s = ws.statements.find((x) => x.id === id);
      return s ? { label: `Relevé de situation du ${s.date} (${s.value} €)`, consequences: [] } : null;
    },
  },
  account_rate: {
    procedure: "accountRates.delete",
    listTool: "get_account",
    describe: (ws, id) => {
      const r = ws.accountRates.find((x) => x.id === id);
      return r ? { label: `Taux de ${(r.rate * 100).toFixed(2)} % à partir du ${r.fromDate}`, consequences: ["les intérêts du livret sont recalculés avec les autres taux"] } : null;
    },
  },
  contribution_plan: {
    procedure: "plans.delete",
    listTool: "get_account",
    describe: (ws, id) => {
      const p = ws.plans.find((x) => x.id === id);
      return p ? { label: `Versement programmé de ${p.amount} € par mois à partir de ${p.fromMonth}`, consequences: ["les versements de cette période ne sont plus comptés"] } : null;
    },
  },
  contribution_skip: {
    procedure: "skips.delete",
    listTool: "get_account",
    describe: (ws, id) => {
      const s = ws.skips.find((x) => x.id === id);
      return s ? { label: `Versement non versé de ${s.amount} € en ${s.month}`, consequences: ["le versement programmé de ce mois est de nouveau compté en entier"] } : null;
    },
  },
};

export const DELETION_KINDS = Object.keys(KINDS) as [string, ...string[]];

function describe(ws: Workspace, kind: string, id: string): Described & { procedure: ProcName } {
  const k = KINDS[kind];
  if (!k) throw new ToolError(`Type d'objet inconnu : ${kind}.`);
  const d = k.describe(ws, id);
  if (!d) throw new ToolError(`Objet introuvable : appelez ${k.listTool} pour obtenir les identifiants.`);
  return { ...d, procedure: k.procedure };
}

export function registerDeletionTools(tool: ToolRegistrar, call: Call, confirmations: ConfirmationStore, tenantId: string): void {
  tool(
    "prepare_deletion",
    {
      title: "Préparer une suppression",
      description: "Décrit ce qu'une suppression ferait disparaître, SANS RIEN SUPPRIMER, et renvoie un identifiant de confirmation valable 15 minutes. Refuse si l'objet est encore utilisé (un compte ou un titre qui a des opérations s'archive). Montrez la description à l'utilisateur et n'appelez apply_deletion qu'après son accord explicite.",
      inputSchema: {
        kind: z.enum(DELETION_KINDS).describe("institution, account, asset, transaction, statement (relevé de situation), account_rate (taux daté d'un livret), contribution_plan, contribution_skip."),
        id: z.string().describe("Identifiant de l'objet, tel que renvoyé par les outils de lecture."),
      },
      annotations: READ_ONLY,
    },
    async ({ kind, id }) => {
      const d = describe(await call("workspace.load"), kind, id);
      if (d.blocker) throw new ToolError(d.blocker);
      const pending = confirmations.add(tenantId, { kind, targetId: id, label: d.label });
      return { deletionId: pending.id, target: d.label, consequences: d.consequences, next: "Montrez ceci à l'utilisateur. Seulement après son accord explicite : apply_deletion avec deletionId. Une suppression ne s'annule pas." };
    },
  );

  tool(
    "apply_deletion",
    {
      title: "Confirmer une suppression",
      description: "Supprime l'objet annoncé par prepare_deletion, après accord explicite de l'utilisateur. Une confirmation ne sert qu'une fois. Irréversible : seule une sauvegarde permet de revenir en arrière.",
      inputSchema: { deletionId: z.string().describe("Identifiant renvoyé par prepare_deletion.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ deletionId }) => {
      const pending = confirmations.take(tenantId, deletionId, DELETION_KINDS);
      if (!pending) throw new ToolError("Confirmation introuvable, déjà utilisée ou expirée (15 minutes) : refaites prepare_deletion.");
      // Relu au dernier moment : l'objet peut avoir été supprimé ou s'être mis à servir depuis l'annonce.
      const d = describe(await call("workspace.load"), pending.kind, pending.targetId);
      if (d.blocker) throw new ToolError(d.blocker);
      await call(d.procedure, { id: pending.targetId } as never);
      return { deleted: pending.label };
    },
  );
}
