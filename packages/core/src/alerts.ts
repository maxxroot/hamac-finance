import { addMonths, monthsBetween } from "./dates";
import { BUCKET_LABELS } from "./domain";
import { advisedMonthlyPurchase, monthsElapsed, type EngineData, type PortfolioState } from "./engine";
import { formatEur } from "./money";
import { daysBetween } from "./xirr";

/** Niveaux réservés : toujours affichés avec une icône et un libellé, jamais par la couleur seule. */
export type AlertLevel = "critique" | "attention" | "info" | "ok";

export interface Alert {
  id: string;
  level: AlertLevel;
  title: string;
  detail?: string;
  /** Page où agir. */
  link?: string;
}

const eur = (v: number) => formatEur(v, { compact: true });
const RANK: Record<AlertLevel, number> = { critique: 0, attention: 1, info: 2, ok: 3 };

export function computeAlerts(data: EngineData, state: PortfolioState, opts: { priceErrors?: Array<{ name: string; message: string }> } = {}): Alert[] {
  const p = data.params;
  const today = state.asOf;
  const out: Alert[] = [];
  const active = state.accounts.filter((a) => !a.account.archived);

  // Incohérences du journal.
  state.warnings.forEach((w, i) => out.push({ id: `warn-${i}`, level: "critique", title: w, link: "/journal" }));

  // Livrets.
  const l = state.livrets;
  if (active.some((a) => a.account.kind === "livret")) {
    if (l.status === "sous_plancher") out.push({ id: "livrets", level: "attention", title: `Livrets sous le plancher de ${eur(l.floor)}`, detail: "Reconstituer avant tout autre placement.", link: "/livrets" });
    else if (l.status === "au_dessus") out.push({ id: "livrets", level: "info", title: `Transférer ${eur(l.excess)} des livrets vers le fonds euros`, detail: `Au-delà du plafond du plan (${eur(l.ceiling)}).`, link: "/livrets" });
    else out.push({ id: "livrets", level: "ok", title: `Livrets dans la fourchette ${eur(l.floor)} – ${eur(l.ceiling)}` });
  }
  for (const a of active.filter((x) => x.account.kind === "livret" && x.account.depositCeiling != null && x.value > x.account.depositCeiling + 0.5)) {
    out.push({ id: `plafond-${a.account.id}`, level: "info", title: `${a.account.name} au-delà de son plafond de dépôt`, detail: "Seuls les intérêts capitalisés peuvent légalement le dépasser : plus de versement possible.", link: "/livrets" });
  }

  // Allocation.
  const off = state.allocation.rows.filter((r) => r.action !== "ok");
  if (state.allocation.invested > 0) {
    if (off.length) {
      const under = off.filter((r) => r.action === "renforcer").map((r) => BUCKET_LABELS[r.bucket].toLowerCase());
      out.push({
        id: "allocation",
        level: "attention",
        title: `Une poche s'écarte de plus de ${Math.round(p.livrets.driftAlert * 100)} points de sa cible`,
        detail: under.length ? `Orienter les prochains versements vers : ${under.join(", ")}.` : "Alléger en versant ailleurs, sans vendre.",
        link: "/enveloppes",
      });
    } else out.push({ id: "allocation", level: "ok", title: "Chaque poche est proche de sa cible" });
  }

  // Phase du plan.
  out.push(
    state.age >= p.profile.securisationAge
      ? { id: "phase", level: "info", title: "Phase de sécurisation", detail: "Versements actions redirigés vers le fonds euros, allègement progressif." }
      : { id: "phase", level: "ok", title: `Phase de constitution : sécurisation à partir de ${p.profile.securisationAge} ans` },
  );

  // Obligations : espèces à investir, prochaine échéance.
  for (const a of active.filter((x) => x.account.kind === "cto" && x.cash >= p.alerts.ctoCashThreshold)) {
    out.push({ id: `cto-${a.account.id}`, level: "info", title: `${eur(a.cash)} disponibles pour acheter une obligation`, detail: a.account.name, link: "/obligations" });
  }
  const next = active.flatMap((a) => a.positions.filter((x) => x.bond)).sort((x, y) => x.bond!.terms.maturityDate.localeCompare(y.bond!.terms.maturityDate))[0];
  if (next && daysBetween(today, next.bond!.terms.maturityDate) <= 365) {
    out.push({ id: "echeance", level: "info", title: `Échéance le ${frDate(next.bond!.terms.maturityDate)} : ${next.asset.name}`, detail: `${eur(next.bond!.nominal)} remboursés. Prévoir le réinvestissement.`, link: "/obligations" });
  }

  // PEA : espèces en attente.
  for (const a of active.filter((x) => x.account.kind === "pea" && x.cash >= p.alerts.peaCashThreshold)) {
    const advised = advisedMonthlyPurchase(a.cash, a.account.monthsToInvest, monthsElapsed(p, today));
    out.push({ id: `pea-${a.account.id}`, level: "info", title: `Acheter environ ${eur(advised)} d'ETF ce mois-ci`, detail: `${eur(a.cash)} en attente sur ${a.account.name}.`, link: "/actions" });
  }

  // Cours.
  const held = active.flatMap((a) => a.positions).filter((x) => x.asset.kind !== "obligation");
  const missing = held.filter((x) => x.priceUsed === "cout");
  if (missing.length) out.push({ id: "cours-manquants", level: "attention", title: `Cours indisponible : ${missing.map((x) => x.asset.name).join(", ")}`, detail: "Valorisé au prix de revient. Saisissez le cours à la main.", link: "/actions" });
  const stale = held.filter((x) => x.priceDate && x.priceUsed !== "cout" && daysBetween(x.priceDate, today) > 7);
  if (stale.length) out.push({ id: "cours-anciens", level: "info", title: `Cours de plus d'une semaine : ${stale.map((x) => x.asset.name).join(", ")}` });
  if (opts.priceErrors?.length) out.push({ id: "cours-erreurs", level: "attention", title: `Actualisation des cours impossible pour ${opts.priceErrors.length} titre(s)`, detail: opts.priceErrors.map((e) => `${e.name} : ${e.message}`).join(" · ") });

  // Parts cibles.
  const weights = data.assets.filter((x) => !x.archived && x.targetWeight != null && x.kind !== "obligation" && x.kind !== "crypto");
  const sum = weights.reduce((s, x) => s + (x.targetWeight ?? 0), 0);
  if (weights.length && Math.abs(sum - 1) > 0.0001) out.push({ id: "cibles", level: "attention", title: `Les parts cibles des actions font ${Math.round(sum * 1000) / 10} % au lieu de 100 %`, link: "/parametres" });

  // Assurance-vie.
  for (const a of active.filter((x) => x.account.kind === "assurance_vie")) {
    if (!a.account.beneficiaryClause && a.value > 0) out.push({ id: `clause-${a.account.id}`, level: "attention", title: `Clause bénéficiaire à rédiger : ${a.account.name}`, link: "/fonds-euros" });
    if (a.value > p.alerts.fgapGuarantee) out.push({ id: `fgap-${a.account.id}`, level: "attention", title: `${a.account.name} dépasse la garantie FGAP (${eur(p.alerts.fgapGuarantee)})`, detail: "Envisager un second assureur.", link: "/fonds-euros" });
    if (a.statementGap != null && Math.abs(a.statementGap) >= 1) out.push({ id: `releve-${a.account.id}`, level: "attention", title: `Écart de ${eur(a.statementGap)} avec le relevé de ${a.account.name}`, detail: "Saisir une correction dans le journal.", link: "/fonds-euros" });
  }

  // Dates d'ouverture et anniversaires fiscaux.
  for (const a of active.filter((x) => x.account.kind === "pea" || x.account.kind === "assurance_vie")) {
    const years = a.account.kind === "pea" ? 5 : 8;
    if (!a.account.openedOn) {
      if (a.value > 0) out.push({ id: `ouverture-${a.account.id}`, level: "info", title: `Date d'ouverture à renseigner : ${a.account.name}`, detail: `Elle conditionne la règle des ${years} ans.`, link: "/parametres" });
      continue;
    }
    const anniv = addMonths(a.account.openedOn, years * 12);
    if (anniv > today && monthsBetween(today, anniv) < 6) out.push({ id: `anniv-${a.account.id}`, level: "info", title: `${a.account.name} aura ${years} ans le ${frDate(anniv)}`, detail: "Fiscalité allégée à partir de cette date : attendre pour tout retrait." });
  }

  // Frais : droits de garde, frais sur versements, petits ordres coûteux.
  const institutions = new Map((data.institutions ?? []).map((i) => [i.id, i]));
  for (const a of active) {
    const inst = a.account.institutionId ? institutions.get(a.account.institutionId) : undefined;
    if (!inst) continue;
    if (a.account.kind === "pea" || a.account.kind === "cto") {
      const offer = inst.offers[a.account.kind];
      const custody = offer ? offer.custodyFixed + offer.custodyRate * a.value : 0;
      if (custody >= 1) out.push({ id: `garde-${a.account.id}`, level: "info", title: `Tenue de compte : environ ${eur(custody)} par an sur ${a.account.name}`, detail: `Grille de ${inst.name}.`, link: "/etablissements" });
    }
    const entry = inst.offers.assurance_vie?.entryFee ?? 0;
    if (a.account.kind === "assurance_vie" && entry >= 0.01) {
      out.push({ id: `entree-${a.account.id}`, level: "info", title: `Frais sur versements de ${Math.round(entry * 1000) / 10} % sur ${a.account.name}`, detail: "Les contrats en ligne sont souvent à 0 % : à comparer dans Établissements.", link: "/etablissements" });
    }
  }
  const since = addMonths(today, -6);
  const costly = data.transactions.filter((t) => (t.type === "achat" || t.type === "vente") && t.date >= since && t.date <= today && t.fee != null && t.amount > 0 && t.fee / t.amount > 0.01);
  if (costly.length) {
    const worst = costly.reduce((m, t) => (t.fee! / t.amount > m.fee! / m.amount ? t : m));
    out.push({
      id: "petits-ordres",
      level: "attention",
      title: `${costly.length} ordre(s) récent(s) avec plus de 1 % de frais (jusqu'à ${Math.round((worst.fee! / worst.amount) * 1000) / 10} %)`,
      detail: "Regrouper les achats en ordres plus gros réduit les frais.",
      link: "/journal",
    });
  }

  // Janvier–mars : intérêts de l'année passée à saisir.
  const month = +today.slice(5, 7);
  if (month <= 3) {
    const last = +today.slice(0, 4) - 1;
    for (const a of active.filter((x) => (x.account.kind === "livret" || x.account.kind === "assurance_vie") && x.value > 0)) {
      const has = data.transactions.some((t) => t.accountId === a.account.id && t.type === "interets" && t.date.startsWith(`${last}-`));
      if (!has) out.push({ id: `interets-${a.account.id}`, level: "attention", title: `Intérêts ${last} à saisir : ${a.account.name}`, detail: `Datés du 31/12/${last}, tels que crédités.`, link: `/journal?nouveau=1&compte=${a.account.id}&type=interets` });
    }
  }

  return out.sort((x, y) => RANK[x.level] - RANK[y.level]);
}

function frDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
