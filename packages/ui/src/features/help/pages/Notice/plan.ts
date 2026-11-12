
/** Sommaire : chaque entrée correspond à l'identifiant d'une section ci-dessous. */
export const NOTICE_PLAN: ReadonlyArray<{ part: string; items: ReadonlyArray<[id: string, label: string]> }> = [
  {
    part: "Bien commencer",
    items: [
      ["principe", "Comment fonctionne Hamac"],
      ["demarrage", "La mise en route, étape par étape"],
    ],
  },
  {
    part: "Au fil des mois",
    items: [
      ["journal", "Noter une opération"],
      ["import", "Importer un relevé"],
      ["versements", "Vos virements mensuels"],
      ["calendrier", "Que faire, et quand"],
      ["resultats", "Où lire vos résultats"],
    ],
  },
  {
    part: "Selon ce que vous possédez",
    items: [
      ["livrets", "Livrets et fonds euros"],
      ["etf", "Actions et ETF"],
      ["obligations", "Obligations"],
      ["crypto", "Crypto"],
      ["crowdlending", "Crowdlending"],
      ["immobilier", "Immobilier et SCPI"],
      ["biens", "Or, objets, véhicules, argent prêté"],
      ["credits", "Crédits"],
      ["autres", "PEA-PME, PER, épargne salariale"],
    ],
  },
  {
    part: "Aller plus loin",
    items: [
      ["repartition", "Affiner sa répartition"],
      ["cours", "Les cours de bourse"],
      ["impots", "Impôts et déclaration"],
      ["donnees", "Vos données et sauvegardes"],
      ["securite", "Protéger votre compte"],
      ["lexique", "Les mots à connaître"],
    ],
  },
];
