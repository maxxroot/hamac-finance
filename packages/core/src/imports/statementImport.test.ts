import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { Schedule, type Account, type Asset, type Transaction } from "../model";
import { buildImport, completeRoles, detectFormat, findHeaderRow, guessRoles, linesFromCsv, parseOfx, parseQif, type StatementLine } from "./statementImport";

const OFX_BANQUE = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR
<BANKACCTFROM><BANKID>30004<ACCTID>00012345678<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[+1:CET]<TRNAMT>-12,50<FITID>a1<NAME>RETRAIT DAB</STMTTRN>
<STMTTRN><TRNTYPE>INT<DTPOSTED>20261231<TRNAMT>40.10<FITID>a2<NAME>INTERETS &amp; PRIMES<MEMO>ANNEE 2026</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

const OFX_TITRES = `<?xml version="1.0"?><?OFX OFXHEADER="200"?><OFX><INVSTMTMSGSRSV1><INVSTMTTRNRS><INVSTMTRS>
<INVACCTFROM><BROKERID>x</BROKERID><ACCTID>ABC9876</ACCTID></INVACCTFROM><INVTRANLIST>
<BUYSTOCK><INVBUY><INVTRAN><FITID>b1</FITID><DTTRADE>20261010</DTTRADE></INVTRAN><SECID><UNIQUEID>FR0000120073</UNIQUEID><UNIQUEIDTYPE>ISIN</UNIQUEIDTYPE></SECID><UNITS>3</UNITS><UNITPRICE>180</UNITPRICE><COMMISSION>1.5</COMMISSION><TOTAL>-541.5</TOTAL></INVBUY><BUYTYPE>BUY</BUYTYPE></BUYSTOCK>
<SELLMF><INVSELL><INVTRAN><DTTRADE>20261011</DTTRADE></INVTRAN><SECID><UNIQUEID>LU1681043599</UNIQUEID></SECID><UNITS>-2</UNITS><TOTAL>1000</TOTAL></INVSELL></SELLMF>
<INCOME><INVTRAN><DTTRADE>20261012</DTTRADE></INVTRAN><SECID><UNIQUEID>FR0000120073</UNIQUEID></SECID><INCOMETYPE>DIV</INCOMETYPE><TOTAL>9</TOTAL></INCOME>
</INVTRANLIST></INVSTMTRS></INVSTMTTRNRS></INVSTMTMSGSRSV1>
<SECLISTMSGSRSV1><SECLIST><STOCKINFO><SECINFO><SECID><UNIQUEID>FR0000120073</UNIQUEID></SECID><SECNAME>AIR LIQUIDE</SECNAME></SECINFO></STOCKINFO></SECLIST></SECLISTMSGSRSV1></OFX>`;

const account = (id: string, kind: Account["kind"]): Account => ({ id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, share: 1, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false });
const asset: Asset = { id: "ai", kind: "action", name: "Air Liquide", isin: "FR0000120073", symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, nextCouponDate: null, issuer: null, bondKind: null, issuerCountry: null, archived: false };
const line = (o: Partial<StatementLine>): StatementLine => ({ date: "2026-10-05", amount: 100, label: "", typeHint: "", quantity: null, isin: null, assetName: null, fee: null, ...o });
const pea = account("pea", "pea");
const run = (lines: StatementLine[], existing: Transaction[] = [], schedule = new Schedule([], [], "2020-01", 5)) => buildImport({ lines, account: pea, accounts: new Map([[pea.id, pea]]), assets: [asset], existing, schedule, today: "2026-11-08" });

describe("lecture des relevés", () => {
  it("reconnaît le format", () => {
    expect(detectFormat(OFX_BANQUE)).toBe("ofx");
    expect(detectFormat("!Type:Bank\nD01/02/2026", "x.txt")).toBe("qif");
    expect(detectFormat("Date;Montant", "releve.csv")).toBe("csv");
  });

  it("OFX bancaire en SGML : dates, montants à virgule, entités, numéro de compte tronqué", () => {
    const { lines, accountRef } = parseOfx(OFX_BANQUE);
    expect(accountRef).toBe("5678");
    expect(lines[0]).toMatchObject({ date: "2026-11-05", amount: -12.5, label: "RETRAIT DAB" });
    expect(lines[1]).toMatchObject({ date: "2026-12-31", amount: 40.1, label: "INTERETS & PRIMES ANNEE 2026", typeHint: "intérêts" });
  });

  it("OFX titres : achats, ventes et revenus avec ISIN, quantité et frais", () => {
    const { lines } = parseOfx(OFX_TITRES);
    expect(lines.find((l) => l.typeHint === "achat")).toMatchObject({ date: "2026-10-10", amount: -541.5, quantity: 3, fee: 1.5, isin: "FR0000120073", assetName: "AIR LIQUIDE" });
    expect(lines.find((l) => l.typeHint === "vente")).toMatchObject({ amount: 1000, quantity: 2, isin: "LU1681043599" });
    expect(lines.find((l) => l.typeHint === "dividende")).toMatchObject({ amount: 9 });
  });

  it("QIF bancaire et titres", () => {
    const bank = parseQif("!Type:Bank\nD31/10'26\nT-1 234,50\nPLOYER\nMoctobre\n^\n");
    expect(bank[0]).toMatchObject({ date: "2026-10-31", amount: -1234.5, label: "LOYER octobre" });
    const inv = parseQif("!Type:Invst\nD01/10/2026\nNBuy\nYFR0000120073\nQ2\nU300\nO1\n^\n");
    expect(inv[0]).toMatchObject({ amount: -300, quantity: 2, fee: 1, isin: "FR0000120073", typeHint: "achat" });
  });

  it("CSV avec préambule, colonnes débit et crédit, date de valeur ignorée", () => {
    const rows = parseCsv("Relevé du compte\nExporté le 08/11/2026\n\nDate de valeur;Date opération;Libellé;Débit;Crédit\n03/11/2026;02/11/2026;VIR SALAIRE;;1 500,00\n04/11/2026;03/11/2026;CB;12,30;\n");
    const h = findHeaderRow(rows);
    expect(rows[h]![2]).toBe("Libellé");
    const roles = guessRoles(rows[h]!);
    expect(roles).toEqual(["", "date", "label", "debit", "credit"]);
    const lines = linesFromCsv(rows.slice(h + 1), roles);
    expect(lines[0]).toMatchObject({ date: "2026-11-02", amount: 1500 });
    expect(lines[1]).toMatchObject({ date: "2026-11-03", amount: -12.3 });
  });

  it("CSV Trade Republic : colonnes propres avant les approchées, nom et classe du titre, compte-titres", () => {
    const csv = [
      `"datetime","date","account_type","category","type","asset_class","name","symbol","shares","price","amount","fee","tax","currency","original_amount","description","counterparty_name"`,
      `"2025-01-06T11:41:12Z","2025-01-06","DEFAULT","CASH","DIVIDEND","STOCK","TotalEnergies","FR0000120271","0.75075","","0.44","","","EUR","","Cash Dividend for ISIN FR0000120271",""`,
      `"2025-01-29T12:04:36Z","2025-01-29","DEFAULT","TRADING","SELL","STOCK","TotalEnergies","FR0000120271","-0.75075","55.46","41.64","-1.00","","EUR","","Sell trade FR0000120271 TOTALENERGIES SE",""`,
      `"2025-02-01T07:02:10Z","2025-02-01","DEFAULT","CASH","INTEREST_PAYMENT","","","","","","0.17","","-0.05","EUR","","Interest payment Booking",""`,
    ].join("\n");
    const rows = parseCsv(csv);
    const roles = guessRoles(rows[0]!);
    // « date » plutôt que « datetime », « type » plutôt que « account_type », « amount » plutôt que « original_amount ».
    expect(roles).toEqual(["", "date", "", "", "type", "assetKind", "asset", "isin", "quantity", "", "amount", "fee", "", "", "", "label", ""]);
    const lines = linesFromCsv(rows.slice(1), roles);
    expect(lines[1]).toMatchObject({ date: "2025-01-29", amount: 41.64, quantity: 0.75075, isin: "FR0000120271", assetName: "TotalEnergies", assetKind: "action", fee: 1 });
    const cto = account("cto", "cto");
    const r = buildImport({ lines, account: cto, accounts: new Map([[cto.id, cto]]), assets: [], existing: [], schedule: new Schedule([], [], "2020-01", 5), today: "2026-11-08" });
    expect(r.map((p) => p.tx.type)).toEqual(["dividende", "vente", "interets"]);
    expect(r[1]!.unknownAsset).toEqual({ key: "FR0000120271", isin: "FR0000120271", name: "TotalEnergies", kind: "action" });
    // Les intérêts des espèces ne portent sur aucun titre.
    expect(r[2]).toMatchObject({ status: "ok", unknownAsset: null });
  });

  it("correspondance mémorisée : complétée par les rôles qu'elle n'a pas, sans toucher aux choix faits", () => {
    expect(completeRoles(["date", "", "", "amount", ""], ["date", "type", "asset", "amount", "assetKind"])).toEqual(["date", "type", "asset", "amount", "assetKind"]);
    // Un rôle déjà donné à une autre colonne n'est pas repris.
    expect(completeRoles(["date", "label", ""], ["date", "", "label"])).toEqual(["date", "label", ""]);
  });

  it("garde le bon séparateur quand les montants ont des virgules", () => {
    expect(parseCsv("Date;Montant\n01/02/2026;1,50\n02/02/2026;2,50")[1]).toEqual(["01/02/2026", "1,50"]);
    expect(parseCsv("Date,Label,Amount\n2026-01-01,a,1.5\n2026-01-02,b,2")[1]).toEqual(["2026-01-01", "a", "1.5"]);
  });
});

describe("comparaison avec le journal", () => {
  const existing: Transaction = { id: "t", date: "2026-10-05", type: "versement", accountId: "pea", assetId: null, counterAccountId: null, amount: 100, quantity: null, fee: null, comment: "" };

  it("ligne déjà au journal : doublon, une seule fois", () => {
    const r = run([line({}), line({})], [existing]);
    expect(r.map((p) => p.status)).toEqual(["doublon", "ok"]);
  });

  it("un doublon d'un autre compte ne compte pas", () => {
    expect(run([line({})], [{ ...existing, accountId: "autre" }])[0]!.status).toBe("ok");
  });

  it("versement égal au programmé d'un mois passé : déjà compté, une fois par mois", () => {
    const schedule = new Schedule([{ id: "p", accountId: "pea", fromMonth: "2026-01", amount: 100, comment: "" }], [], "2026-01", 5);
    expect(run([line({}), line({ date: "2026-10-20" }), line({ amount: 80 })], [], schedule).map((p) => p.status)).toEqual(["programme", "ok", "ok"]);
  });

  it("achat : titre reconnu par ISIN ; titre inconnu signalé et bloquant", () => {
    const ok = run([line({ amount: -541.5, typeHint: "achat", quantity: 3, isin: "FR0000120073", fee: 1.5 })])[0]!;
    expect(ok).toMatchObject({ status: "ok", assetName: "Air Liquide" });
    expect(ok.tx).toMatchObject({ assetId: "ai", amount: 541.5, quantity: 3, fee: 1.5 });
    const unknown = run([line({ amount: -10, typeHint: "achat", quantity: 1, isin: "LU1681043599", assetName: "AMUNDI" })])[0]!;
    expect(unknown.status).toBe("erreur");
    expect(unknown.unknownAsset).toEqual({ key: "LU1681043599", isin: "LU1681043599", name: "AMUNDI", kind: null });
  });

  it("titre associé à la main", () => {
    const r = buildImport({ lines: [line({ amount: -10, typeHint: "achat", quantity: 1, assetName: "ETF X" })], account: pea, accounts: new Map([[pea.id, pea]]), assets: [asset], existing: [], schedule: new Schedule([], [], "2020-01", 5), today: "2026-11-08", assetOverrides: new Map([["ETF X", "ai"]]) });
    expect(r[0]).toMatchObject({ status: "ok", assetName: "Air Liquide" });
  });

  it("relevé signé : le sens de l'argent l'emporte sur le libellé", () => {
    const r = run([line({ amount: 30, label: "REMBOURSEMENT FRAIS" }), line({ amount: -4, typeHint: "intérêts" }), line({ amount: -20, label: "CB VENTE PRIVEE" })]);
    expect(r.map((p) => p.tx.type)).toEqual(["correction", "frais", "retrait"]);
    expect(r[0]!.tx.amount).toBe(30);
    expect(r[1]!.signedAmount).toBe(-4);
  });

  it("relevé non signé : un achat ou des frais en montant positif gardent leur type", () => {
    const r = run([line({ amount: 300, typeHint: "achat", quantity: 2, isin: "FR0000120073" }), line({ amount: 5, label: "FRAIS DE TENUE" })]);
    expect(r.map((p) => p.tx.type)).toEqual(["achat", "frais"]);
  });

  it("transfert déjà au journal : reconnu dans le bon sens, à quelques jours près, une seule fois", () => {
    const transfert: Transaction = { ...existing, id: "tr", date: "2026-10-05", type: "transfert", accountId: "livret", counterAccountId: "pea", amount: 500 };
    expect(run([line({ amount: 500, date: "2026-10-07" })], [transfert])[0]!.status).toBe("doublon");
    expect(run([line({ amount: 500, date: "2026-10-20" })], [transfert])[0]!.status).toBe("ok");
    expect(run([line({ amount: 500 }), line({ amount: 500 })], [transfert]).map((p) => p.status)).toEqual(["doublon", "ok"]);
    const sortant: Transaction = { ...transfert, accountId: "pea", counterAccountId: "livret" };
    expect(run([line({ amount: -500, label: "VIREMENT" })], [sortant])[0]!.status).toBe("doublon");
    expect(run([line({ amount: 500 })], [sortant])[0]!.status).toBe("ok");
  });

  it("type et titre imposés par l'appelant : ni devinés ni corrigés d'après le signe", () => {
    const [imposed] = run([line({ amount: -541.5, label: "ORDRE 123", type: "achat", assetId: "ai", quantity: 3, fee: 1.5 })]);
    expect(imposed).toMatchObject({ status: "ok", tx: { type: "achat", assetId: "ai", amount: 541.5, quantity: 3, fee: 1.5 } });
    // Sans type imposé, un montant positif libellé « frais » devient une correction ; imposé, il reste des frais.
    const [fee] = run([line({ amount: 4, label: "FRAIS", type: "frais" }), line({ amount: -1 })]);
    expect(fee.tx.type).toBe("frais");
  });

  it("type imposé non permis sur le compte, ou titre imposé inconnu : erreur", () => {
    const [notAllowed, unknown] = run([line({ type: "arbitrage" }), line({ amount: -100, type: "achat", assetId: "absent", quantity: 1 })]);
    expect(notAllowed.status).toBe("erreur");
    expect(unknown).toMatchObject({ status: "erreur" });
    expect(unknown.errors).toContain("Titre introuvable.");
  });

  it("date ou montant illisible : erreur", () => {
    expect(run([line({ date: null })])[0]!.errors).toContain("Date illisible");
    expect(run([line({ amount: null })])[0]!.errors).toContain("Montant illisible");
  });
});
