import { describe, expect, it } from "vitest";
import { evaluateExpression, isExpression, readTypedNumber } from "./expression";

describe("calcul saisi dans un champ", () => {
  it("additions et soustractions, virgule ou point", () => {
    expect(evaluateExpression("=120+35,50")).toBe(155.5);
    expect(evaluateExpression("=1 155,50 + 40 - 12.5")).toBe(1183);
    expect(evaluateExpression("= 10 € + 5 €")).toBe(15);
  });

  it("priorité des opérations, parenthèses, signe", () => {
    expect(evaluateExpression("=2+3*4")).toBe(14);
    expect(evaluateExpression("=(2+3)*4")).toBe(20);
    expect(evaluateExpression("=100/4x2")).toBe(50);
    expect(evaluateExpression("=-5+10")).toBe(5);
    expect(evaluateExpression("=100−30")).toBe(70);
  });

  it("calcul incomplet ou impossible : null", () => {
    expect(evaluateExpression("=")).toBeNull();
    expect(evaluateExpression("=120+")).toBeNull();
    expect(evaluateExpression("=(2+3")).toBeNull();
    expect(evaluateExpression("=10/0")).toBeNull();
    expect(evaluateExpression("=abc")).toBeNull();
    expect(evaluateExpression("=alert(1)")).toBeNull();
  });

  it("reconnaît un calcul par le « = » en tête", () => {
    expect(isExpression("=1+1")).toBe(true);
    expect(isExpression(" =1+1")).toBe(true);
    expect(isExpression("1+1")).toBe(false);
  });
});

describe("valeur d'un champ numérique", () => {
  const money = { allowNegative: false, decimals: 2 };
  it("nombre simple, négatif non permis pris en valeur absolue", () => {
    expect(readTypedNumber("1 234,5", money)).toBe(1234.5);
    expect(readTypedNumber("-12", money)).toBe(12);
    expect(readTypedNumber("", money)).toBeNull();
  });
  it("calcul arrondi au centime ; incomplet ou négatif : la valeur précédente reste", () => {
    expect(readTypedNumber("=0,1+0,2", money)).toBe(0.3);
    expect(readTypedNumber("=10/3", money)).toBe(3.33);
    expect(readTypedNumber("=120+", money)).toBeUndefined();
    expect(readTypedNumber("=100-150", money)).toBeUndefined();
    expect(readTypedNumber("=100-150", { allowNegative: true, decimals: 2 })).toBe(-50);
  });
});
