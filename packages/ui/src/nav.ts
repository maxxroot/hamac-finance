import type { ModuleKey } from "@hamac/core";
import {
  Banknote,
  BookOpen,
  Bitcoin,
  CalendarClock,
  ChartLine,
  ChartPie,
  Gauge,
  HandCoins,
  History,
  House,
  Landmark,
  NotebookPen,
  PiggyBank,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type { ModuleKey };

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Onglet d'origine dans le Google Sheet. */
  sheetTab: string;
  /** Étape du plan V1 où la page devient fonctionnelle. */
  step: number;
  description: string;
  /** Page masquée en gestion de patrimoine (Paramètres › Plan › Usage). */
  retirementOnly?: boolean;
  /** Module qui commande l'affichage de la page dans le menu (Paramètres › Plan › Modules). */
  module?: ModuleKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { path: "/", label: "Tableau de bord", icon: Gauge, sheetTab: "Tableau de bord", step: 4, description: "Patrimoine, projection retraite, alertes et répartition." },
      { path: "/performance", module: "performance", label: "Performance", icon: TrendingUp, sheetTab: "Performance", step: 3, description: "Rendement annualisé (TRI) et plus-values par enveloppe." },
      { path: "/projection", label: "Projection", icon: ChartLine, sheetTab: "Projection", step: 4, description: "Projection année par année jusqu'à la retraite et simulations.", retirementOnly: true },
      { path: "/historique", module: "historique", label: "Historique", icon: History, sheetTab: "Historique", step: 3, description: "Photos mensuelles du patrimoine et leur évolution." },
    ],
  },
  {
    label: "Saisie",
    items: [
      { path: "/journal", label: "Journal", icon: NotebookPen, sheetTab: "Journal", step: 2, description: "Toutes les opérations : versements, achats, ventes, intérêts…" },
      { path: "/versements", label: "Versements", icon: CalendarClock, sheetTab: "Versements", step: 2, description: "Calendrier des versements mensuels programmés." },
    ],
  },
  {
    label: "Enveloppes",
    items: [
      { path: "/enveloppes", label: "Synthèse", icon: ChartPie, sheetTab: "Enveloppe", step: 3, description: "Valeur, versé net et allocation cible de chaque enveloppe." },
      { path: "/livrets", module: "livrets", label: "Livrets", icon: PiggyBank, sheetTab: "Livrets", step: 2, description: "Épargne de précaution : LEP, LDDS, Livret A, plancher et plafond." },
      { path: "/fonds-euros", module: "fondsEuros", label: "Fonds euros", icon: ShieldCheck, sheetTab: "Fonds euros", step: 2, description: "Assurance-vie : valeur, rapprochement et taux servis." },
      { path: "/obligations", module: "obligations", label: "Obligations", icon: Landmark, sheetTab: "OAT", step: 2, description: "Échelle d'OAT et obligations d'entreprise détenues à l'échéance." },
      { path: "/actions", module: "actions", label: "Actions & ETF", icon: ChartLine, sheetTab: "Actions", step: 2, description: "Positions du PEA, PRU, cours et investissement mensuel conseillé." },
      { path: "/immobilier", module: "immobilier", label: "Immobilier", icon: House, sheetTab: "Immobilier", step: 5, description: "Biens immobiliers et SCPI." },
      { path: "/crowdlending", module: "crowdlending", label: "Crowdlending", icon: HandCoins, sheetTab: "Crowdlending", step: 5, description: "Plateformes de prêt et suivi projet par projet." },
      { path: "/crypto", module: "crypto", label: "Crypto", icon: Bitcoin, sheetTab: "Crypto", step: 2, description: "Positions crypto et fiscalité des cessions." },
    ],
  },
  {
    label: "Emprunts",
    items: [{ path: "/credits", module: "credits", label: "Crédits", icon: Banknote, sheetTab: "Crédits", step: 5, description: "Crédits en cours, mensualités et capital restant dû." }],
  },
  {
    label: "Fiscalité",
    items: [
      { path: "/impots", module: "impots", label: "Impôts", icon: Receipt, sheetTab: "Impôts", step: 3, description: "Impôt si tout était retiré aujourd'hui, rendements nets, impôt annuel." },
    ],
  },
  {
    label: "Aide",
    items: [
      { path: "/notice", label: "Notice", icon: BookOpen, sheetTab: "Notice", step: 5, description: "Mode d'emploi de Hamac." },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  path: "/parametres",
  label: "Paramètres",
  icon: Settings,
  sheetTab: "Paramètres",
  step: 5,
  description: "Profil, hypothèses de rendement, allocation cible, fiscalité.",
};

export const ALL_ITEMS: NavItem[] = [...NAV.flatMap((g) => g.items), SETTINGS_ITEM];

