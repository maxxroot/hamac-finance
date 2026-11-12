/** Petit classeur xlsx réel (zip compressé, chaînes en ligne), pour les tests. Fonctionne sous Node et dans un navigateur. */
export async function makeXlsx(rows: Array<Array<string | number | null>>, sheet = "transactions wallet"): Promise<Uint8Array> {
  const letter = (i: number) => String.fromCharCode(65 + i);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const body = rows
    .map((r, y) => `<row r="${y + 1}">${r.map((v, x) => (v == null ? "" : typeof v === "number" ? `<c r="${letter(x)}${y + 1}"><v>${v}</v></c>` : `<c r="${letter(x)}${y + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`)).join("")}</row>`)
    .join("");
  const files: Record<string, string> = {
    "xl/workbook.xml": `<workbook xmlns:r="x"><sheets><sheet name="${sheet}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${body}</sheetData></worksheet>`,
  };
  const encoder = new TextEncoder();
  const Compress = (globalThis as unknown as { CompressionStream: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = encoder.encode(text);
    const data = new Uint8Array(await new Response(new ReadableStream<Uint8Array>({ start: (c) => (c.enqueue(raw), c.close()) }).pipeThrough(new Compress("deflate-raw"))).arrayBuffer());
    const n = encoder.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, 8, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, n.length, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(10, 8, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, n.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = centrals.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...centrals, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
