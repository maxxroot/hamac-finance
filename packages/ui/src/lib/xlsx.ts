/**
 * Lecture minimale d'un classeur .xlsx (une archive zip de fichiers XML), sans dépendance.
 * Le fichier vient de l'utilisateur : tailles plafonnées pour écarter une archive piégée.
 */
const MAX_ENTRY = 64 * 1024 * 1024;

export type XlsxCell = string | number | null;
export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
}

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);

async function inflate(data: Uint8Array, size: number): Promise<Uint8Array> {
  const Stream = (globalThis as unknown as { DecompressionStream: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  const source = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(data);
      c.close();
    },
  });
  const reader = source.pipeThrough(new Stream("deflate-raw")).getReader();
  const out = new Uint8Array(size);
  let at = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (at + value.length > size) throw new Error("Fichier xlsx invalide.");
    out.set(value, at);
    at += value.length;
  }
  return out.subarray(0, at);
}

async function readZip(bytes: Uint8Array): Promise<Map<string, () => Promise<string>>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && u32(view, end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Ce fichier n'est pas un classeur xlsx.");
  const count = u16(view, end + 10);
  let at = u32(view, end + 16);
  const files = new Map<string, () => Promise<string>>();
  const text = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (u32(view, at) !== 0x02014b50) throw new Error("Fichier xlsx invalide.");
    const method = u16(view, at + 10);
    const compressed = u32(view, at + 20);
    const size = u32(view, at + 24);
    const nameLen = u16(view, at + 28);
    const extra = u16(view, at + 30);
    const comment = u16(view, at + 32);
    const local = u32(view, at + 42);
    const name = text.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    if (size > MAX_ENTRY) throw new Error("Fichier xlsx trop volumineux.");
    files.set(name, async () => {
      const start = local + 30 + u16(view, local + 26) + u16(view, local + 28);
      const raw = bytes.subarray(start, start + compressed);
      if (method === 0) return text.decode(raw);
      if (method !== 8) throw new Error("Compression xlsx non prise en charge.");
      return text.decode(await inflate(raw, size));
    });
    at += 46 + nameLen + extra + comment;
  }
  return files;
}

const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_m, e: string) => {
    const k = e.toLowerCase();
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    if (k === "amp") return "&";
    return String.fromCodePoint(k.startsWith("#x") ? Number.parseInt(k.slice(2), 16) : Number.parseInt(k.slice(1), 10));
  });

const attr = (s: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1] ?? null;
const textOf = (xml: string) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));

function columnIndex(ref: string): number {
  let n = 0;
  for (const c of /^[A-Z]+/.exec(ref)?.[0] ?? "A") n = n * 26 + c.charCodeAt(0) - 64;
  return n - 1;
}

function parseSheet(xml: string, shared: readonly string[]): XlsxCell[][] {
  const rows: XlsxCell[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: XlsxCell[] = [];
    for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = c[1]!;
      const body = c[2] ?? "";
      const index = columnIndex(attr(head, "r") ?? "A");
      const type = attr(head, "t");
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: XlsxCell = null;
      if (type === "inlineStr") value = textOf(body);
      else if (v != null) value = type === "s" ? (shared[Number(v)] ?? "") : type === "str" ? unescapeXml(v) : Number(v);
      while (cells.length < index) cells.push(null);
      cells[index] = value;
    }
    rows.push(cells);
  }
  return rows;
}

export async function readXlsx(bytes: Uint8Array): Promise<XlsxSheet[]> {
  const files = await readZip(bytes);
  const read = async (name: string) => (await files.get(name)?.()) ?? null;
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("Ce fichier n'est pas un classeur xlsx.");
  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml ? [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!)) : [];
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id"), attr(m[0], "Target")]));
  const sheets: XlsxSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attr(m[0], "r:id"));
    if (!target) continue;
    const xml = await read(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
    if (xml != null) sheets.push({ name: unescapeXml(attr(m[0], "name") ?? ""), rows: parseSheet(xml, shared) });
  }
  return sheets;
}
