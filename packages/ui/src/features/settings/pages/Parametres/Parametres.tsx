import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { MarketSources } from "@/features/settings/components/MarketSources";
import { Etablissements } from "@/features/settings/pages/Etablissements";
import { PageHeader, tabClass, tabListClass } from "@/shared/components/ui";
import { SETTINGS_ITEM } from "@/shared/nav";
import { AccountsTab } from "./AccountsTab";
import { AppTab } from "./AppTab";
import { AssetsTab } from "./AssetsTab";
import { PlanTab } from "./PlanTab";
import { RepartitionTab } from "./RepartitionTab";
import { usePlanDraft, SaveBar } from "./usePlanDraft";

export const TABS = ["Plan", "Répartition", "Établissements", "Comptes", "Actifs", "Cours", "Application"] as const;

export type Tab = (typeof TABS)[number];

export function Parametres() {
  const [search] = useSearchParams();
  const wantedTab = TABS.find((t) => t === search.get("onglet"));
  const [tab, setTab] = useState<Tab>(wantedTab ?? "Plan");
  // Un lien vers un onglet peut être suivi alors que la page est déjà ouverte (bandeau de double authentification).
  useEffect(() => {
    if (wantedTab) setTab(wantedTab);
  }, [wantedTab, search]);
  const draft = usePlanDraft();
  return (
    <>
      <PageHeader title="Paramètres" description={SETTINGS_ITEM.description} />
      <div className={tabListClass} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tabClass(tab === t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="pb-20">
      {tab === "Plan" && <PlanTab draft={draft} />}
      {tab === "Répartition" && <RepartitionTab draft={draft} />}
      {tab === "Établissements" && <Etablissements />}
      {tab === "Comptes" && <AccountsTab />}
      {tab === "Actifs" && <AssetsTab />}
      {tab === "Cours" && <MarketSources />}
      {tab === "Application" && <AppTab />}
      </div>
      <SaveBar draft={draft} />
    </>
  );
}

// ——— Plan ———
