import { RENT_STATUS_LABELS, type RentStatus } from "@hamac/core";
import { Badge } from "@/components/ui";

const TONES: Record<RentStatus, "neutral" | "accent" | "positive" | "negative"> = { a_venir: "neutral", attendu: "accent", recu: "positive", partiel: "negative", non_recu: "negative", remis: "neutral" };

/** État d'un loyer : reçu, attendu, non reçu… */
export const RentStatusBadge = ({ status }: { status: RentStatus }) => <Badge tone={TONES[status]}>{RENT_STATUS_LABELS[status]}</Badge>;
