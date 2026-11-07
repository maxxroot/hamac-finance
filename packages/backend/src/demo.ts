import type { Backend } from "./index";

/**
 * Jeu de données FICTIF pour la démonstration, les captures d'écran et le développement.
 * Activé par HAMAC_DEMO=1 sur une base vide. Aucune donnée réelle.
 */
export async function seedDemo(backend: Backend): Promise<void> {
  const call = async <T = { id: string }>(name: string, input?: unknown): Promise<T> => {
    const res = await backend.dispatch(name, input);
    if (!res.ok) throw new Error(`Démo : ${name} → ${res.error.message}`);
    return res.data as T;
  };

  const ws = await call<{ accounts: unknown[]; params: Record<string, Record<string, unknown>> }>("workspace.load");
  if (ws.accounts.length > 0) return;

  const y = new Date().getFullYear();
  await call("params.update", {
    ...ws.params,
    profile: { ...ws.params.profile, birthYear: 1990, retirementAge: 64, securisationAge: 57, horizonAge: 90, startMonth: `${y - 1}-01` },
    tax: { ...ws.params.tax, tmi: 0.11 },
  });
  await call("workspace.createStarter");
  const { accounts } = await call<{ accounts: Array<{ id: string; name: string }> }>("workspace.load");
  const acc = (name: string) => accounts.find((a) => a.name === name)!.id;
  const [lep, ldds, av, cto, pea, crypto] = ["LEP", "LDDS", "Assurance-vie", "Compte-titres", "PEA", "Crypto"].map(acc);

  await call("accounts.upsert", { id: pea, kind: "pea", name: "PEA", institution: "Courtier en ligne", openedOn: "2021-03-15", role: "Long terme, jamais vendu dans une baisse", monthsToInvest: 12, sortOrder: 6 });
  await call("accounts.upsert", { id: av, kind: "assurance_vie", name: "Assurance-vie", institution: "Assureur en ligne", openedOn: `${y - 1}-01-10`, role: "Amortisseur, capital garanti (fonds euros)", beneficiaryClause: true, sortOrder: 4 });

  const sp = await call("assets.upsert", { kind: "etf", name: "ETF PEA S&P 500", isin: "FR0011871128", priceSource: "auto", symbol: "PSP5.PA", targetWeight: 0.6, ter: 0.0015 });
  const em = await call("assets.upsert", { kind: "etf", name: "ETF PEA MSCI Emerging Markets", isin: "FR0013412020", priceSource: "auto", symbol: "PAEEM.PA", targetWeight: 0.15, ter: 0.002 });
  const eu = await call("assets.upsert", { kind: "etf", name: "ETF Euro Stoxx 50", isin: "FR0007054358", priceSource: "auto", symbol: "MSE.PA", targetWeight: 0.25, ter: 0.002 });
  const oat1 = await call("assets.upsert", { kind: "obligation", name: `OAT 3 % 25/05/${y + 6}`, priceSource: "modele", couponRate: 0.03, maturityDate: `${y + 6}-05-25`, issuer: "République française" });
  const oat2 = await call("assets.upsert", { kind: "obligation", name: `OAT 2,75 % 25/10/${y + 9}`, priceSource: "modele", couponRate: 0.0275, maturityDate: `${y + 9}-10-25`, issuer: "République française" });
  const btc = await call("assets.upsert", { kind: "crypto", name: "Bitcoin", priceSource: "auto", symbol: "bitcoin" });

  const tx = (date: string, type: string, accountId: string, amount: number, extra: Record<string, unknown> = {}) =>
    call("transactions.upsert", { date, type, accountId, amount, ...extra });

  const p = `${y - 1}`;
  await tx(`${p}-01-02`, "apport_initial", lep, 6000, { comment: "Épargne déjà disponible" });
  await tx(`${p}-01-02`, "apport_initial", ldds, 3500);
  await tx(`${p}-01-02`, "apport_initial", pea, 4000, { comment: "PEA ouvert il y a quelques années" });
  await tx(`${p}-01-10`, "apport_initial", av, 2000);
  await tx(`${p}-01-05`, "apport_initial", cto, 3500);
  await tx(`${p}-01-05`, "apport_initial", crypto, 800);
  await tx(`${p}-01-15`, "achat", pea, 2401.2, { assetId: sp.id, quantity: 60, fee: 11.95 });
  await tx(`${p}-01-15`, "achat", pea, 603.0, { assetId: em.id, quantity: 25, fee: 3 });
  await tx(`${p}-01-15`, "achat", pea, 994.9, { assetId: eu.id, quantity: 18, fee: 4.95 });
  await tx(`${p}-01-20`, "achat", cto, 2919.6, { assetId: oat1.id, quantity: 3000, fee: 14.53, comment: "Acheté à 96,84 %" });
  await tx(`${p}-02-03`, "achat", crypto, 800, { assetId: btc.id, quantity: 0.0185 });
  await tx(`${p}-05-25`, "interets", cto, 73.26, { assetId: oat1.id, comment: "Coupon net" });
  await tx(`${p}-07-01`, "achat", pea, 1050, { assetId: sp.id, quantity: 22, fee: 5.22 });
  await tx(`${p}-12-31`, "interets", lep, 180.5);
  await tx(`${p}-12-31`, "interets", ldds, 52.1);
  await tx(`${p}-12-31`, "interets", av, 58.4);
  await tx(`${y}-01-20`, "achat", cto, 2935.5, { assetId: oat2.id, quantity: 3000, fee: 14.6, comment: "Acheté à 97,36 %" });
  await tx(`${y}-02-03`, "achat", pea, 1196.4, { assetId: sp.id, quantity: 25, fee: 5.95 });
  await tx(`${y}-06-02`, "achat", pea, 1203.6, { assetId: eu.id, quantity: 20, fee: 5.99 });
  await tx(`${y}-09-01`, "achat", pea, 256.25, { assetId: em.id, quantity: 10, fee: 1.27 });
  await tx(`${y}-02-10`, "vente", crypto, 312, { assetId: btc.id, quantity: 0.004, fee: 0, comment: "Prise de bénéfices" });
  await tx(`${y}-03-01`, "transfert", ldds, 1000, { counterAccountId: av, comment: "Excédent des livrets vers le fonds euros" });
  await tx(`${y}-05-25`, "interets", cto, 73.26, { assetId: oat1.id, comment: "Coupon net" });

  for (const [accountId, amount] of [
    [lep, 100],
    [pea, 150],
    [cto, 100],
    [av, 80],
  ] as const) {
    await call("plans.set", { accountId, fromMonth: `${p}-01`, amount });
  }
  await call("plans.set", { accountId: pea, fromMonth: `${y}-04`, amount: 200, comment: "Augmentation" });
  await call("skips.upsert", { accountId: av, month: `${p}-08`, amount: 80, comment: "Vacances" });

  for (const [assetId, price] of [
    [sp.id, 47.85],
    [em.id, 27.1],
    [eu.id, 59.4],
    [btc.id, 82000],
  ] as const) {
    await call("prices.setManual", { assetId, date: `${y}-01-01`, price });
  }
  await call("fundRates.set", { accountId: av, year: y - 1, rate: 0.031, comment: "Taux servi net de frais" });
  await call("bondPlans.upsert", { accountId: cto, label: `Échéance vers ${y + 12}`, targetYear: y + 12, nominal: 3000 });
  await call("bondPlans.upsert", { accountId: cto, label: `Échéance vers ${y + 15}`, targetYear: y + 15, nominal: 3000 });
}
