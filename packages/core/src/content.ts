/** Contenus par défaut (génériques : le projet est public, chacun personnalise ensuite). */

export const DEFAULT_CHECKLIST: Array<{ label: string; note?: string }> = [
  { label: "Récupérer le relevé de carrière et l'estimation de retraite sur info-retraite.fr" },
  { label: "Vérifier les trimestres pour enfants et les années de parent au foyer (AVPF)" },
  { label: "Vérifier les trimestres validés pendant les périodes de chômage indemnisé ou d'emploi saisonnier" },
  { label: "Remplir le LEP (si éligible), puis ouvrir le LDDS" },
  { label: "Choisir le courtier et ouvrir le PEA et le compte-titres", note: "Voir Établissements" },
  { label: "Choisir et ouvrir l'assurance-vie en ligne, rédiger la clause bénéficiaire", note: "Voir Établissements" },
  { label: "Acheter les premières lignes de l'échelle d'obligations", note: "Voir Obligations" },
  { label: "Investir l'apport de départ du PEA en plusieurs fois" },
  { label: "Mettre en place les virements automatiques" },
  { label: "Garder ouverte une éventuelle ancienne assurance-vie (ancienneté fiscale)" },
];
