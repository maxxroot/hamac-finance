import { allocationReport } from "./allocations";
import { proposeContributions } from "./contributions";
import { addDays, addMonths, monthsBetween } from "./dates";
import { dpeExpiry, dpeRentalBan } from "./energy";
import { advisedMonthlyPurchase, monthsElapsed, type EngineData, type PortfolioState } from "./engine";
import { currentLease, leaseState, rentMonths } from "./leases";
import { formatEur } from "./money";
import { isRetirementPlan } from "./params";
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
      const under = off.filter((r) => r.action === "renforcer").map((r) => (r.bucket ? r.label.toLowerCase() : r.label));
      out.push({
        id: "allocation",
        level: "attention",
        title: `Une classe d'actifs s'écarte de plus de ${Math.round(p.livrets.driftAlert * 100)} % de sa cible`,
        detail: under.length ? `Orienter les prochains versements vers : ${under.join(", ")}.` : "Alléger en versant ailleurs, sans vendre.",
        link: "/enveloppes",
      });
    } else out.push({ id: "allocation", level: "ok", title: "Chaque classe d'actifs est proche de sa cible" });
  }

  // Allocations personnalisées (Paramètres › Plan).
  if (p.customAllocations.length) {
    const suggested = p.contributions.mode === "suggere" && p.contributions.capacity > 0;
    const report = suggested ? allocationReport(p.customAllocations, active, state.totals.value, p.contributions.capacity) : allocationReport(p.customAllocations, active, state.totals.value);
    const pct = (v: number) => `${Math.round(v * 1000) / 10} %`.replace(".", ",");
    for (const r of report.rows) {
      if (r.done && r.rule.limit) {
        const dest = r.rule.overflowTo ? report.rows.find((x) => x.rule.id === r.rule.overflowTo) : null;
        const where = dest && !dest.done ? `à « ${dest.name} »` : "aux autres lignes, au prorata";
        out.push({
          id: `alloc-limite-${r.rule.id}`,
          level: "info",
          title: `« ${r.name} » a atteint sa limite (${eur(r.rule.limit.amount)} ${r.rule.limit.basis === "verse" ? "versés" : "de valeur"})`,
          detail: `Sa part de ${pct(r.rule.share)} des versements va désormais ${where}.`,
          link: "/parametres",
        });
      }
    }
    const off = report.rows.filter((r) => report.monthlyBase > 0 && Math.abs(r.programmedMonthly - r.advisedMonthly) > Math.max(5, 0.1 * r.advisedMonthly));
    // En gestion suggérée, c'est la proposition complète qui fait foi (alerte ci-dessous).
    if (off.length && !suggested) {
      out.push({
        id: "alloc-versements",
        level: "info",
        title: "Versements programmés à ajuster selon vos allocations",
        detail: off.map((r) => `${r.name} : ${eur(r.programmedMonthly)} → ${eur(r.advisedMonthly)} par mois`).join(" · "),
        link: "/versements",
      });
    }
  }

  // Gestion suggérée : versements programmés différents de la répartition proposée.
  if (p.contributions.mode === "suggere" && p.contributions.capacity > 0) {
    const proposal = proposeContributions(p, state, p.contributions.capacity);
    const names = new Map(active.map((a) => [a.account.id, a.account.name]));
    const off = proposal.lines.filter((l) => Math.abs(l.amount - l.current) > Math.max(5, 0.1 * l.amount));
    if (off.length) {
      out.push({
        id: "versements-suggeres",
        level: "info",
        title: "Versements programmés différents de la répartition suggérée",
        detail: off.map((l) => `${names.get(l.accountId)} : ${eur(l.current)} → ${eur(l.amount)} par mois`).join(" · "),
        link: "/versements",
      });
    }
  }

  // Phase du plan (retraite seulement).
  if (isRetirementPlan(p))
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
  for (const a of active.filter((x) => (x.account.kind === "pea" || x.account.kind === "pea_pme") && x.cash >= p.alerts.peaCashThreshold)) {
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
  for (const a of active.filter((x) => x.account.kind === "pea" || x.account.kind === "pea_pme" || x.account.kind === "assurance_vie")) {
    const years = a.account.kind === "assurance_vie" ? 8 : 5;
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
      if (custody >= 1) out.push({ id: `garde-${a.account.id}`, level: "info", title: `Tenue de compte : environ ${eur(custody)} par an sur ${a.account.name}`, detail: `Grille de ${inst.name}.`, link: "/parametres?onglet=Établissements" });
    }
    const entry = inst.offers.assurance_vie?.entryFee ?? 0;
    if (a.account.kind === "assurance_vie" && entry >= 0.01) {
      out.push({ id: `entree-${a.account.id}`, level: "info", title: `Frais sur versements de ${Math.round(entry * 1000) / 10} % sur ${a.account.name}`, detail: "Les contrats en ligne sont souvent à 0 % : à comparer dans Établissements.", link: "/parametres?onglet=Établissements" });
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

  // Crowdlending.
  for (const a of active) {
    for (const c of a.crowdProjects.filter((x) => x.overdue)) out.push({ id: `crowd-${c.project.id}`, level: "attention", title: `Échéance dépassée : ${c.project.name}`, detail: `${a.account.name} · prévue le ${frDate(c.endDate!)}. Indiquez s'il est remboursé, en retard ou en défaut.`, link: "/crowdlending" });
    const defaults = a.crowdProjects.filter((x) => x.status === "defaut" && x.outstanding > 0);
    if (defaults.length) out.push({ id: `crowd-defaut-${a.account.id}`, level: "info", title: `${defaults.length} projet${defaults.length > 1 ? "s" : ""} en défaut sur ${a.account.name}`, detail: `${eur(defaults.reduce((s, x) => s + x.outstanding, 0))} de capital, compté${defaults.length > 1 ? "s" : ""} pour ${eur(defaults.reduce((s, x) => s + x.value, 0))}.`, link: "/crowdlending" });
  }

  out.push(...leaseAlerts(data, today));
  out.push(...energyAlerts(data, today));

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

/** Délais avant lesquels on prévient : expiration d'un DPE, interdiction de louer à venir. */
const DPE_EXPIRY_ALERT_DAYS = 90;
const RENTAL_BAN_ALERT_DAYS = 730;

/** Alertes sur le DPE, pour les biens dont la case des alertes est cochée. */
export function energyAlerts(data: Pick<EngineData, "properties">, today: string): Alert[] {
  const out: Alert[] = [];
  for (const p of (data.properties ?? []).filter((x) => x.dpeReminders && !x.archived)) {
    const link = `/immobilier/${p.id}`;
    const rented = p.kind === "locatif";
    if (p.dpeDate) {
      const expiry = dpeExpiry(p.dpeDate);
      const days = daysBetween(today, expiry);
      if (days < 0) out.push({ id: `dpe-expire-${p.id}`, level: rented ? "attention" : "info", title: `${p.name} : DPE expiré depuis le ${frDate(expiry)}`, detail: "Un DPE valide est obligatoire pour louer ou vendre.", link });
      else if (days <= DPE_EXPIRY_ALERT_DAYS) out.push({ id: `dpe-expire-${p.id}`, level: "info", title: `${p.name} : DPE valable jusqu'au ${frDate(expiry)}`, detail: "Prévoyez un nouveau diagnostic.", link });
    }
    if (rented && p.dpe) {
      const ban = dpeRentalBan(p.dpe, p.postalCode);
      if (ban != null) {
        const detail = "S'applique à tout nouveau bail et à la reconduction d'un bail en cours.";
        if (ban <= today) out.push({ id: `dpe-interdit-${p.id}`, level: "attention", title: `${p.name} : note ${p.dpe}, location interdite depuis le ${frDate(ban)}`, detail, link });
        else if (daysBetween(today, ban) <= RENTAL_BAN_ALERT_DAYS) out.push({ id: `dpe-interdit-${p.id}`, level: "info", title: `${p.name} : note ${p.dpe}, location interdite à partir du ${frDate(ban)}`, detail, link });
      }
    }
  }
  return out;
}

/** Délai avant une échéance de bail à partir duquel on la rappelle. */
const LEASE_ALERT_DAYS = 60;

/** Rappels des biens en location : fin de bail, départ du locataire, date limite pour donner congé et loyers impayés. */
export function leaseAlerts(data: Pick<EngineData, "properties" | "leases" | "leaseRents" | "rentExceptions">, today: string): Alert[] {
  const out: Alert[] = [];
  const soon = (date: string | null): date is string => date != null && daysBetween(today, date) >= 0 && daysBetween(today, date) <= LEASE_ALERT_DAYS;
  for (const property of (data.properties ?? []).filter((p) => p.kind === "locatif" && !p.archived)) {
    const states = (data.leases ?? []).filter((l) => l.propertyId === property.id).map((l) => leaseState(l, data.leaseRents ?? [], today));
    const current = currentLease(states);
    if (!current) continue;
    const link = `/immobilier/${property.id}`;
    const unpaid = states.flatMap((s) => rentMonths(s.lease, data.leaseRents ?? [], data.rentExceptions ?? [], today)).filter((m) => m.status === "impaye");
    if (unpaid.length) {
      const due = unpaid.reduce((sum, m) => sum + m.expectedRent + m.expectedCharges, 0);
      out.push({ id: `loyers-impayes-${property.id}`, level: "attention", title: `${property.name} : ${unpaid.length} loyer${unpaid.length > 1 ? "s" : ""} impayé${unpaid.length > 1 ? "s" : ""}`, detail: `${eur(due)} à recevoir.`, link });
    }
    if (!current.lease.reminders) continue;
    if (current.status === "termine") {
      out.push({ id: `bail-vacant-${property.id}`, level: "info", title: `${property.name} : aucun bail en cours`, link });
      continue;
    }
    if (current.status === "a_venir") continue;
    if (soon(current.end)) {
      out.push(
        current.status === "conge"
          ? { id: `bail-depart-${current.lease.id}`, level: "info", title: `${property.name} : fin du bail le ${frDate(current.end)}`, detail: "Un congé a été donné.", link }
          : { id: `bail-fin-${current.lease.id}`, level: "attention", title: `${property.name} : le bail se termine le ${frDate(current.end)}`, detail: "Ce bail ne se reconduit pas : prévoyez un nouveau bail.", link },
      );
    }
    if (soon(current.nextDeadline)) {
      out.push({ id: `bail-conge-${current.lease.id}`, level: "attention", title: `${property.name} : dernier jour pour donner congé le ${frDate(current.nextDeadline)}`, detail: `Sans congé reçu par le locataire à cette date, le bail se reconduit le ${frDate(addDays(current.nextDeadlineTermEnd!, 1))}.`, link });
    }
  }
  return out;
}

function frDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
