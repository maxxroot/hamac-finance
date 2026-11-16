import { z } from "zod";
import { ASSET_KIND_LABELS, ASSET_KINDS, BOND_KINDS, PRICE_SOURCES, SOVEREIGN_COUNTRIES, type Asset } from "@hamac/core";
import { ToolError, type Call } from "../engine";
import { AFTER_CONSENT, found, isin, isoDate, merge, rate, READ_ONLY, WRITE } from "./fields";
import type { ToolRegistrar } from "./registrar";

/** Titres et supports : recherche, création, réglages, cours saisis à la main. */

export function registerAssetTools(tool: ToolRegistrar, call: Call, canWrite: boolean): void {
  tool(
    "list_assets",
    {
      title: "Titres et supports",
      description: "Liste les titres et supports connus de Hamac (ETF, actions, fonds, obligations, crypto, SCPI, fonds euros) avec leur identifiant, leur ISIN, leur source de cours et leur dernier cours saisi. À consulter avant un import, pour rattacher chaque ligne au bon titre.",
      inputSchema: {
        query: z.string().max(80).optional().describe("Filtre sur le nom, l'ISIN ou le symbole."),
        includeArchived: z.boolean().default(false),
      },
      annotations: READ_ONLY,
    },
    async ({ query, includeArchived }) => {
      const ws = await call("workspace.load");
      const q = query?.trim().toUpperCase();
      return ws.assets
        .filter((a) => (includeArchived || !a.archived) && (!q || a.name.toUpperCase().includes(q) || a.isin === q || a.symbol?.toUpperCase() === q))
        .map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          kindLabel: ASSET_KIND_LABELS[a.kind],
          isin: a.isin,
          symbol: a.symbol,
          priceSource: a.priceSource,
          manualPrice: a.manualPrice,
          manualPriceDate: a.manualPriceDate,
          ...(a.kind === "obligation" ? { couponRate: a.couponRate, maturityDate: a.maturityDate, issuer: a.issuer, bondKind: a.bondKind, issuerCountry: a.issuerCountry } : {}),
          archived: a.archived,
        }));
    },
  );

  if (!canWrite) return;

  tool(
    "save_asset",
    {
      title: "Créer ou modifier un titre",
      description: `Sans id : ajoute un titre absent de list_assets (kind et name requis) ; si l'ISIN est déjà connu, renvoie le titre existant sans rien créer. Les cours sont récupérés automatiquement, sauf pour une SCPI ou une action sans symbole (cours saisi avec set_price). Une obligation demande couponRate et maturityDate ; un fonds euros n'a pas de cours (une part vaut 1 €). Avec id : modifie seulement les champs donnés ; archived: true le retire des listes sans toucher aux opérations. ${AFTER_CONSENT}`,
      inputSchema: {
        id: z.string().optional().describe("Identifiant de list_assets, pour une modification."),
        kind: z.enum(ASSET_KINDS).optional().describe("etc : or, argent ou autre matière première physique cotée (classe Matières premières), à ne pas saisir en etf."),
        name: z.string().trim().min(1).max(120).optional(),
        isin: isin.nullable().optional(),
        symbol: z.string().trim().max(40).nullable().optional().describe("Symbole de cotation, si connu (ex. CW8 pour un ETF, BTC pour une crypto)."),
        priceSource: z.enum(PRICE_SOURCES).optional().describe("auto : cours téléchargés ; manuel : saisis avec set_price ; modele : obligation valorisée jusqu'à l'échéance."),
        ter: rate.nullable().optional().describe("Frais courants annuels du fonds."),
        couponRate: rate.nullable().optional().describe("Obligation : taux du coupon."),
        maturityDate: isoDate.nullable().optional().describe("Obligation : échéance."),
        couponFrequency: z.number().int().min(1).max(12).nullable().optional().describe("Obligation : coupons par an."),
        nextCouponDate: isoDate.nullable().optional(),
        issuer: z.string().trim().max(80).nullable().optional(),
        bondKind: z.enum(BOND_KINDS).nullable().optional().describe("Obligation : etat (obligation d'un État : OAT, OLO, Bund…) ou entreprise."),
        issuerCountry: z
          .enum(SOVEREIGN_COUNTRIES)
          .nullable()
          .optional()
          .describe("Obligation d'État : pays de l'État émetteur, code ISO à deux lettres (FR, BE, DE…). Sans valeur : le pays de l'ISIN, sinon FR. Ignoré pour une obligation d'entreprise."),
        inAllocation: z.boolean().nullable().optional().describe("Compté dans l'allocation cible ; null = selon le type."),
        archived: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    async ({ id, ...fields }) => {
      const ws = await call("workspace.load");
      const existing: Asset | undefined = id ? found(ws.assets, id, "Titre", "list_assets") : undefined;
      if (!existing) {
        if (!fields.kind || !fields.name) throw new ToolError("Pour créer un titre, donnez au moins kind et name.");
        const known = fields.isin ? ws.assets.find((a) => a.isin === fields.isin) : undefined;
        if (known) return { created: false, id: known.id, name: known.name, kind: known.kind, isin: known.isin };
        // Même choix de source que la fenêtre de création de titre de l'interface.
        fields.priceSource ??= fields.kind === "scpi" || (fields.kind === "action" && !fields.symbol) ? "manuel" : "auto";
      }
      const saved = await call("assets.upsert", merge(existing, fields) as never);
      return { created: !existing, id: saved.id, name: saved.name, kind: saved.kind, isin: saved.isin, priceSource: saved.priceSource, archived: saved.archived };
    },
  );

  tool(
    "set_price",
    {
      title: "Saisir un cours",
      description: `Enregistre le cours d'un titre à une date (SCPI, action non cotée, fonds sans cours en ligne, ou correction). Il prime sur les cours téléchargés pour cette date. ${AFTER_CONSENT}`,
      inputSchema: { assetId: z.string(), date: isoDate, price: z.number().positive().describe("Prix d'une part, en euros.") },
      annotations: WRITE,
    },
    async (input) => {
      await call("prices.setManual", input);
      return { ok: true, ...input };
    },
  );
}
