/** Saisie partagée par les pages : comptes, titres, opérations, allocation, premiers pas. Seul ce fichier s'importe depuis un autre domaine. */
export { AddAccountButton, EditAccountButton } from "./components/AccountButtons";
export { CompositionNotice } from "./components/CompositionNotice";
export { Movements } from "./components/Movements";
export { Onboarding } from "./components/Onboarding";
export { AddTransactionButton, EmptyAccount } from "./components/TransactionButton";
export { AccountDialog } from "./dialogs/AccountDialog";
export { AllocationChoice } from "./dialogs/AllocationChoice";
export { NEW_FUND_PRESET, TransactionDialog } from "./dialogs/TransactionDialog";
export type { TxPreset } from "./dialogs/TransactionDialog";
export { compositionStatus, countryLabel, currencyLabel, EXPOSURE_KEY, hasPending, kindLabel, sectorLabel, summariesByAsset, withOthers } from "./lib/exposure";
export { supportsLabel, useJournal } from "./lib/journal";
