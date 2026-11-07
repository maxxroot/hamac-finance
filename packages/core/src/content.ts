/** Contenus par défaut (génériques : le projet est public, chacun personnalise ensuite). */

export const DEFAULT_CHECKLIST: Array<{ label: string; note?: string }> = [
  { label: "Récupérer le relevé de carrière et l'estimation de retraite sur info-retraite.fr" },
  { label: "Vérifier les trimestres pour enfants et les années de parent au foyer (AVPF)" },
  { label: "Vérifier les trimestres validés pendant les périodes de chômage indemnisé ou d'emploi saisonnier" },
  { label: "Remplir le LEP (si éligible), puis ouvrir le LDDS" },
  { label: "Choisir le courtier et ouvrir le PEA et le compte-titres", note: "Voir Choix des plateformes" },
  { label: "Choisir et ouvrir l'assurance-vie en ligne, rédiger la clause bénéficiaire", note: "Voir Choix des plateformes" },
  { label: "Acheter les premières lignes de l'échelle d'obligations", note: "Voir Obligations" },
  { label: "Investir l'apport de départ du PEA en plusieurs fois" },
  { label: "Mettre en place les virements automatiques" },
  { label: "Garder ouverte une éventuelle ancienne assurance-vie (ancienneté fiscale)" },
];

export const COMPARISON_CRITERIA: Record<"assurance_vie" | "courtier", Array<{ key: string; label: string; target: string }>> = {
  assurance_vie: [
    { key: "fraisVersement", label: "Frais sur versements", target: "0 %" },
    { key: "fraisGestion", label: "Frais de gestion annuels (hors fonds euros)", target: "~0,5 %" },
    { key: "tauxFe", label: "Fonds euros : dernier taux", target: "le meilleur sur 5 ans" },
    { key: "moyenneFe", label: "Fonds euros : moyenne 5 ans", target: "le meilleur" },
    { key: "centPourCent", label: "100 % fonds euros possible ?", target: "oui" },
    { key: "bonus", label: "Bonus conditionné à une part de risque ?", target: "non" },
    { key: "etfMonde", label: "ETF monde (ACWI ou World)", target: "oui" },
    { key: "fondsDates", label: "Fonds datés", target: "oui" },
    { key: "programmes", label: "Versements programmés dès", target: "50–100 €" },
    { key: "arbitrages", label: "Arbitrages gratuits", target: "oui" },
    { key: "assureur", label: "Assureur", target: "" },
  ],
  courtier: [
    { key: "fraisPea", label: "Frais par ordre en PEA", target: "faibles en % sur de petits montants" },
    { key: "fraisOat", label: "Frais pour un achat d'environ 1 000 € d'obligations", target: "faibles" },
    { key: "garde", label: "Frais de tenue de compte / garde", target: "aucun" },
    { key: "etfPea", label: "ETF monde éligible PEA", target: "oui" },
    { key: "oat", label: "Obligations accessibles en direct", target: "oui" },
    { key: "programme", label: "Investissement programmé", target: "oui" },
    { key: "service", label: "Service client joignable", target: "oui" },
  ],
};
