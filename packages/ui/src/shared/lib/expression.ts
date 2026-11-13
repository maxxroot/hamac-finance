import { parseNumber } from "./numbers";

/**
 * Calcul saisi dans un champ, comme dans un tableur : « =120+35,50-10 ».
 * Opérations + − × ÷ et parenthèses ; virgule ou point décimal ; espaces, € et % ignorés.
 * Lecture pas à pas, sans `eval`. null si le calcul est incomplet ou impossible (division par zéro).
 */
export function evaluateExpression(input: string): number | null {
  const src = input
    .replace(/^\s*=/, "")
    .replace(/[\s  €%]/g, "")
    .replace(/,/g, ".")
    .replace(/[x×]/gi, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  if (src === "") return null;
  let pos = 0;
  const peek = () => src[pos];

  const number = (): number | null => {
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(pos));
    if (!m) return null;
    pos += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number | null => {
    if (peek() === "-" || peek() === "+") {
      const sign = src[pos++] === "-" ? -1 : 1;
      const v = factor();
      return v == null ? null : sign * v;
    }
    if (peek() === "(") {
      pos++;
      const v = sum();
      if (v == null || peek() !== ")") return null;
      pos++;
      return v;
    }
    return number();
  };
  const product = (): number | null => {
    let v = factor();
    while (v != null && (peek() === "*" || peek() === "/")) {
      const op = src[pos++];
      const r = factor();
      if (r == null || (op === "/" && r === 0)) return null;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  function sum(): number | null {
    let v = product();
    while (v != null && (peek() === "+" || peek() === "-")) {
      const op = src[pos++];
      const r = product();
      if (r == null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }

  const result = sum();
  return result != null && pos === src.length && Number.isFinite(result) ? result : null;
}

/** La saisie est-elle un calcul (« = » en tête) ? */
export function isExpression(input: string): boolean {
  return /^\s*=/.test(input);
}

/**
 * Valeur d'un champ numérique au fil de la frappe : un nombre, ou le résultat d'un calcul arrondi à `decimals`.
 * undefined : calcul en cours ou impossible (ou négatif sans `allowNegative`), la valeur précédente reste.
 * Hors calcul, un nombre négatif non permis est pris en valeur absolue.
 */
export function readTypedNumber(input: string, opts: { allowNegative: boolean; decimals: number }): number | null | undefined {
  if (!isExpression(input)) {
    const n = parseNumber(input);
    return n != null && !opts.allowNegative && n < 0 ? Math.abs(n) : n;
  }
  const r = evaluateExpression(input);
  if (r == null || (!opts.allowNegative && r < 0)) return undefined;
  const k = 10 ** opts.decimals;
  return Math.round(r * k) / k;
}
