import qrcode from "qrcode-generator";

/** Marge blanche imposée par la norme QR, en modules. */
const QUIET_ZONE = 4;

/**
 * Dessin du QR code, calculé dans le navigateur : la clé ne quitte jamais Hamac.
 * Les modules noirs contigus d'une ligne sont fusionnés pour alléger le tracé.
 */
export function qrDrawing(text: string): { size: number; path: string } {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const count = qr.getModuleCount();
  let path = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; ) {
      if (!qr.isDark(row, col)) {
        col++;
        continue;
      }
      let end = col;
      while (end < count && qr.isDark(row, end)) end++;
      path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h${end - col}v1h${col - end}z`;
      col = end;
    }
  }
  return { size: count + 2 * QUIET_ZONE, path };
}
