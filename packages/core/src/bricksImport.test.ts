import { describe, expect, it } from "vitest";
import { parseBricksSheet, planBricksImport } from "./bricksImport";
import type { CrowdProject } from "./crowdlending";
import type { Transaction } from "./domain";

const HEAD = ["id", "date", "type", "statut", "propriété", "type de contrat", "montant (€)", "prix de la brick (€)"];
const FILE = [
  HEAD,
  ["d1", "02/01/2026", "Crédit par carte", "Validée", null, null, 1000, null],
  ["d2", "03/01/2026", "Crédit par carte", "Refusée", null, null, 500, null],
  ["a1", "05/01/2026", "Achat de bricks", "Validée", "Résidence & Co", "loan", -300, 10],
  ["a2", "10/02/2026", "Achat de bricks", "Validée", "Résidence & Co", "loan", -200, 10],
  ["a3", "11/02/2026", "Achat de bricks", "Annulée", "Autre", "loan", -999, 10],
  ["r1", "15/03/2026", "Revenus reversés", "Validée", "Résidence & Co", "loan", 10, null],
  ["r2", "20/03/2026", "Revenus reversés", "Validée", "Résidence & Co", "loan", 5.5, null],
  ["t1", "20/03/2026", "Prélèvement à la source", "Validée", null, null, -4.65, null],
  ["c1", "25/03/2026", "Remboursement de capital", "Validée", "Résidence & Co", "loan", 100, null],
  ["p1", "26/03/2026", "Prime de parrainage en tant que parrain", "Validée", "Résidence & Co", "loan", 20, null],
  ["b1", "27/03/2026", "Solde boosté", "Validée", null, null, 2, null],
];

const load = async (rows = FILE) => parseBricksSheet([{ name: "transactions wallet", rows }]);
const apply = (plan: ReturnType<typeof planBricksImport>): { txs: Transaction[]; projects: CrowdProject[] } => ({
  txs: plan.transactions.map((t, i) => ({ id: `t${i}`, date: t.date, type: t.type, accountId: "c", assetId: null, counterAccountId: null, amount: t.amount, quantity: null, fee: null, comment: t.comment, externalId: t.externalId })),
  projects: plan.projects.map((p, i) => ({ id: `p${i}`, accountId: "c", name: p.name, amount: p.amount, rate: null, startDate: p.startDate, termMonths: null, repayment: "in_fine", status: p.status, statusDate: p.statusDate, repaidCapital: p.repaidCapital, expectedRecovery: null, inAllocation: null, comment: p.comment, externalId: p.externalId })),
});

describe("import du fichier Bricks", () => {
  it("lit les lignes : dates françaises, montants", async () => {
    const rows = await load();
    expect(rows).toHaveLength(11);
    expect(rows[2]).toMatchObject({ id: "a1", date: "2026-01-05", type: "Achat de bricks", project: "Résidence & Co", contract: "loan", amount: -300 });
  });

  it("refuse un autre fichier", () => {
    expect(() => parseBricksSheet([{ name: "x", rows: [["a", "b"], [1, 2]] }])).toThrow(/Bricks/);
  });

  it("premier import : versements, intérêts nets par mois, projets agrégés ; annulations ignorées", async () => {
    const plan = planBricksImport(await load(), "c", [], []);
    expect(plan.skipped).toBe(2);
    expect(plan.unknownTypes).toEqual([]);
    expect(plan.withheldRate).toBeCloseTo(0.3, 5);
    expect(plan.transactions.find((t) => t.externalId === "bricks:d1")).toMatchObject({ action: "nouveau", type: "versement", amount: 1000, date: "2026-01-02" });
    expect(plan.transactions.find((t) => t.externalId === "bricks:interets:2026-03")).toMatchObject({ type: "interets", amount: 10.85, date: "2026-03-20" });
    expect(plan.transactions.find((t) => t.externalId === "bricks:p1")).toMatchObject({ type: "correction", amount: 20 });
    expect(plan.transactions).toHaveLength(4);
    expect(plan.projects).toMatchObject([{ action: "nouveau", name: "Résidence & Co", amount: 500, startDate: "2026-01-05", repaidCapital: 100, status: "en_cours", comment: "Prêt" }]);
  });

  it("réimporter le même fichier ne change rien", async () => {
    const rows = await load();
    const { txs, projects } = apply(planBricksImport(rows, "c", [], []));
    const again = planBricksImport(rows, "c", txs, projects);
    expect(again.transactions).toEqual([]);
    expect(again.projects).toEqual([]);
    expect(again.unchanged).toBe(5);
  });

  it("détecte seulement les nouveautés : intérêts du mois complétés, nouveau dépôt, remboursement total", async () => {
    const first = await load();
    const { txs, projects } = apply(planBricksImport(first, "c", [], []));
    const later = await load([...FILE, ["r3", "28/03/2026", "Revenus reversés", "Validée", "Résidence & Co", "loan", 1, null], ["d3", "01/04/2026", "Crédit par carte", "Validée", null, null, 50, null], ["c2", "02/04/2026", "Remboursement de capital", "Validée", "Résidence & Co", "loan", 400, null]]);
    const plan = planBricksImport(later, "c", txs, projects);
    expect(plan.transactions.map((t) => [t.externalId, t.action])).toEqual([["bricks:d3", "nouveau"], ["bricks:interets:2026-03", "modifie"]]);
    expect(plan.transactions[1]).toMatchObject({ amount: 11.85, id: expect.any(String) });
    expect(plan.projects).toMatchObject([{ action: "modifie", repaidCapital: 500, status: "rembourse", statusDate: "2026-04-02" }]);
  });

  it("une opération annulée après coup est retirée", async () => {
    const { txs, projects } = apply(planBricksImport(await load(), "c", [], []));
    const rows = await load(FILE.map((r) => (r[0] === "d1" ? [...r.slice(0, 3), "Annulée", ...r.slice(4)] : r)));
    expect(planBricksImport(rows, "c", txs, projects).transactions.map((t) => [t.externalId, t.action])).toEqual([["bricks:d1", "retire"]]);
  });

  it("saisies manuelles : projet rattaché par son nom, dépôt reconnu, intérêts du mois signalés en conflit", async () => {
    const rows = await load();
    const manualProject: CrowdProject = { id: "m", accountId: "c", name: "Résidence & Co", amount: 500, rate: 0.1, startDate: "2026-01-05", termMonths: 24, repayment: "in_fine", status: "defaut", statusDate: "2026-03-01", repaidCapital: 100, expectedRecovery: null, inAllocation: null, comment: "note" };
    const tx = (o: Partial<Transaction>): Transaction => ({ id: "x", date: "2026-01-02", type: "versement", accountId: "c", assetId: null, counterAccountId: null, amount: 1000, quantity: null, fee: null, comment: "", ...o });
    const plan = planBricksImport(rows, "c", [tx({}), tx({ id: "y", date: "2026-03-31", type: "interets", amount: 9 })], [manualProject]);
    expect(plan.transactions.find((t) => t.externalId === "bricks:d1")).toBeUndefined();
    expect(plan.transactions.find((t) => t.externalId === "bricks:interets:2026-03")).toMatchObject({ action: "conflit" });
    // Le statut « en défaut » posé à la main est conservé, le projet n'est pas dupliqué.
    expect(plan.projects).toEqual([]);
  });

  it("un type d'opération inconnu est signalé, pas deviné", async () => {
    const plan = planBricksImport(await load([...FILE, ["z", "01/04/2026", "Virement sortant", "Validée", null, null, -10, null]]), "c", [], []);
    expect(plan.unknownTypes).toEqual(["Virement sortant"]);
  });
});
