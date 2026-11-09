import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  ACCOUNT_KIND_LABELS,
  DEFAULT_OFFER_KINDS,
  INSTITUTION_KIND_LABELS,
  INSTITUTION_KINDS,
  emptyOffer,
  formatEur,
  NO_INSTITUTION_TAX,
  orderFee,
  type AvOffer,
  type BrokerOffer,
  type CrowdOffer,
  type CryptoOffer,
  type Institution,
  type InstitutionKind,
  type InstitutionTax,
  type Offers,
  type OrderFeeTier, type OfferKind,
} from "@hamac/core";
import { Checkbox, Field, FormGrid, Modal, MoneyInput, NumberInput, PercentInput, Select, Textarea, TextInput } from "@/components/form";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useMutate, useWorkspaceIndex } from "@/lib/workspace";

const OFFER_ORDER: OfferKind[] = ["pea", "cto", "assurance_vie", "livret", "crowdlending", "crypto"];
const EXAMPLES = [100, 500, 1000, 5000];

interface Draft {
  id?: string;
  name: string;
  kind: InstitutionKind;
  website: string;
  score: number | null;
  comment: string;
  offers: Offers;
  tax: InstitutionTax;
}

function blank(kind: InstitutionKind = "courtier"): Draft {
  const offers: Offers = {};
  for (const k of DEFAULT_OFFER_KINDS[kind]) (offers as Record<string, unknown>)[k] = emptyOffer(k);
  return { name: "", kind, website: "", score: null, comment: "", offers, tax: NO_INSTITUTION_TAX };
}

export function InstitutionDialog({ open, onClose, institution }: { open: boolean; onClose: () => void; institution?: Institution | null }) {
  const idx = useWorkspaceIndex();
  const save = useMutate("institutions.upsert", { success: institution ? "Établissement mis à jour" : "Établissement ajouté" });
  const [d, setD] = useState<Draft>(blank());
  useEffect(() => {
    if (open) setD(institution ? structuredClone(institution) : blank());
  }, [open, institution]);

  const linked = institution ? (idx?.ws.accounts.filter((a) => a.institutionId === institution.id) ?? []) : [];
  const setOffer = <K extends keyof Offers>(k: K, v: Offers[K] | undefined) =>
    setD((x) => {
      const offers = { ...x.offers };
      if (v === undefined) delete offers[k];
      else offers[k] = v;
      return { ...x, offers };
    });
  const toggle = (k: OfferKind) => {
    if (d.offers[k]) {
      const users = linked.filter((a) => a.kind === k);
      if (users.length && !confirm(`${users.map((a) => a.name).join(", ")} utilise cette offre : ses frais repasseront sur les frais par défaut. Continuer ?`)) return;
      setOffer(k, undefined);
    } else setOffer(k, emptyOffer(k) as never);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={institution ? `Modifier « ${institution.name} »` : "Nouvel établissement"}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" disabled={!d.name.trim() || save.isPending} onClick={() => save.mutate(d, { onSuccess: onClose })}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormGrid>
          <Field label="Nom">{(id) => <TextInput id={id} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="ex. le nom de votre banque ou courtier" autoFocus />}</Field>
          <Field label="Type">
            {(id) => (
              <Select
                id={id}
                value={d.kind}
                onChange={(e) => {
                  const kind = e.target.value as InstitutionKind;
                  // À la création, le type pré-coche les comptes habituels ; ensuite on ne touche plus aux offres.
                  setD((x) => (institution ? { ...x, kind } : { ...blank(kind), name: x.name, website: x.website, score: x.score, comment: x.comment, tax: x.tax }));
                }}
              >
                {INSTITUTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INSTITUTION_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Site web">{(id) => <TextInput id={id} value={d.website} onChange={(e) => setD({ ...d, website: e.target.value })} placeholder="https://…" />}</Field>
          <Field label="Note /10" help="Votre appréciation globale, pour comparer.">
            {(id) => <NumberInput id={id} decimals={1} value={d.score} onChange={(v) => setD({ ...d, score: v == null ? null : Math.min(10, v) })} />}
          </Field>
        </FormGrid>

        <div>
          <div className="mb-2 text-xs font-medium text-fg-muted">Comptes proposés</div>
          <div className="flex flex-wrap gap-2">
            {OFFER_ORDER.map((k) => {
              const on = !!d.offers[k];
              const used = linked.filter((a) => a.kind === k).length;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors", on ? "border-accent bg-accent/15 text-fg" : "border-line-strong text-fg-muted hover:text-fg")}
                  aria-pressed={on}
                >
                  {on ? "✓ " : ""}
                  {ACCOUNT_KIND_LABELS[k]}
                  {used > 0 && <span className="ml-1.5 text-xs text-fg-faint">({used} compte{used > 1 ? "s" : ""})</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-fg-faint">Cochez ce que propose l'établissement, puis renseignez les frais de chaque offre.</p>
        </div>

        {d.offers.pea && (
          <Section title="PEA">
            <BrokerEditor kind="pea" offer={d.offers.pea} onChange={(v) => setOffer("pea", v)} />
          </Section>
        )}
        {d.offers.cto && (
          <Section
            title="Compte-titres"
            action={
              d.offers.pea && (
                <Button variant="ghost" className="h-7 text-xs" onClick={() => setOffer("cto", structuredClone(d.offers.pea!))}>
                  <Copy size={12} /> Même grille que le PEA
                </Button>
              )
            }
          >
            <BrokerEditor kind="cto" offer={d.offers.cto} onChange={(v) => setOffer("cto", v)} />
          </Section>
        )}
        {d.offers.assurance_vie && (
          <Section title="Assurance-vie">
            <AvEditor offer={d.offers.assurance_vie} onChange={(v) => setOffer("assurance_vie", v)} />
          </Section>
        )}
        {d.offers.livret && (
          <Section title="Livrets">
            <p className="text-sm text-fg-muted">Pas de frais. Le taux et le plafond se règlent sur chaque livret (Paramètres › Comptes).</p>
          </Section>
        )}
        {d.offers.crowdlending && (
          <Section title="Crowdlending">
            <CrowdEditor offer={d.offers.crowdlending} forfait={(idx?.ws.params.tax.pfuIncomeTax ?? 0) + (idx?.ws.params.tax.socialGeneral ?? 0)} onChange={(v) => setOffer("crowdlending", v)} />
          </Section>
        )}
        {d.offers.crypto && (
          <Section title="Plateforme crypto">
            <CryptoEditor offer={d.offers.crypto} onChange={(v) => setOffer("crypto", v)} />
          </Section>
        )}

        <Section title="Fiscalité">
          <div className="space-y-4">
            <div>
              <Checkbox checked={d.tax.report} onChange={(v) => setD({ ...d, tax: { ...d.tax, report: v } })} label="Hamac rédige le récapitulatif fiscal de cet établissement" />
              <p className="mt-1.5 text-xs text-fg-faint">À cocher si l'établissement ne transmet rien au fisc. Sinon, ses montants sont seulement à contrôler avec son IFU, pour éviter de les déclarer deux fois.</p>
            </div>
            <FormGrid>
              <Field label="Acompte d'impôt retenu sur les revenus" help="Vide si vous ne savez pas, 0 si rien n'est retenu.">
                {(id) => <PercentInput id={id} value={d.tax.withheldIncomeTax} onChange={(v) => setD({ ...d, tax: { ...d.tax, withheldIncomeTax: v } })} />}
              </Field>
              <Field label="Prélèvements sociaux retenus" help="Vide si vous ne savez pas, 0 si rien n'est retenu.">
                {(id) => <PercentInput id={id} value={d.tax.withheldSocial} onChange={(v) => setD({ ...d, tax: { ...d.tax, withheldSocial: v } })} />}
              </Field>
            </FormGrid>
          </div>
        </Section>

        <Field label="Commentaire">{(id) => <Textarea id={id} value={d.comment} onChange={(e) => setD({ ...d, comment: e.target.value })} placeholder="Points forts, points faibles, date de la grille tarifaire…" />}</Field>
      </div>
    </Modal>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Oui / Non / non renseigné. */
function YesNo({ label, value, onChange, target }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void; target?: boolean }) {
  return (
    <Field label={label} help={target != null ? `Visé : ${target ? "oui" : "non"}` : undefined}>
      {(id) => (
        <Select id={id} value={value == null ? "" : value ? "1" : "0"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "1")}>
          <option value="">—</option>
          <option value="1">Oui</option>
          <option value="0">Non</option>
        </Select>
      )}
    </Field>
  );
}

function BrokerEditor({ kind, offer, onChange }: { kind: "pea" | "cto"; offer: BrokerOffer; onChange: (o: BrokerOffer) => void }) {
  const g = offer.orderFees;
  const tiers = [...g.tiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  const setTiers = (t: OrderFeeTier[]) => onChange({ ...offer, orderFees: { ...g, tiers: t } });
  const setTier = (i: number, patch: Partial<OrderFeeTier>) => setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const addTier = () => {
    // Insère un palier avant « au-delà ».
    const bounded = tiers.filter((t) => t.upTo != null);
    const last = bounded[bounded.length - 1]?.upTo ?? 0;
    setTiers([...bounded, { upTo: last ? last * 2 : 500, fixed: 0, rate: 0 }, ...tiers.filter((t) => t.upTo == null)]);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium text-fg-muted">Frais par ordre (achat ou vente)</div>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_auto] items-end gap-2">
              {t.upTo == null ? (
                <div className="pb-2 text-sm text-fg-muted">{tiers.length > 1 ? `Au-delà de ${formatEur(tiers[i - 1]?.upTo ?? 0, { compact: true })}` : "Tout montant"}</div>
              ) : (
                <Field label={i === 0 ? "Ordre jusqu'à" : "Jusqu'à"}>{(id) => <MoneyInput id={id} value={t.upTo} onChange={(v) => setTier(i, { upTo: v ?? 0 })} />}</Field>
              )}
              <Field label={i === 0 ? "Montant fixe" : ""}>{(id) => <MoneyInput id={id} value={t.fixed} onChange={(v) => setTier(i, { fixed: v ?? 0 })} />}</Field>
              <Field label={i === 0 ? "+ % de l'ordre" : ""}>{(id) => <PercentInput id={id} value={t.rate} onChange={(v) => setTier(i, { rate: v ?? 0 })} />}</Field>
              <button
                type="button"
                className="mb-2 rounded p-1 text-fg-faint hover:text-negative disabled:invisible"
                disabled={t.upTo == null}
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                aria-label="Supprimer ce palier"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="mt-2 h-7 text-xs" onClick={addTier}>
          <Plus size={12} /> Ajouter un palier
        </Button>
      </div>
      <FormGrid cols={2}>
        <Field label="Frais minimum par ordre">{(id) => <MoneyInput id={id} value={g.min} onChange={(v) => onChange({ ...offer, orderFees: { ...g, min: v } })} placeholder="aucun" />}</Field>
        <Field label="Frais maximum par ordre">{(id) => <MoneyInput id={id} value={g.max} onChange={(v) => onChange({ ...offer, orderFees: { ...g, max: v } })} placeholder="aucun" />}</Field>
      </FormGrid>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-fg-faint">Coût d'un ordre :</span>
        {EXAMPLES.map((amt) => {
          const fee = orderFee(g, amt);
          return (
            <Badge key={amt} tone={fee / amt > 0.01 ? "negative" : "neutral"}>
              {formatEur(amt, { compact: true })} → {formatEur(fee)} ({((fee / amt) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %)
            </Badge>
          );
        })}
      </div>
      <FormGrid cols={2}>
        <Field label="Droits de garde / tenue de compte (€ par an)">{(id) => <MoneyInput id={id} value={offer.custodyFixed} onChange={(v) => onChange({ ...offer, custodyFixed: v ?? 0 })} />}</Field>
        <Field label="Droits de garde (% de l'encours par an)">{(id) => <PercentInput id={id} value={offer.custodyRate} onChange={(v) => onChange({ ...offer, custodyRate: v ?? 0 })} />}</Field>
      </FormGrid>
      <FormGrid cols={2}>
        {kind === "pea" ? (
          <YesNo label="ETF monde éligible au PEA" value={offer.etfWorld} onChange={(v) => onChange({ ...offer, etfWorld: v })} target />
        ) : (
          <YesNo label="Obligations accessibles en direct" value={offer.directBonds} onChange={(v) => onChange({ ...offer, directBonds: v })} target />
        )}
        <YesNo label="Investissement programmé" value={offer.programmed} onChange={(v) => onChange({ ...offer, programmed: v })} target />
        <YesNo label="Service client joignable" value={offer.reachableSupport} onChange={(v) => onChange({ ...offer, reachableSupport: v })} target />
      </FormGrid>
    </div>
  );
}

function AvEditor({ offer, onChange }: { offer: AvOffer; onChange: (o: AvOffer) => void }) {
  const set = <K extends keyof AvOffer>(k: K, v: AvOffer[K]) => onChange({ ...offer, [k]: v });
  return (
    <div className="space-y-4">
      <FormGrid cols={2}>
        <Field label="Frais sur versements" help="Visé : 0 %.">{(id) => <PercentInput id={id} value={offer.entryFee} onChange={(v) => set("entryFee", v ?? 0)} />}</Field>
        <Field label="Frais de gestion du fonds euros (par an)">{(id) => <PercentInput id={id} value={offer.euroFee} onChange={(v) => set("euroFee", v ?? 0)} />}</Field>
        <Field label="Frais de gestion des unités de compte (par an)" help="Visé : environ 0,5 %.">{(id) => <PercentInput id={id} value={offer.ucFee} onChange={(v) => set("ucFee", v ?? 0)} />}</Field>
        <Field label="Frais d'arbitrage">{(id) => <PercentInput id={id} value={offer.arbitrageFee} onChange={(v) => set("arbitrageFee", v ?? 0)} />}</Field>
        <Field label="Fonds euros : dernier taux servi">{(id) => <PercentInput id={id} value={offer.euroRateLast} onChange={(v) => set("euroRateLast", v)} />}</Field>
        <Field label="Fonds euros : moyenne sur 5 ans">{(id) => <PercentInput id={id} value={offer.euroRate5y} onChange={(v) => set("euroRate5y", v)} />}</Field>
        <Field label="Versements programmés dès" help="Visé : 50 à 100 €.">{(id) => <MoneyInput id={id} value={offer.programmedFrom} onChange={(v) => set("programmedFrom", v)} />}</Field>
        <Field label="Assureur">{(id) => <TextInput id={id} value={offer.insurer} onChange={(e) => set("insurer", e.target.value)} />}</Field>
      </FormGrid>
      <FormGrid cols={2}>
        <YesNo label="100 % fonds euros possible" value={offer.full100Euro} onChange={(v) => set("full100Euro", v)} target />
        <YesNo label="Bonus conditionné à une part de risque" value={offer.bonusConditioned} onChange={(v) => set("bonusConditioned", v)} target={false} />
        <YesNo label="ETF monde disponible" value={offer.etfWorld} onChange={(v) => set("etfWorld", v)} target />
        <YesNo label="Fonds datés" value={offer.datedFunds} onChange={(v) => set("datedFunds", v)} target />
      </FormGrid>
    </div>
  );
}

function CrowdEditor({ offer, forfait, onChange }: { offer: CrowdOffer; forfait: number; onChange: (o: CrowdOffer) => void }) {
  return (
    <div className="space-y-3">
      <Checkbox checked={offer.taxWithheld} onChange={(v) => onChange({ ...offer, taxWithheld: v, taxRate: v ? (offer.taxRate ?? forfait) : null })} label="La plateforme prélève les impôts automatiquement" />
      {offer.taxWithheld && (
        <Field label="Taux prélevé" help="Notez alors au Journal les intérêts nets, tels que crédités sur la plateforme.">
          {(id) => <PercentInput id={id} value={offer.taxRate} onChange={(v) => onChange({ ...offer, taxRate: v })} />}
        </Field>
      )}
    </div>
  );
}

function CryptoEditor({ offer, onChange }: { offer: CryptoOffer; onChange: (o: CryptoOffer) => void }) {
  return (
    <FormGrid cols={2}>
      <Field label="Frais par achat ou vente">{(id) => <PercentInput id={id} value={offer.tradeFee} onChange={(v) => onChange({ ...offer, tradeFee: v ?? 0 })} />}</Field>
      <Field label="Écart de prix (spread) estimé" help="Coût caché entre prix d'achat et de vente.">{(id) => <PercentInput id={id} value={offer.spread} onChange={(v) => onChange({ ...offer, spread: v ?? 0 })} />}</Field>
    </FormGrid>
  );
}
