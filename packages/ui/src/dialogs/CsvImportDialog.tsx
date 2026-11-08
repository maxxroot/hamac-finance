import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { ALLOWED_TYPES, TX_LABELS, TX_NEEDS_ASSET, guessType, parseAmount, parseCsv, parseDate, validateTransaction, type Transaction, type TxType } from "@hamac/core";
import { Amount } from "@/components/Amount";
import { Field, FormGrid, Modal, Select } from "@/components/form";
import { Table, Td, Th, Tr } from "@/components/table";
import { Badge, Button } from "@/components/ui";
import { pickTextFile } from "@/lib/files";
import { formatDate, formatQty } from "@/lib/numbers";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

type Role = "date" | "amount" | "label" | "type" | "quantity" | "asset" | "fee" | "";
const ROLES: Array<[Role, string]> = [
  ["", "Ignorer"],
  ["date", "Date"],
  ["amount", "Montant"],
  ["label", "Libellé / commentaire"],
  ["type", "Type d'opération"],
  ["quantity", "Quantité"],
  ["asset", "Titre (ISIN ou nom)"],
  ["fee", "Frais"],
];

/** Devine le rôle d'une colonne d'après son en-tête. */
function guessRole(h: string): Role {
  const s = h.toLowerCase();
  if (/date/.test(s)) return "date";
  if (/montant|amount|débit|crédit|valeur nette|net/.test(s)) return "amount";
  if (/quantit|qty|nombre|parts/.test(s)) return "quantity";
  if (/isin|titre|instrument|valeur$|produit/.test(s)) return "asset";
  if (/frais|commission|fee/.test(s)) return "fee";
  if (/type|opération|operation|sens/.test(s)) return "type";
  if (/libell|description|label|détail/.test(s)) return "label";
  return "";
}

export function CsvImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const idx = useWorkspaceIndex();
  const bulk = useMutate("transactions.bulkCreate");
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [accountId, setAccountId] = useState("");
  const [defaultType, setDefaultType] = useState<TxType | "auto">("auto");
  const [result, setResult] = useState<{ created: number; errors: number } | null>(null);

  const load = async () => {
    const f = await pickTextFile(".csv,.txt,text/csv");
    if (!f) return;
    const rows = parseCsv(f.content);
    setFile({ name: f.name, rows });
    setRoles((rows[0] ?? []).map(guessRole));
    setResult(null);
    if (!accountId && idx?.activeAccounts[0]) setAccountId(idx.activeAccounts[0].id);
  };

  const parsed = useMemo(() => {
    if (!file || !idx) return [];
    const col = (r: Role) => roles.indexOf(r);
    const account = idx.accountById.get(accountId);
    return file.rows.slice(1).map((row) => {
      const get = (r: Role) => (col(r) >= 0 ? (row[col(r)] ?? "") : "");
      const raw = parseAmount(get("amount"));
      const label = get("label");
      const typeText = get("type");
      let type: TxType = defaultType === "auto" ? guessType(`${typeText} ${label}`, raw ?? 0) : defaultType;
      if (account && !ALLOWED_TYPES[account.kind].includes(type)) type = (raw ?? 0) < 0 ? "retrait" : "versement";
      const assetKey = get("asset").trim().toUpperCase();
      const asset = assetKey ? idx.activeAssets.find((a) => a.isin === assetKey || a.name.toUpperCase() === assetKey || (assetKey.length > 3 && a.name.toUpperCase().includes(assetKey))) : undefined;
      const quantity = parseAmount(get("quantity"));
      const fee = parseAmount(get("fee"));
      const tx: Omit<Transaction, "id"> = {
        date: parseDate(get("date")) ?? "",
        type,
        accountId,
        assetId: TX_NEEDS_ASSET.includes(type) || type === "dividende" || type === "interets" ? (asset?.id ?? null) : null,
        counterAccountId: null,
        amount: raw == null ? 0 : Math.abs(raw),
        quantity: TX_NEEDS_ASSET.includes(type) && quantity != null ? Math.abs(quantity) : null,
        fee: (type === "achat" || type === "vente") && fee != null ? Math.abs(fee) : null,
        comment: label,
      };
      const errors = [...(tx.date ? [] : ["Date illisible"]), ...validateTransaction(tx, idx.accountById, idx.assetById).map((e) => e.message)];
      return { tx, errors, asset: asset?.name ?? (assetKey || null) };
    });
  }, [file, roles, accountId, defaultType, idx]);

  const valid = parsed.filter((p) => !p.errors.length);
  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Importer un relevé CSV"
      width="max-w-5xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Fermer
          </Button>
          {file && !result && (
            <Button
              variant="primary"
              disabled={!valid.length || bulk.isPending}
              onClick={() => bulk.mutate({ items: valid.map((v) => v.tx) }, { onSuccess: (r) => setResult({ created: (r as { created: number }).created, errors: parsed.length - valid.length }) })}
            >
              Importer {valid.length} opération{valid.length > 1 ? "s" : ""}
            </Button>
          )}
        </>
      }
    >
      {!file ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <FileUp size={28} className="text-fg-faint" />
          <p className="max-w-lg text-sm text-fg-muted">
            Exportez l'historique des opérations depuis le site de votre banque ou courtier (format CSV), puis choisissez le fichier. Vous indiquerez à quoi correspond chaque colonne et vérifierez l'aperçu avant
            l'import.
          </p>
          <Button variant="primary" onClick={load}>
            Choisir un fichier CSV
          </Button>
        </div>
      ) : result ? (
        <div className="py-10 text-center">
          <p className="text-lg font-medium">{result.created} opération(s) importée(s).</p>
          {result.errors > 0 && <p className="mt-1 text-sm text-fg-muted">{result.errors} ligne(s) ignorée(s) car incomplètes : à saisir à la main si besoin.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <FormGrid cols={3}>
            <Field label="Fichier">{() => <div className="truncate pt-2 text-sm">{file.name}</div>}</Field>
            <Field label="Compte concerné">
              {(id) => (
                <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {idx?.activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Type d'opération">
              {(id) => (
                <Select id={id} value={defaultType} onChange={(e) => setDefaultType(e.target.value as TxType | "auto")}>
                  <option value="auto">Deviner d'après le libellé et le signe</option>
                  {Object.entries(TX_LABELS)
                    .filter(([k]) => k !== "transfert")
                    .map(([k, l]) => (
                      <option key={k} value={k}>
                        Toujours : {l}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </FormGrid>

          <div>
            <p className="mb-2 text-xs text-fg-muted">À quoi correspond chaque colonne ?</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(file.rows[0] ?? []).map((h, i) => (
                <div key={i} className="w-40 shrink-0">
                  <div className="mb-1 truncate text-xs text-fg-faint" title={h}>
                    {h || `Colonne ${i + 1}`}
                  </div>
                  <Select value={roles[i] ?? ""} onChange={(e) => setRoles((r) => r.map((x, j) => (j === i ? (e.target.value as Role) : x === e.target.value ? "" : x)))}>
                    {ROLES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Opération</Th>
                  <Th>Titre</Th>
                  <Th align="right">Montant</Th>
                  <Th align="right">Quantité</Th>
                  <Th>Libellé</Th>
                  <Th>Contrôle</Th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 200).map((p, i) => (
                  <Tr key={i} className={p.errors.length ? "opacity-60" : undefined}>
                    <Td className="num">{p.tx.date ? formatDate(p.tx.date) : "?"}</Td>
                    <Td>{TX_LABELS[p.tx.type]}</Td>
                    <Td className="max-w-40 truncate">{p.asset ?? ""}</Td>
                    <Td align="right">
                      <Amount value={p.tx.amount} />
                    </Td>
                    <Td align="right">{formatQty(p.tx.quantity)}</Td>
                    <Td className="max-w-56 truncate text-fg-muted">{p.tx.comment}</Td>
                    <Td>{p.errors.length ? <span title={p.errors.join(" ")} className="text-xs text-warning">⚠ {p.errors[0]}</span> : <Badge tone="positive">OK</Badge>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-xs text-fg-faint">
            {valid.length} ligne(s) prête(s), {parsed.length - valid.length} à compléter. Les titres sont reconnus par ISIN ou par nom parmi ceux de Paramètres › Actifs : ajoutez-les d'abord si besoin.
          </p>
        </div>
      )}
    </Modal>
  );
}
