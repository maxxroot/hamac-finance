import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import type { Account, Asset, Transaction } from "./domain";
import { Schedule } from "./schedule";
import { buildImport, detectFormat, findHeaderRow, guessRoles, linesFromCsv, parseOfx, parseQif, type StatementLine } from "./statementImport";

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

const account = (id: string, kind: Account["kind"]): Account => ({ id, kind, livretType: null, name: id, institutionId: null, openedOn: null, depositCeiling: null, rate: null, role: "", beneficiaryClause: false, entryFeeRate: null, managementFeeRate: null, monthsToInvest: null, inAllocation: null, sortOrder: 0, archived: false });
const asset: Asset = { id: "ai", kind: "action", name: "Air Liquide", isin: "FR0000120073", symbol: null, priceSource: "manuel", priceProvider: null, priceUrl: null, pricePath: null, classId: null, inAllocation: null, manualPrice: null, manualPriceDate: null, targetWeight: null, ter: null, couponRate: null, maturityDate: null, couponFrequency: null, issuer: null, bondKind: null, archived: false };
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
    expect(unknown.unknownAsset).toEqual({ key: "LU1681043599", isin: "LU1681043599", name: "AMUNDI" });
  });

  it("titre associé à la main", () => {
    const r = buildImport({ lines: [line({ amount: -10, typeHint: "achat", quantity: 1, assetName: "ETF X" })], account: pea, accounts: new Map([[pea.id, pea]]), assets: [asset], existing: [], schedule: new Schedule([], [], "2020-01", 5), today: "2026-11-08", assetOverrides: new Map([["ETF X", "ai"]]) });
    expect(r[0]).toMatchObject({ status: "ok", assetName: "Air Liquide" });
  });

  it("date ou montant illisible : erreur", () => {
    expect(run([line({ date: null })])[0]!.errors).toContain("Date illisible");
    expect(run([line({ amount: null })])[0]!.errors).toContain("Montant illisible");
  });
});
