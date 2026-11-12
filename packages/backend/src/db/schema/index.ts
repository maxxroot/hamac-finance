/**
 * Schéma de la base, une table par domaine dans `schema/<domaine>.ts`. Toute modification se fait là, puis :
 *   pnpm --filter @hamac/backend db:generate
 * qui produit la migration SQL et l'embarque dans migrations.generated.ts.
 *
 * Conventions : identifiants texte (UUID), montants en CENTIMES entiers (*_cents),
 * dates « AAAA-MM-JJ » et mois « AAAA-MM » en texte (les calculs travaillent sur ces chaînes).
 */

export * from "./system";
export * from "./accounts";
export * from "./journal";
export * from "./assets";
export * from "./investments";
export * from "./realestate";
export * from "./loans";
export * from "./other-assets";
export * from "./planning";
