import {
  BookOpen,
  Building2,
  Bitcoin,
  CalendarClock,
  ChartLine,
  ChartPie,
  Gauge,
  History,
  Landmark,
  ListChecks,
  NotebookPen,
  PiggyBank,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Onglet d'origine dans le Google Sheet. */
  sheetTab: string;
  /** Étape du plan V1 où la page devient fonctionnelle. */
  step: number;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { path: "/", label: "Tableau de bord", icon: Gauge, sheetTab: "Tableau de bord", step: 4, description: "Patrimoine, revenu retraite projeté, alertes et répartition." },
      { path: "/performance", label: "Performance", icon: TrendingUp, sheetTab: "Performance", step: 3, description: "Rendement annualisé (TRI) et plus-values par enveloppe." },
      { path: "/projection", label: "Projection", icon: ChartLine, sheetTab: "Projection", step: 4, description: "Projection année par année jusqu'à la retraite et simulations." },
      { path: "/historique", label: "Historique", icon: History, sheetTab: "Historique", step: 3, description: "Photos mensuelles du patrimoine et leur évolution." },
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
      { path: "/livrets", label: "Livrets", icon: PiggyBank, sheetTab: "Livrets", step: 2, description: "Épargne de précaution : LEP, LDDS, Livret A, plancher et plafond." },
      { path: "/fonds-euros", label: "Fonds euros", icon: ShieldCheck, sheetTab: "Fonds euros", step: 2, description: "Assurance-vie : valeur, rapprochement et taux servis." },
      { path: "/obligations", label: "Obligations", icon: Landmark, sheetTab: "OAT", step: 2, description: "Échelle d'OAT et obligations d'entreprise détenues à l'échéance." },
      { path: "/actions", label: "Actions & ETF", icon: ChartLine, sheetTab: "Actions", step: 2, description: "Positions du PEA, PRU, cours et investissement mensuel conseillé." },
      { path: "/crypto", label: "Crypto", icon: Bitcoin, sheetTab: "Crypto", step: 2, description: "Positions crypto et fiscalité des cessions." },
    ],
  },
  {
    label: "Organisation",
    items: [
      { path: "/etablissements", label: "Établissements", icon: Building2, sheetTab: "Choix des plateformes", step: 5, description: "Banques, courtiers, assureurs : offres, frais et comparaison." },
    ],
  },
  {
    label: "Fiscalité",
    items: [
      { path: "/impots", label: "Impôts", icon: Receipt, sheetTab: "Impôts", step: 3, description: "Impôt si tout était retiré aujourd'hui, rendements nets, impôt annuel." },
    ],
  },
  {
    label: "Aide",
    items: [
      { path: "/notice", label: "Notice", icon: BookOpen, sheetTab: "Notice", step: 5, description: "Mode d'emploi de Hamac." },
      { path: "/regles", label: "Règles et démarches", icon: ListChecks, sheetTab: "Règles et démarches", step: 5, description: "Règles du plan et liste des démarches à faire." },
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

