import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ALLOWED_ASSETS,
  ASSET_KIND_LABELS,
  Schedule,
  TX_LABELS,
  buildImport,
  detectFormat,
  findHeaderRow,
  guessRoles,
  linesFromCsv,
  parseCsv,
  parseOfx,
  parseQif,
  type AssetKind,
  type CsvRole,
  type ImportProposal,
  type StatementFormat,
  type StatementLine,
  type TxType,
} from "@hamac/core";
import { Amount } from "@/shared/components/Amount";
import { Field, FormGrid, Modal, Select } from "@/shared/components/form";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Badge, Button } from "@/shared/components/ui";
import { pickTextFile } from "@/shared/lib/files";
import { formatDate, formatQty, todayIso } from "@/shared/lib/numbers";
import { useSetSetting, useSetting } from "@/shared/lib/queries";
import { useMutate, useWorkspaceIndex } from "@/shared/lib/workspace";

const ROLES: Array<[CsvRole, string]> = [
  ["", "Ignorer"],
  ["date", "Date"],
  ["amount", "Montant (signé)"],
  ["debit", "Débit"],
  ["credit", "Crédit"],
  ["label", "Libellé / commentaire"],
  ["type", "Type d'opération"],
  ["quantity", "Quantité"],
  ["isin", "ISIN"],
  ["asset", "Titre (nom)"],
  ["fee", "Frais"],
];

const FORMAT_LABELS: Record<StatementFormat, string> = { csv: "CSV", ofx: "OFX", qif: "QIF" };
const PREVIEW_LIMIT = 300;

/** Réglages retenus d'un import à l'autre, par format de fichier ou compte OFX. */
type Remembered = Record<string, { roles?: CsvRole[]; accountId?: string; defaultType?: TxType | "auto" }>;

interface LoadedFile {
  name: string;
  format: StatementFormat;
  headers: string[];
  rows: string[][];
  /** Lignes déjà lues (OFX, QIF) ; le CSV dépend du rôle choisi pour chaque colonne. */
  lines: StatementLine[] | null;
  memoryKey: string | null;
}

function statusBadge(p: ImportProposal) {
  switch (p.status) {
    case "ok":
      return <Badge tone="positive">Nouveau</Badge>;
    case "doublon":
      return <Badge>Déjà au journal</Badge>;
    case "programme":
      return <span title="Ce versement correspond à celui programmé ce mois-là : Hamac le compte déjà."><Badge>Déjà programmé</Badge></span>;
    case "erreur":
      return <span title={p.errors.join(" ")} className="text-xs text-warning">⚠ {p.errors[0]}</span>;
  }
}

export function StatementImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const idx = useWorkspaceIndex();
  const bulk = useMutate("transactions.bulkCreate");
  const createAsset = useMutate("assets.upsert", { success: "Titre créé" });
  const memory = useSetting<Remembered>("import.formats", {});
  const saveMemory = useSetSetting("import.formats");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [roles, setRoles] = useState<CsvRole[]>([]);
  const [accountId, setAccountId] = useState("");
  const [defaultType, setDefaultType] = useState<TxType | "auto">("auto");
  const [toggled, setToggled] = useState<Map<number, boolean>>(new Map());
  const [assetOverrides, setAssetOverrides] = useState<Map<string, string>>(new Map());
  const [newKinds, setNewKinds] = useState<Map<string, AssetKind>>(new Map());
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const load = async () => {
    const f = await pickTextFile(".csv,.txt,.ofx,.qfx,.qif,text/csv");
    if (!f) return;
    const format = detectFormat(f.content, f.name);
    let next: LoadedFile;
    let guessed: CsvRole[] = [];
    if (format === "csv") {
      const all = parseCsv(f.content);
      const h = findHeaderRow(all);
      const headers = all[h] ?? [];
      guessed = guessRoles(headers);
      next = { name: f.name, format, headers, rows: all.slice(h + 1), lines: null, memoryKey: `csv:${headers.join("|").toLowerCase()}` };
    } else if (format === "ofx") {
      const { lines, accountRef } = parseOfx(f.content);
      next = { name: f.name, format, headers: [], rows: [], lines, memoryKey: accountRef ? `ofx:${accountRef}` : null };
    } else {
      next = { name: f.name, format, headers: [], rows: [], lines: parseQif(f.content), memoryKey: null };
    }
    const known = next.memoryKey ? memory.value[next.memoryKey] : undefined;
    setFile(next);
    setRoles(known?.roles?.length === next.headers.length ? known.roles : guessed);
    setDefaultType(known?.defaultType ?? "auto");
    setToggled(new Map());
    setAssetOverrides(new Map());
    setResult(null);
    const remembered = known?.accountId && idx?.accountById.get(known.accountId)?.archived === false ? known.accountId : "";
    setAccountId(remembered || accountId || idx?.activeAccounts[0]?.id || "");
  };

  const proposals = useMemo(() => {
    const account = idx?.accountById.get(accountId);
    if (!file || !idx || !account) return [];
    const lines = file.lines ?? linesFromCsv(file.rows, roles);
    const { params } = idx.ws;
    const schedule = new Schedule(idx.ws.plans, idx.ws.skips, params.profile.startMonth, params.profile.contributionDay);
    return buildImport({ lines, account, accounts: idx.accountById, assets: idx.ws.assets, existing: idx.ws.transactions, schedule, today: todayIso(), defaultType, assetOverrides });
  }, [file, roles, accountId, defaultType, assetOverrides, idx]);

  const isIncluded = (p: ImportProposal, i: number) => p.status !== "erreur" && (toggled.get(i) ?? p.status === "ok");
  const selected = proposals.filter((p, i) => isIncluded(p, i));
  const count = (s: ImportProposal["status"]) => proposals.filter((p) => p.status === s).length;
  const unknown = [...new Map(proposals.filter((p) => p.unknownAsset).map((p) => [p.unknownAsset!.key, p.unknownAsset!])).values()];
  const account = idx?.accountById.get(accountId);
  const creatableKinds = account ? ALLOWED_ASSETS[account.kind].filter((k) => k !== "obligation") : [];

  const close = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  const submit = () =>
    bulk.mutate(
      { items: selected.map((p) => p.tx) },
      {
        onSuccess: (r) => {
          const out = r as { created: number; errors: unknown[] };
          setResult({ created: out.created, skipped: proposals.length - out.created });
          if (file?.memoryKey) saveMemory.mutate({ ...memory.value, [file.memoryKey]: { roles: file.format === "csv" ? roles : undefined, accountId, defaultType } });
        },
      },
    );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Importer un relevé"
      width="max-w-5xl"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Fermer
          </Button>
          {file && !result && (
            <Button variant="primary" disabled={!selected.length || bulk.isPending} onClick={submit}>
              Importer {selected.length} opération{selected.length > 1 ? "s" : ""}
            </Button>
          )}
        </>
      }
    >
      {!file ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <FileUp size={28} className="text-fg-faint" />
          <p className="max-w-lg text-sm text-fg-muted">
            Exportez vos opérations depuis le site de votre banque ou courtier, au format CSV, OFX ou QIF. Vous vérifierez l'aperçu avant l'import : les opérations déjà présentes sont repérées et ne sont pas importées deux fois.
          </p>
          <Button variant="primary" onClick={load}>
            Choisir un fichier
          </Button>
        </div>
      ) : result ? (
        <div className="py-10 text-center">
          <p className="text-lg font-medium">{result.created} opération(s) importée(s).</p>
          {result.skipped > 0 && <p className="mt-1 text-sm text-fg-muted">{result.skipped} ligne(s) non importée(s).</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <FormGrid cols={3}>
            <Field label={`Fichier ${FORMAT_LABELS[file.format]}`}>{() => <div className="truncate pt-2 text-sm">{file.name}</div>}</Field>
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

          {file.format === "csv" && (
            <div>
              <p className="mb-2 text-xs text-fg-muted">À quoi correspond chaque colonne ? Votre choix est retenu pour les prochains fichiers de ce format.</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {file.headers.map((h, i) => (
                  <div key={i} className="w-40 shrink-0">
                    <div className="mb-1 truncate text-xs text-fg-faint" title={h}>
                      {h || `Colonne ${i + 1}`}
                    </div>
                    <Select value={roles[i] ?? ""} onChange={(e) => setRoles((r) => r.map((x, j) => (j === i ? (e.target.value as CsvRole) : x === e.target.value ? "" : x)))}>
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
          )}

          {unknown.length > 0 && (
            <div className="rounded-lg border border-warning/40 p-3">
              <p className="mb-2 text-sm font-medium">Titres non reconnus</p>
              <div className="space-y-2">
                {unknown.map((u) => (
                  <div key={u.key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate" title={u.key}>
                      {u.name}
                      {u.isin && u.isin !== u.name ? <span className="ml-2 font-mono text-xs text-fg-faint">{u.isin}</span> : null}
                    </span>
                    <Select
                      aria-label={`Associer ${u.name} à un titre existant`}
                      className="h-8 w-52 text-xs"
                      value={assetOverrides.get(u.key) ?? ""}
                      onChange={(e) =>
                        setAssetOverrides((m) => {
                          const next = new Map(m);
                          if (e.target.value) next.set(u.key, e.target.value);
                          else next.delete(u.key);
                          return next;
                        })
                      }
                    >
                      <option value="">Associer à un titre…</option>
                      {idx?.activeAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                    <span className="text-xs text-fg-faint">ou</span>
                    <Select aria-label={`Type de ${u.name}`} className="h-8 w-36 text-xs" value={newKinds.get(u.key) ?? creatableKinds[0] ?? "etf"} onChange={(e) => setNewKinds((m) => new Map(m).set(u.key, e.target.value as AssetKind))}>
                      {creatableKinds.map((k) => (
                        <option key={k} value={k}>
                          {ASSET_KIND_LABELS[k]}
                        </option>
                      ))}
                    </Select>
                    <Button
                      className="h-8 text-xs"
                      disabled={createAsset.isPending || !creatableKinds.length}
                      onClick={() => {
                        const kind = newKinds.get(u.key) ?? creatableKinds[0]!;
                        createAsset.mutate({ kind, name: u.name, isin: u.isin, priceSource: u.isin && kind !== "scpi" ? "auto" : "manuel" });
                      }}
                    >
                      Créer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            <Table>
              <thead>
                <tr>
                  <Th />
                  <Th>Date</Th>
                  <Th>Opération</Th>
                  <Th>Titre</Th>
                  <Th align="right">Montant</Th>
                  <Th align="right">Quantité</Th>
                  <Th>Libellé</Th>
                  <Th>État</Th>
                </tr>
              </thead>
              <tbody>
                {proposals.slice(0, PREVIEW_LIMIT).map((p, i) => (
                  <Tr key={i} className={isIncluded(p, i) ? undefined : "opacity-60"}>
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Importer la ligne ${i + 1}`}
                        className="size-4 accent-[var(--color-accent)]"
                        disabled={p.status === "erreur"}
                        checked={isIncluded(p, i)}
                        onChange={(e) => setToggled((m) => new Map(m).set(i, e.target.checked))}
                      />
                    </Td>
                    <Td className="num">{p.tx.date ? formatDate(p.tx.date) : "?"}</Td>
                    <Td>{TX_LABELS[p.tx.type]}</Td>
                    <Td className="max-w-40 truncate">{p.assetName ?? ""}</Td>
                    <Td align="right">
                      <Amount value={p.signedAmount} signed />
                    </Td>
                    <Td align="right">{formatQty(p.tx.quantity)}</Td>
                    <Td className="max-w-56 truncate text-fg-muted">{p.tx.comment}</Td>
                    <Td>{statusBadge(p)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
          <p className="text-xs text-fg-faint">
            {count("ok")} nouvelle(s) · {count("doublon")} déjà au journal · {count("programme")} déjà comptée(s) par un versement programmé · {count("erreur")} à compléter
            {proposals.length > PREVIEW_LIMIT ? ` · aperçu limité aux ${PREVIEW_LIMIT} premières lignes` : ""}. Un versement programmé d'un montant différent de celui du relevé n'est pas repéré : vérifiez-le.
          </p>
        </div>
      )}
    </Modal>
  );
}
