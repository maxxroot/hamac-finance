import type { OtherAsset } from "@hamac/core";
import { ok, byId, entity } from "../common";
import { OtherAssetInput, OtherAssetValueInput } from "./inputs";

/** Autres biens : or, objets, véhicules, parts de société, argent prêté. */

export const otherAssetsProcedures = {
  "otherAssets.upsert": { input: OtherAssetInput, output: entity<OtherAsset>() },
  "otherAssets.delete": { input: byId, output: ok },
  "otherAssetValues.add": { input: OtherAssetValueInput, output: ok },
  "otherAssetValues.delete": { input: byId, output: ok },
} as const;
