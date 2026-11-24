import { describe, expect, it } from "vitest";
import { isCompleteDateValue } from "./dateTyping";

describe("frappe d'une date", () => {
  it("les années en cours de frappe ne sont pas des dates", () => {
    expect(["0002-05-31", "0020-05-31", "0203-05-31"].map(isCompleteDateValue)).toEqual([false, false, false]);
    expect(isCompleteDateValue("2030-05-31")).toBe(true);
  });
  it("un mois complet ou un champ vidé sont transmis", () => {
    expect(isCompleteDateValue("2030-05")).toBe(true);
    expect(isCompleteDateValue("0203-05")).toBe(false);
    expect(isCompleteDateValue("")).toBe(true);
  });
});
