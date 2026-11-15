import { guessAssetKind, parseAmount, parseDate, guessType } from "./csv";
import { ALLOWED_TYPES, monthOf, TX_NEEDS_ASSET, validateTransaction, type Account, type Asset, type AssetKind, type Schedule, type Transaction, type TxType } from "../model";
import { daysBetween } from "../base";

/**
 * Import de relevés de banque ou de courtier : CSV, OFX (banque et titres) et QIF sont ramenés
 * à des lignes communes, puis comparées au journal avant l'import.
 */

export type StatementFormat = "csv" | "ofx" | "qif";

export interface StatementLine {
  date: string | null;
  /** Montant signé : positif quand l'argent arrive sur le compte. */
  amount: number | null;
  label: string;
  /** Nature indiquée par le fichier (colonne type, code OFX ou action QIF). */
  typeHint: string;
  quantity: number | null;
  isin: string | null;
  assetName: string | null;
  fee: number | null;
  /** Type de titre indiqué par le fichier (colonne de classe d'actifs), pour créer un titre inconnu. */
  assetKind?: AssetKind | null;
  /** Type imposé par l'appelant (un assistant qui a lu le document) : ni deviné ni corrigé d'après le signe. */
  type?: TxType | null;
  /** Titre imposé par l'appelant : l'emporte sur la recherche par ISIN ou par nom. */
  assetId?: string | null;
}

const ISIN = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/;

export function detectFormat(text: string, fileName = ""): StatementFormat {
  const name = fileName.toLowerCase();
  const head = text.slice(0, 2000);
  if (/\.(ofx|qfx)$/.test(name) || /<OFX>|OFXHEADER/i.test(head)) return "ofx";
  if (/\.qif$/.test(name) || /^[ \t]*!Type:/im.test(head)) return "qif";
  return "csv";
}

// ——— OFX ———

const leaf = (block: string, tag: string): string | null => {
  const m = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? decodeEntities(m[1]!.trim()) : null;
};
const blocks = (text: string, tag: string): string[] => [...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]!);
const decodeEntities = (s: string) => s.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&amp;/gi, "&");

function ofxDate(s: string | null): string | null {
  const m = s ? /^(\d{4})(\d{2})(\d{2})/.exec(s) : null;
  return m ? parseDate(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

const OFX_TYPE_HINTS: Record<string, string> = { INT: "intérêts", DIV: "dividende", FEE: "frais", SRVCHG: "frais" };

export function parseOfx(text: string): { lines: StatementLine[]; accountRef: string | null } {
  const securities = new Map<string, string>();
  for (const info of blocks(text, "SECINFO")) {
    const id = leaf(info, "UNIQUEID");
    const name = leaf(info, "SECNAME");
    if (id && name) securities.set(id, name);
  }
  const lines: StatementLine[] = [];
  // Mouvements d'espèces (relevé bancaire, ou compte espèces d'un relevé de titres).
  for (const t of blocks(text, "STMTTRN")) {
    const name = leaf(t, "NAME") ?? "";
    const memo = leaf(t, "MEMO") ?? "";
    const label = name && memo && !memo.includes(name) && !name.includes(memo) ? `${name} ${memo}` : memo.length > name.length ? memo : name;
    lines.push({ date: ofxDate(leaf(t, "DTPOSTED")), amount: parseAmount(leaf(t, "TRNAMT") ?? ""), label, typeHint: OFX_TYPE_HINTS[(leaf(t, "TRNTYPE") ?? "").toUpperCase()] ?? "", quantity: null, isin: null, assetName: null, fee: null });
  }
  // Opérations sur titres.
  const trades: Array<[string, string]> = ["BUYSTOCK", "BUYMF", "BUYOTHER", "BUYDEBT"].map((t) => [t, "achat"] as [string, string]);
  trades.push(...["SELLSTOCK", "SELLMF", "SELLOTHER", "SELLDEBT"].map((t) => [t, "vente"] as [string, string]), ["INCOME", ""]);
  for (const [tag, hint] of trades) {
    for (const t of blocks(text, tag)) {
      const id = leaf(t, "UNIQUEID");
      const income = (leaf(t, "INCOMETYPE") ?? "").toUpperCase();
      const units = parseAmount(leaf(t, "UNITS") ?? "");
      const commission = parseAmount(leaf(t, "COMMISSION") ?? "");
      lines.push({
        date: ofxDate(leaf(t, "DTTRADE")),
        amount: parseAmount(leaf(t, "TOTAL") ?? ""),
        label: leaf(t, "MEMO") ?? (id ? (securities.get(id) ?? id) : ""),
        typeHint: hint || (income === "DIV" ? "dividende" : income === "INTEREST" ? "intérêts" : ""),
        quantity: units == null ? null : Math.abs(units),
        isin: id && ISIN.test(id) ? id : null,
        assetName: id ? (securities.get(id) ?? null) : null,
        fee: commission == null ? null : Math.abs(commission),
      });
    }
  }
  const account = leaf(text, "ACCTID");
  // Quatre derniers caractères : assez pour reconnaître le compte, sans conserver son numéro.
  return { lines, accountRef: account ? account.slice(-4) : null };
}

// ——— QIF ———

export function parseQif(text: string): StatementLine[] {
  const lines: StatementLine[] = [];
  let cur: Record<string, string> = {};
  const flush = () => {
    if (!Object.keys(cur).length) return;
    const action = (cur.N ?? "").toLowerCase();
    const amount = parseAmount(cur.U ?? cur.T ?? "");
    const investment = /^(buy|sell|div|intinc|miscexp)/.test(action);
    const quantity = parseAmount(cur.Q ?? "");
    const fee = parseAmount(cur.O ?? "");
    const hint = action.startsWith("buy") ? "achat" : action.startsWith("sell") ? "vente" : action.startsWith("div") ? "dividende" : action.startsWith("intinc") ? "intérêts" : action.startsWith("miscexp") ? "frais" : "";
    // Dans un relevé de titres QIF, le montant n'est pas signé : un achat ou des frais font sortir l'argent.
    const signed = amount != null && investment && (hint === "achat" || hint === "frais") ? -Math.abs(amount) : amount;
    lines.push({ date: parseDate((cur.D ?? "").replace(/'/g, "/").replace(/\s/g, "")), amount: signed, label: [cur.P, cur.M].filter(Boolean).join(" "), typeHint: hint, quantity: quantity == null ? null : Math.abs(quantity), isin: ISIN.exec(cur.Y ?? "")?.[0] ?? null, assetName: cur.Y ?? null, fee: fee == null ? null : Math.abs(fee) });
    cur = {};
  };
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("!")) continue;
    if (line === "^") flush();
    else cur[line[0]!] = line.slice(1).trim();
  }
  flush();
  return lines;
}

// ——— CSV : rôle des colonnes ———

export const CSV_ROLES = ["date", "amount", "debit", "credit", "label", "type", "quantity", "isin", "asset", "assetKind", "fee"] as const;
export type CsvRole = (typeof CSV_ROLES)[number] | "";

/** Ligne d'en-tête : la dernière ligne sans date juste avant les données (certains relevés ont un préambule). */
export function findHeaderRow(rows: readonly string[][]): number {
  const hasDate = (r: readonly string[]) => r.some((c) => parseDate(c) != null);
  for (let i = 0; i < Math.min(rows.length - 1, 30); i++) {
    if (!hasDate(rows[i]!) && hasDate(rows[i + 1]!) && rows[i]!.length === rows[i + 1]!.length && rows[i]!.length > 1) return i;
  }
  return 0;
}

/** Rôle d'une colonne d'après son en-tête ; `weak` : un rôle approché, qui cède la place à une colonne qui le porte en propre. */
function guessRole(header: string): { role: CsvRole; weak: boolean } {
  const s = header.toLowerCase().trim();
  const found = (role: CsvRole, weak = false) => ({ role, weak });
  // Une colonne qui parle du compte ou de la contrepartie ne décrit pas l'opération (« account_type », « counterparty_name »).
  if (/account|compte|counterparty|contrepartie|b[ée]n[ée]ficiaire/.test(s)) return found("");
  if (/date/.test(s)) return found("date", s !== "date");
  if (/isin/.test(s)) return found("isin");
  if (/^(symbol|symbole|ticker)$/.test(s)) return found("isin", true);
  if (/asset.?class|asset.?type|classe|type de (titre|valeur|produit)|security.?type|instrument.?type/.test(s)) return found("assetKind");
  if (/d[ée]bit/.test(s)) return found("debit");
  if (/cr[ée]dit/.test(s)) return found("credit");
  if (/montant|amount|valeur nette|\bnet\b/.test(s)) return found("amount", /original|origine|devise/.test(s));
  if (/quantit|qty|nombre|parts|shares|units/.test(s)) return found("quantity");
  if (/titre|instrument|valeur$|produit|^(name|nom)$|security|asset.?name/.test(s)) return found("asset");
  if (/frais|commission|fee/.test(s)) return found("fee");
  if (/type|op[ée]ration|operation|sens/.test(s)) return found("type", s !== "type");
  if (/libell|description|label|d[ée]tail/.test(s)) return found("label");
  return found("");
}

/**
 * Un rôle par colonne, sans doublon. Une colonne qui porte le rôle en propre passe avant une colonne approchée
 * (« date » avant « datetime »), et la date d'opération avant la date de valeur.
 */
export function guessRoles(headers: readonly string[]): CsvRole[] {
  const guesses = headers.map((h, i) => ({ h, i, ...guessRole(h) }));
  const order = guesses.sort((a, b) => Number(a.weak) - Number(b.weak) || Number(/valeur/i.test(a.h)) - Number(/valeur/i.test(b.h)) || a.i - b.i);
  const taken = new Set<CsvRole>();
  const out: CsvRole[] = headers.map(() => "");
  for (const { i, role } of order) {
    if (role && !taken.has(role)) {
      taken.add(role);
      out[i] = role;
    }
  }
  return out;
}

/**
 * Correspondance mémorisée pour ce fichier, complétée : une colonne laissée de côté reçoit le rôle deviné
 * si la correspondance n'a encore aucune colonne pour ce rôle (rôle reconnu depuis, comme le type de titre).
 */
export function completeRoles(remembered: readonly CsvRole[], guessed: readonly CsvRole[]): CsvRole[] {
  const used = new Set(remembered.filter(Boolean));
  return remembered.map((r, i) => {
    const g = guessed[i] ?? "";
    if (r || !g || used.has(g)) return r;
    used.add(g);
    return g;
  });
}

export function linesFromCsv(rows: readonly string[][], roles: readonly CsvRole[]): StatementLine[] {
  const col = (r: CsvRole) => roles.indexOf(r);
  return rows.map((row) => {
    const get = (r: CsvRole) => (col(r) >= 0 ? (row[col(r)] ?? "") : "");
    const debit = parseAmount(get("debit"));
    const credit = parseAmount(get("credit"));
    const amount = parseAmount(get("amount")) ?? (debit ? -Math.abs(debit) : credit ? Math.abs(credit) : debit ?? credit);
    const quantity = parseAmount(get("quantity"));
    const fee = parseAmount(get("fee"));
    const name = get("asset").trim();
    return { date: parseDate(get("date")), amount, label: get("label"), typeHint: get("type"), quantity: quantity == null ? null : Math.abs(quantity), isin: ISIN.exec(get("isin").toUpperCase())?.[0] ?? ISIN.exec(name.toUpperCase())?.[0] ?? null, assetName: name || null, fee: fee == null ? null : Math.abs(fee), assetKind: guessAssetKind(get("assetKind")) };
  });
}

// ——— Comparaison avec le journal ———

export type ImportStatus = "ok" | "doublon" | "programme" | "erreur";

export interface ImportProposal {
  tx: Omit<Transaction, "id">;
  status: ImportStatus;
  errors: string[];
  /** Montant du relevé, avec son signe. */
  signedAmount: number;
  /** Titre cité par la ligne mais inconnu de Hamac. */
  unknownAsset: { key: string; isin: string | null; name: string; kind: AssetKind | null } | null;
  assetName: string | null;
}

export interface BuildImportInput {
  lines: readonly StatementLine[];
  account: Account;
  accounts: ReadonlyMap<string, Account>;
  assets: readonly Asset[];
  existing: readonly Transaction[];
  schedule: Schedule;
  today: string;
  defaultType?: TxType | "auto";
  /** Titres inconnus associés à la main : clé de `unknownAsset` → identifiant du titre. */
  assetOverrides?: ReadonlyMap<string, string>;
}

const OUTFLOW_TYPES: readonly TxType[] = ["retrait", "frais", "impots", "achat"];
const INFLOW_TYPES: readonly TxType[] = ["versement", "interets", "dividende", "vente"];

/**
 * Un libellé peut contredire le sens de l'argent (« REMBOURSEMENT FRAIS », intérêts débiteurs).
 * Seul un relevé signé permet de trancher : beaucoup d'exports de courtiers donnent des montants tous positifs.
 */
function matchSign(type: TxType, raw: number): TxType {
  if (raw > 0 && OUTFLOW_TYPES.includes(type)) return type === "frais" || type === "impots" ? "correction" : "versement";
  if (raw < 0 && INFLOW_TYPES.includes(type)) return type === "interets" || type === "dividende" ? "frais" : "retrait";
  return type;
}

/** Écart admis entre la date d'un transfert au journal et son passage sur le relevé. */
const TRANSFER_DAYS = 3;

const dupKey = (t: Pick<Transaction, "date" | "type" | "amount" | "assetId">) => `${t.date}|${t.type}|${Math.round(t.amount * 100)}|${t.assetId ?? ""}`;

export function buildImport(input: BuildImportInput): ImportProposal[] {
  const { lines, account, accounts, assets, existing, schedule, today, defaultType = "auto", assetOverrides } = input;
  const active = assets.filter((a) => !a.archived);
  const assetMap = new Map(assets.map((a) => [a.id, a]));
  const find = (l: StatementLine): Asset | undefined => {
    const isin = l.isin ?? ISIN.exec(l.label.toUpperCase())?.[0] ?? null;
    if (isin) {
      const hit = active.find((a) => a.isin === isin);
      if (hit) return hit;
    }
    const key = (l.assetName ?? "").trim().toUpperCase();
    if (!key) return undefined;
    return active.find((a) => a.name.toUpperCase() === key) ?? (key.length > 3 ? active.find((a) => a.name.toUpperCase().includes(key)) : undefined);
  };
  // Doublons : chaque opération déjà au journal n'en excuse qu'une ; deux lignes identiques d'un relevé restent deux opérations.
  const already = new Map<string, number>();
  for (const t of existing) if (t.accountId === account.id) already.set(dupKey(t), (already.get(dupKey(t)) ?? 0) + 1);
  const programmedUsed = new Set<string>();
  // Un transfert n'a qu'une ligne au journal : on le cherche des deux côtés, avec son sens.
  const transfers = existing.filter((t) => t.type === "transfert" && (t.accountId === account.id || t.counterAccountId === account.id));
  const matchTransfer = (date: string, raw: number): boolean => {
    const incoming = raw > 0;
    const i = transfers.findIndex((t) => (incoming ? t.counterAccountId === account.id : t.accountId === account.id) && Math.abs(t.amount - Math.abs(raw)) < 0.005 && Math.abs(daysBetween(t.date, date)) <= TRANSFER_DAYS);
    if (i < 0) return false;
    transfers.splice(i, 1);
    return true;
  };
  // Le sens ne se lit que si le relevé contient des débits.
  const signedFile = lines.some((l) => (l.amount ?? 0) < 0);

  return lines.map((l): ImportProposal => {
    const raw = l.amount ?? 0;
    // Un type imposé n'est pas corrigé : s'il ne convient pas au compte, la validation le dit.
    let type: TxType = l.type ?? (defaultType === "auto" ? guessType(`${l.typeHint} ${l.label}`, raw) : defaultType);
    if (!l.type && defaultType === "auto" && signedFile) type = matchSign(type, raw);
    if (!l.type && !ALLOWED_TYPES[account.kind].includes(type)) type = raw < 0 ? "retrait" : "versement";
    const isin = l.isin ?? ISIN.exec(l.label.toUpperCase())?.[0] ?? null;
    const unknownKey = isin ?? l.assetName?.trim() ?? null;
    const usesAsset = TX_NEEDS_ASSET.includes(type) || type === "dividende" || type === "interets";
    const override = unknownKey ? assetOverrides?.get(unknownKey) : undefined;
    const imposed = l.assetId ? (assetMap.get(l.assetId) ?? null) : undefined;
    const asset = usesAsset ? (imposed === undefined ? ((override ? assetMap.get(override) : undefined) ?? find(l)) : (imposed ?? undefined)) : undefined;
    const tx: Omit<Transaction, "id"> = {
      date: l.date ?? "",
      type,
      accountId: account.id,
      assetId: asset?.id ?? null,
      counterAccountId: null,
      amount: type === "correction" ? raw : Math.abs(raw),
      quantity: TX_NEEDS_ASSET.includes(type) ? l.quantity : null,
      fee: type === "achat" || type === "vente" ? l.fee : null,
      comment: l.label.slice(0, 500),
    };
    const unknownAsset = usesAsset && !asset && unknownKey ? { key: unknownKey, isin, name: l.assetName?.trim() || unknownKey, kind: l.assetKind ?? null } : null;
    const errors = [...(l.date ? [] : ["Date illisible"]), ...(l.amount == null ? ["Montant illisible"] : []), ...(imposed === null ? ["Titre introuvable."] : []), ...validateTransaction(tx, accounts, assetMap).map((e) => e.message)];
    const base = { tx, errors, signedAmount: raw, unknownAsset, assetName: asset?.name ?? unknownAsset?.name ?? null };
    if (errors.length) return { ...base, status: "erreur" };
    if ((type === "versement" || type === "retrait") && matchTransfer(tx.date, raw)) return { ...base, status: "doublon" };
    const key = dupKey(tx);
    const left = already.get(key) ?? 0;
    if (left > 0) {
      already.set(key, left - 1);
      return { ...base, status: "doublon" };
    }
    // Un versement égal au montant programmé ce mois-là est déjà compté par le calendrier.
    if (type === "versement") {
      const month = monthOf(tx.date);
      const planned = schedule.amount(account.id, month);
      if (planned > 0 && Math.abs(planned - tx.amount) < 0.005 && schedule.isPaid(month, today) && !programmedUsed.has(month)) {
        programmedUsed.add(month);
        return { ...base, status: "programme" };
      }
    }
    return { ...base, status: "ok" };
  });
}
