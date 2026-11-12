import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Table, Td, Th, Tr } from "@/components/table";
import { Card, PageHeader } from "@/components/ui";

/** Sommaire : chaque entrée correspond à l'identifiant d'une section ci-dessous. */
export const NOTICE_PLAN: ReadonlyArray<{ part: string; items: ReadonlyArray<[id: string, label: string]> }> = [
  {
    part: "Bien commencer",
    items: [
      ["principe", "Comment fonctionne Hamac"],
      ["demarrage", "La mise en route, étape par étape"],
    ],
  },
  {
    part: "Au fil des mois",
    items: [
      ["journal", "Noter une opération"],
      ["import", "Importer un relevé"],
      ["versements", "Vos virements mensuels"],
      ["calendrier", "Que faire, et quand"],
      ["resultats", "Où lire vos résultats"],
    ],
  },
  {
    part: "Selon ce que vous possédez",
    items: [
      ["livrets", "Livrets et fonds euros"],
      ["etf", "Actions et ETF"],
      ["obligations", "Obligations"],
      ["crypto", "Crypto"],
      ["crowdlending", "Crowdlending"],
      ["immobilier", "Immobilier et SCPI"],
      ["biens", "Or, objets, véhicules, argent prêté"],
      ["credits", "Crédits"],
      ["autres", "PEA-PME, PER, épargne salariale"],
    ],
  },
  {
    part: "Aller plus loin",
    items: [
      ["repartition", "Affiner sa répartition"],
      ["cours", "Les cours de bourse"],
      ["impots", "Impôts et déclaration"],
      ["donnees", "Vos données et sauvegardes"],
      ["securite", "Protéger votre compte"],
      ["lexique", "Les mots à connaître"],
    ],
  },
];

function goTo(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLDetailsElement) el.open = true;
  el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

const L = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="text-accent hover:underline">
    {children}
  </Link>
);

/** Renvoi vers une autre section de la notice. */
const See = ({ id, children }: { id: string; children: ReactNode }) => (
  <button type="button" onClick={() => goTo(id)} className="text-left text-accent hover:underline">
    {children}
  </button>
);

const B = ({ children }: { children: ReactNode }) => <b className="text-fg">{children}</b>;

const BODY = "space-y-3 text-sm leading-relaxed text-fg-muted";

function Part({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mt-9 mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-1 text-sm text-fg-muted">{intro}</p>}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="mb-4 scroll-mt-6">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className={BODY}>{children}</div>
    </Card>
  );
}

/** Section repliée : on n'ouvre que ce qui vous concerne. */
function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <details id={id} className="group mb-3 scroll-mt-6 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 text-accent transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className={`${BODY} px-5 pb-5`}>{children}</div>
    </details>
  );
}

function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-medium text-fg">
          {title}
          {optional && <span className="ml-2 text-xs font-normal text-fg-faint">facultatif</span>}
        </div>
        <div className="mt-1 space-y-1.5">{children}</div>
      </div>
    </li>
  );
}

function Rows({ head, rows, firstNowrap }: { head: readonly string[]; rows: ReadonlyArray<readonly ReactNode[]>; firstNowrap?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          {head.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <Tr key={i}>
            {r.map((c, j) => (
              <Td key={j} className={j === 0 ? `text-fg ${firstNowrap ? "whitespace-nowrap" : ""}` : undefined}>
                {c}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

const LEXIQUE: ReadonlyArray<readonly [string, string]> = [
  ["Action", "Une part d'une entreprise. Sa valeur monte et descend avec la bourse."],
  ["Allocation cible", "La répartition que vous visez entre vos types de placements. Hamac la compare à ce que vous détenez."],
  ["Assurance-vie", "Une enveloppe d'épargne proposée par un assureur, qui peut contenir un fonds euros et d'autres placements."],
  ["Brut / net", "Le brut est le montant avant impôts et prélèvements. Le net est ce qui arrive réellement sur le compte."],
  ["Capital restant dû", "Ce qu'il reste à rembourser sur un crédit, hors intérêts à venir."],
  ["Classe d'actifs", "Un type de placement : livrets, fonds euros, obligations, actions, immobilier, crypto, ou une classe que vous créez."],
  ["Compte-titres", "Une enveloppe sans limite ni avantage fiscal pour détenir des actions, des ETF ou des obligations."],
  ["Coupon", "L'intérêt versé régulièrement par une obligation, exprimé en % du nominal."],
  ["Crowdlending", "Un prêt à des entreprises ou à des projets via une plateforme, en échange d'intérêts, avec un risque de perdre le capital."],
  ["Enveloppe (compte)", "Le cadre fiscal qui contient vos placements : livret, assurance-vie, PEA, compte-titres, PER…"],
  ["Espèces", "L'argent arrivé sur un compte mais pas encore investi."],
  ["ETF", "Un fonds coté en bourse qui suit un indice, par exemple les grandes entreprises mondiales. Une part d'ETF revient à détenir un peu de chacune."],
  ["Fonds euros", "La partie d'une assurance-vie dont le capital est garanti par l'assureur, avec un taux annoncé chaque année."],
  ["Gain", "La valeur actuelle moins le versé net."],
  ["IFU", "Le récapitulatif fiscal annuel envoyé par une banque ou un courtier."],
  ["ISIN", "Le code de 12 caractères qui identifie un titre, par exemple FR0011871128."],
  ["Nominal", "La somme qu'une obligation rembourse à l'échéance."],
  ["Obligation", "Un prêt à un État ou à une entreprise : vous recevez des coupons, puis le nominal à l'échéance."],
  ["PEA", "Le plan d'épargne en actions : une enveloppe avantageuse pour les actions, surtout après 5 ans."],
  ["PER", "Le plan d'épargne retraite : les sommes sont en principe bloquées jusqu'à la retraite."],
  ["Patrimoine net", "Le patrimoine financier, plus les biens immobiliers (part détenue), moins le capital restant dû des crédits (part à votre charge)."],
  ["Plus-value", "Le gain réalisé en vendant plus cher que le prix payé. Dans le cas contraire, c'est une moins-value."],
  ["PRU", "Le prix de revient unitaire : le prix moyen payé par part, frais compris."],
  ["Prélèvements sociaux", "Les contributions sociales dues sur les revenus de l'épargne, en plus de l'impôt."],
  ["Rendement à l'échéance", "Le vrai rendement annuel d'une obligation gardée jusqu'au bout, compte tenu de son prix d'achat."],
  ["Rendement annualisé", "Ce que l'argent a rapporté par an, en tenant compte de la date de chaque versement."],
  ["SCPI", "Une société qui détient de l'immobilier, dont on achète des parts et qui reverse des loyers."],
  ["Sécurisation", "La période avant le départ où la part d'actions baisse peu à peu au profit du fonds euros."],
  ["TER", "Les frais de gestion annuels d'un ETF, déjà déduits de son cours."],
  ["Tranche d'imposition", "Le taux d'impôt qui s'applique à la dernière partie de vos revenus. Il figure sur votre avis d'imposition."],
  ["Versé net", "Tout l'argent mis de votre poche, moins ce que vous avez retiré."],
];

export function Notice() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Notice" description="Tout ce qu'il faut savoir pour utiliser Hamac, sans être un spécialiste." />

      <Card className="mb-2">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NOTICE_PLAN.map((g) => (
            <div key={g.part}>
              <div className="mb-1.5 text-xs font-medium text-fg-faint">{g.part}</div>
              <ul className="space-y-1 text-sm">
                {g.items.map(([id, label]) => (
                  <li key={id}>
                    <See id={id}>{label}</See>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Part title="Bien commencer" />

      <Section id="principe" title="Comment fonctionne Hamac">
        <p>Hamac suit toute votre épargne au même endroit et vous aide à préparer l'avenir. Le principe tient en une phrase :</p>
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-fg">Vous notez ce qui se passe sur vos comptes, Hamac calcule tout le reste : valeur, gains, rendement, impôts, projection et alertes.</p>
        <p>
          Vous n'avez donc qu'un seul endroit à tenir à jour, le <L to="/journal">Journal</L>. Les virements automatiques se programment une seule fois dans <L to="/versements">Versements</L>.
        </p>
        <p>
          Un mot vous échappe ? Consultez <See id="lexique">les mots à connaître</See>.
        </p>
      </Section>

      <Section id="demarrage" title="La mise en route, étape par étape">
        <p>Gardez vos derniers relevés sous la main. Ces réglages ne se font qu'une fois, et restent modifiables.</p>
        <ol className="space-y-4 pt-1">
          <Step n={1} title="Dites ce que vous attendez de Hamac">
            <p>
              Dans <L to="/parametres?onglet=Plan">Paramètres › Plan</L>, choisissez votre usage : <B>préparer votre retraite</B> (avec une projection, et moins d'actions à mesure que l'âge avance) ou <B>gérer votre patrimoine</B> (répartition fixe, sans projection).
            </p>
            <p>Renseignez ensuite votre année de naissance, le premier mois et le jour de vos versements, et votre tranche d'imposition. Pour une retraite, ajoutez l'âge de départ visé.</p>
            <p>Les autres réglages (inflation, plancher et plafond des livrets, âges de sécurisation et d'horizon) ont des valeurs par défaut que vous pouvez garder pour commencer. Vous pouvez aussi masquer les pages inutiles avec les modules : aucun calcul ne change.</p>
          </Step>
          <Step n={2} title="Ajoutez vos banques et courtiers">
            <p>
              Dans <L to="/parametres?onglet=Établissements">Paramètres › Établissements</L>, créez votre banque, votre courtier, votre assureur. Indiquez leurs frais : Hamac les appliquera tout seul à vos achats et ventes. Vous les trouvez dans leur grille tarifaire, par exemple « jusqu'à 500 € : 1,99 €, au-delà : 0,5 % ».
            </p>
            <p>
              Dans la rubrique Fiscalité de la fiche, indiquez si l'établissement <B>prélève les impôts</B> sur les intérêts et dividendes. C'est le cas en général des banques, courtiers et assureurs français, rarement d'un établissement étranger ou d'une plateforme crypto. S'il ne prélève rien, notez au Journal le montant reçu : Hamac le compte comme brut et affiche l'impôt à payer à la déclaration.
            </p>
          </Step>
          <Step n={3} title="Créez vos comptes">
            <p>
              Dans <L to="/parametres?onglet=Comptes">Paramètres › Comptes</L>, ajoutez chaque livret, assurance-vie, PEA, compte-titres… avec son établissement et sa date d'ouverture. Cette date compte : elle sert aux règles fiscales des 5 ans (PEA) et des 8 ans (assurance-vie).
            </p>
          </Step>
          <Step n={4} title="Ajoutez ce que vous détenez">
            <p>
              Dans <L to="/parametres?onglet=Actifs">Paramètres › Actifs</L>, cherchez vos ETF, actions, obligations ou cryptos par leur nom ou leur code ISIN. Si vous avez plusieurs ETF, indiquez la part visée pour chacun (total 100 %). Si vous détenez seulement des livrets et un fonds euros, passez cette étape.
            </p>
          </Step>
          <Step n={5} title="Notez ce que vous avez déjà">
            <p>
              Dans le <L to="/journal">Journal</L>, ajoutez un <B>Apport initial</B> par compte, avec l'argent qui s'y trouvait au départ. Exemple : LEP, Apport initial, 5 000 €.
            </p>
            <p>Si le compte contient déjà des titres, comptez leur prix d'achat dans l'apport, puis notez un <B>Achat</B> pour chaque titre, à sa vraie date et à son vrai prix. Sinon, les gains et les impôts seront faux.</p>
          </Step>
          <Step n={6} title="Programmez vos virements mensuels">
            <p>
              Dans <L to="/versements">Versements</L>, indiquez pour chaque compte le montant viré chaque mois et à partir de quand. Exemple : PEA, dès janvier, 150 € par mois.
            </p>
          </Step>
          <Step n={7} title="Choisissez votre répartition">
            <p>
              Dans <L to="/parametres?onglet=Répartition">Paramètres › Répartition</L>, indiquez la part visée pour chaque type de placement, par exemple 30 % d'actions et 50 % d'obligations. Le total doit faire 100 %. Hamac vous préviendra si vous vous en éloignez.
            </p>
          </Step>
          <Step n={8} title="Ajoutez vos biens et vos crédits" optional>
            <p>
              Dans <L to="/immobilier">Immobilier</L> et <L to="/credits">Crédits</L>, pour voir votre patrimoine net.
            </p>
          </Step>
        </ol>
      </Section>

      <Part title="Au fil des mois" intro="Quelques minutes de temps en temps suffisent." />

      <Section id="journal" title="Noter une opération">
        <p>
          Chaque événement sur un compte fait une ligne dans le <L to="/journal">Journal</L>. Cliquez sur « Nouvelle opération », puis choisissez le compte et le type.
        </p>
        <Rows
          head={["Ce qui s'est passé", "Compte et type d'opération", "Montant à indiquer"]}
          rows={[
            ["J'ai ajouté de l'argent en plus de mes virements", "Le compte · Versement", "La somme versée"],
            ["J'ai retiré de l'argent", "Le compte · Retrait", "La somme retirée"],
            ["J'ai déplacé de l'argent entre deux comptes", "Le compte de départ · Transfert, puis le compte d'arrivée", "La somme (une seule ligne)"],
            ["J'ai acheté des parts d'ETF ou des actions", "Le compte · Achat, avec le titre et la quantité", "Le total payé, frais compris"],
            ["J'ai vendu des titres", "Le compte · Vente, avec le titre et la quantité", "Le total reçu, frais déduits"],
            ["J'ai reçu des intérêts ou un coupon", "Le compte · Intérêts / coupon", "Ce qui est arrivé sur le compte"],
            ["J'ai reçu un dividende", "Le compte · Dividende", "Ce qui est arrivé sur le compte"],
            ["On m'a facturé des frais à part", "Le compte · Frais", "La somme prélevée"],
            ["La valeur réelle diffère de celle de Hamac", "Le compte · Correction", "L'écart, négatif si besoin"],
          ]}
        />
        <p>
          <B>À retenir :</B> les montants sont toujours positifs, car le type d'opération indique déjà le sens. Seule une correction peut être négative. Les frais d'achat et de vente se calculent seuls, et restent modifiables.
        </p>
      </Section>

      <Section id="import" title="Importer un relevé">
        <p>
          Pour éviter de tout saisir, le bouton « Importer » du <L to="/journal">Journal</L> lit les relevés de banque ou de courtier (fichiers CSV, OFX ou QIF). Choisissez le compte, vérifiez l'aperçu, puis importez les lignes cochées.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <B>Fichier CSV :</B> indiquez à quoi correspond chaque colonne. Hamac s'en souvient pour les prochains fichiers du même format.
          </li>
          <li>
            <B>Pas de doublon :</B> une opération déjà au journal est décochée. Un versement égal au montant programmé ce mois-là l'est aussi, car Hamac le compte déjà. Si son montant diffère, il n'est pas repéré : vérifiez-le.
          </li>
          <li>
            <B>Titre inconnu :</B> associez-le à un titre existant ou créez-le depuis l'aperçu. Les obligations s'ajoutent dans Paramètres › Actifs.
          </li>
        </ul>
      </Section>

      <Section id="versements" title="Vos virements mensuels">
        <p>
          Chaque mois écoulé est compté comme versé, sans rien saisir. Si un virement n'a pas eu lieu, déclarez-le comme mois manqué dans <L to="/versements">Versements</L>. Si le montant change, ajoutez le nouveau montant à partir du mois concerné : les mois précédents ne bougent pas.
        </p>
        <p>Deux façons de décider des montants :</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <B>Gestion libre :</B> vous fixez le montant de chaque compte.
          </li>
          <li>
            <B>Gestion suggérée :</B> vous indiquez ce que vous pouvez épargner par mois, et Hamac propose un montant par compte. Il sert d'abord vos allocations personnalisées, puis vos livrets s'ils sont sous le plancher, puis les placements en retard sur votre répartition. Un bouton applique ces montants à partir du mois choisi.
          </li>
        </ul>
      </Section>

      <Section id="calendrier" title="Que faire, et quand">
        <Rows
          firstNowrap
          head={["Quand", "Quoi faire", "Où"]}
          rows={[
            ["Tous les 2 à 3 mois", "Acheter des ETF avec les espèces du PEA (montant conseillé sur le Tableau de bord), puis noter l'achat", "Courtier, puis Journal"],
            ["En janvier", "Noter les intérêts de l'année écoulée des livrets et du fonds euros, datés du 31/12 (une alerte vous le rappelle)", "Journal"],
            ["En janvier", "Noter le taux servi par le fonds euros, et vérifier sa valeur sur le site de l'assureur", "Fonds euros"],
            ["En janvier", "Acheter une obligation avec les espèces du compte-titres (une alerte vous l'indique)", "Courtier, puis Journal"],
            ["Février et août", "Mettre à jour le taux des livrets s'il a changé", "Paramètres › Comptes"],
            ["À chaque coupon", "Noter le coupon reçu", "Journal"],
            ["Quand ça arrive", "Changement de virement, mois manqué, retrait, versement exceptionnel", "Versements, Journal"],
            ["Quand c'est prévu", "Projet à financer (voiture, apport, travaux) : sa somme, sa date et les comptes qui le financent", "Projets"],
            ["Si vous préparez votre retraite", "Dépense imprévue à provisionner dans la projection (réparation, santé)", "Projection"],
            ["De temps en temps", "Actualiser l'estimation de vos biens et le capital restant dû d'après un relevé", "Immobilier, Crédits"],
            ["Si besoin", "Saisir le cours d'un titre non récupéré automatiquement", "Actions & ETF (cliquer sur le cours)"],
          ]}
        />
      </Section>

      <Section id="resultats" title="Où lire vos résultats">
        <Rows
          firstNowrap
          head={["Page", "Ce que vous y trouvez"]}
          rows={[
            [<L to="/" key="d">Tableau de bord</L>, "Votre patrimoine, votre répartition et les points à regarder. Commencez par là."],
            [<L to="/performance" key="p">Performance</L>, "Ce que votre argent a réellement rapporté, enveloppe par enveloppe, sa plus forte baisse et ses variations (volatilité), et sa comparaison avec un ETF ou un autre titre, même sans le détenir."],
            [<L to="/exposition" key="x">Exposition réelle</L>, "Ce que contiennent vraiment vos actions et ETF : pays, secteurs, devises et plus grosses lignes."],
            [<L to="/projection" key="j">Projection</L>, "Votre patrimoine à la retraite et le revenu mensuel possible."],
            [<L to="/historique" key="h">Historique</L>, "Où en était votre patrimoine à une date, ce qui a changé depuis, et si vous êtes en avance sur votre plan."],
            [<L to="/projets" key="o">Projets</L>, "Ce que vous préparez : la somme réunie pour chaque projet, l'avance ou le retard, et ce qu'il faut mettre de côté chaque mois."],
            [<L to="/simulateurs" key="m">Simulateurs</L>, "Avant d'investir : ce qu'un placement rapporterait avant et après impôts, et plusieurs placements côte à côte."],
            [<L to="/enveloppes" key="s">Synthèse</L>, "Tous vos comptes côte à côte, et ce qui est garanti si un établissement fait faillite."],
          ]}
        />
        <p>Pour voir l'évolution d'un compte, cliquez sur sa ligne (Synthèse, Livrets, Crowdlending) ou sur « Évolution » dans les blocs Fonds euros, Actions et Crypto. Pour un titre seul, cliquez sur sa ligne. Sur le graphique, cliquez sur un nom de la légende pour masquer sa courbe.</p>
        <p>
          <B>Projets.</B> Dans <L to="/projets">Projets</L>, notez ce que vous préparez : la somme, la date, et les comptes où vous mettez l'argent de côté, soit en pourcentage du compte (la somme suit sa valeur), soit en montant réservé. Hamac montre la somme réunie, si vous êtes en avance ou en retard, et ce qu'il faut mettre de côté chaque mois, au rendement que vous indiquez sur le projet (0 % par défaut). Il prévient si l'échéance approche alors que l'argent est en actions ou en crypto, et si un compte est affecté à plus que ce qu'il contient.
        </p>
        <p>
          <B>Concentration.</B> La Synthèse montre aussi ce qui pèse le plus dans votre patrimoine financier : chaque titre (tous comptes confondus), chaque émetteur d'obligations, chaque plateforme de crowdlending avec ses projets en retard ou en défaut, et chaque établissement. Au-delà de 20 % sur un seul titre, émetteur ou plateforme, le tableau de bord vous le signale ; le seuil se règle dans Paramètres › Plan. Les obligations de l'État français ne déclenchent pas d'alerte.
        </p>
        <p>
          <B>Exposition réelle.</B> Un ETF MSCI World, c'est environ 70 % d'actions américaines : la page <L to="/exposition">Exposition réelle</L> le montre, d'après la composition publiée par Amundi ou iShares, que Hamac récupère dès que vous choisissez l'ETF (il suffit de son ISIN) et met à jour chaque trimestre. Un ETF synthétique, comme la plupart des ETF « monde » ou « États-Unis » du PEA, publie le panier d'actions européennes qu'il détient, pas l'exposition qu'il donne : choisissez alors un ETF physique qui suit le même indice, Hamac vous en propose un et reprend sa composition. Faites de même pour un ETF d'un autre émetteur. Le premier équivalent choisi sur l'instance est proposé aux autres utilisateurs, qui peuvent en choisir un autre pour eux seuls. Une action détenue en direct compte pour le pays de son ISIN.
        </p>
        <p>
          <B>Protection en cas de faillite.</B> La Synthèse compare ce que vous avez chez chaque établissement aux garanties légales : 100 000 € de dépôts par banque, 100 000 € de plus pour Livret A, LDDS et LEP, 70 000 € de titres, 70 000 € par assureur pour l'assurance-vie et le PER. Le plafond vaut par établissement agréé, pas par marque : sur la fiche d'un établissement (Paramètres › Établissements), indiquez l'établissement garant s'il diffère, et son pays. Pour l'assurance-vie, c'est l'assureur de l'offre qui compte.
        </p>
      </Section>

      <Part title="Selon ce que vous possédez" intro="Ouvrez seulement ce qui vous concerne." />

      <Fold id="livrets" title="Livrets et fonds euros">
        <p>Ces placements demandent très peu de suivi. Chaque janvier, notez dans le Journal les intérêts de l'année écoulée, datés du 31/12, tels qu'ils sont arrivés sur le compte.</p>
        <p>
          Pour le fonds euros, notez aussi le taux servi dans la page <L to="/fonds-euros">Fonds euros</L>. Si vous avez un excédent sur vos livrets, un <B>Transfert</B> vers l'assurance-vie le déplace en une seule ligne.
        </p>
      </Fold>

      <Fold id="etf" title="Actions et ETF">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>L'argent arrive sur le compte, par un virement programmé ou un versement. Il attend alors en espèces.</li>
          <li>Tous les 2 à 3 mois, achetez chez votre courtier. Le Tableau de bord vous conseille un montant.</li>
          <li>
            Notez un <B>Achat</B> dans le Journal, avec le titre, la quantité et le total payé. Exemple : 41 parts, 1 203,50 € frais compris.
          </li>
        </ol>
        <p>Les cours se mettent à jour tout seuls, et les gains se calculent automatiquement.</p>
      </Fold>

      <Fold id="obligations" title="Obligations">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Regardez les espèces disponibles : alerte du Tableau de bord ou page <L to="/obligations">Obligations</L>.
          </li>
          <li>Achetez chez le courtier une obligation d'État (OAT) ou d'entreprise. Si vous préparez votre retraite, choisissez une échéance avant votre âge de départ.</li>
          <li>Ajoutez le titre dans Paramètres › Actifs : la recherche par ISIN remplit le coupon et l'échéance.</li>
          <li>Notez l'achat dans le Journal : nominal, prix en % du nominal (par exemple 96,40) et frais. Le montant, le rendement et la valeur se calculent seuls.</li>
          <li>Si le coupon ne tombe pas à la date anniversaire de l'échéance, indiquez sa date sur la fiche du titre.</li>
          <li>Chaque année, notez le coupon reçu. À l'échéance, le nominal revient tout seul dans les espèces du compte-titres.</li>
          <li>Pour une retraite : avant l'âge de sécurisation, rachetez une obligation plus longue ; après, transférez le capital vers le fonds euros. Sinon, placez le capital là où votre répartition est en retard.</li>
        </ol>
        <p>
          <B>Le coupon n'est pas le rendement.</B> Une obligation à 3,5 % achetée à 96 % rapporte plus de 3,5 % par an, car l'émetteur rembourse 100 % à l'échéance.
        </p>
      </Fold>

      <Fold id="crypto" title="Crypto">
        <Rows
          head={["Ce qui s'est passé", "À noter sur le compte crypto"]}
          rows={[
            ["J'ai envoyé des euros sur la plateforme", "Versement"],
            ["J'ai acheté une crypto", "Achat, avec la quantité reçue"],
            ["J'ai vendu contre des euros", "Vente"],
          ]}
        />
        <p>La crypto compte dans votre patrimoine, mais reste par défaut hors de la répartition et de la projection.</p>
        <p>
          <B>Côté impôts :</B> seules les ventes contre des euros sont imposables, et seulement si le total des ventes de l'année dépasse 305 €. Pour des cryptos déjà détenues, notez ce que vous avez réellement payé, au plus près des dates d'achat : sinon la plus-value et l'impôt seront faux.
        </p>
      </Fold>

      <Fold id="crowdlending" title="Crowdlending">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Créez la plateforme dans Paramètres › Établissements, puis un compte de crowdlending rattaché à elle.</li>
          <li>
            Notez l'argent déposé sur la plateforme en <B>Versement</B> dans le Journal.
          </li>
          <li>
            Ajoutez chaque projet dans <L to="/crowdlending">Crowdlending</L> : montant, taux, durée, type de remboursement. Investir sort l'argent des espèces, et le capital remboursé y revient.
          </li>
          <li>Déclarez les intérêts avec le bouton « Déclarer les intérêts du mois » : un seul montant brut pour toute la plateforme, paiements partiels compris.</li>
        </ol>
        <p>
          <B>Avec Bricks :</B> le bouton « Importer un fichier Bricks » lit l'export des transactions (.xlsx) et propose seulement ce qui est nouveau ou a changé. Complétez le taux et la durée des projets importés pour obtenir le taux moyen et les échéances.
        </p>
        <p>
          <B>Si un projet dépasse son échéance,</B> une alerte apparaît. Indiquez s'il est remboursé, en retard ou en défaut, ou sa nouvelle date dans « Échéance prolongée au ». En retard, ses mensualités ne sont plus comptées comme remboursées. En défaut, il compte pour 0 € jusqu'à ce que vous saisissiez le montant espéré.
        </p>
        <p>
          <B>Côté impôts :</B> sur la fiche de la plateforme (rubrique Fiscalité), cochez « L'établissement prélève les impôts sur les intérêts et dividendes » et, s'ils diffèrent du prélèvement forfaitaire, indiquez les taux. Les impôts sont alors calculés à la déclaration des intérêts bruts et notés sur une seconde ligne du Journal, comme sur le relevé de la plateforme : vous savez ce qui a déjà été payé. Sans cette case, l'impôt est affiché à payer. La déduction des pertes n'est pas calculée.
        </p>
        <p>La page affiche le rendement réel de chaque plateforme à partir d'un an d'historique, pertes et argent non investi compris. Le crowdlending reste hors répartition par défaut, et n'entre dans la projection que si sa classe est incluse avec un rendement attendu.</p>
      </Fold>

      <Fold id="immobilier" title="Immobilier et SCPI">
        <p>
          <B>Un bien immobilier</B> se saisit dans <L to="/immobilier">Immobilier</L>, avec sa valeur estimée et la part que vous détenez (50 % pour un bien à deux). Il s'ajoute au patrimoine net et reste hors répartition, sauf si vous cochez le contraire.
        </p>
        <p>
          Indiquez aussi son utilisation, son statut (nom propre, indivision, SCI…) et ses frais d'achat. Les <B>frais de notaire</B> sont estimés d'après le prix, la date d'achat et l'état du bien (neuf ou ancien), avec le taux de droits de mutation le plus courant : comparez-les à votre acte et corrigez-les si besoin. Le bouton « Fiche du bien » ouvre sa présentation complète : caractéristiques, DPE, rentabilité et documents. Cliquez sur son nom pour accéder à son suivi : location et finances.
        </p>
        <p>
          <B>Usufruit et nue-propriété.</B> Sur la fiche du bien, choisissez le droit détenu et la date de naissance de l'usufruitier (ou la fin de l'usufruit s'il est à durée fixe). Le bien compte alors dans le patrimoine selon le barème fiscal (article 669 du CGI) : par exemple, avec un usufruitier de 61 à 70 ans, l'usufruit vaut 40 % du bien et la nue-propriété 60 %. La valeur évolue avec son âge.
        </p>
        <p>
          <B>Biens détenus par une SCI.</B> Créez la société dans la carte « Sociétés (SCI) » de la page Immobilier avec la part de ses parts que vous détenez, puis rattachez-lui ses biens (statut « SCI »). Les biens et leurs crédits comptent pour la part de vos parts ; la carte montre l'actif net de la société et ce que valent vos parts.
        </p>
        <p>
          <B>Un compte joint</B> (compte-titres, livret bancaire, crypto) se saisit en entier, avec la part que vous détenez sur sa fiche. Seule votre part compte dans le patrimoine net, la répartition et la protection en cas de faillite.
        </p>
        <p>
          La fiche se complète depuis cette fenêtre, quand vous le souhaitez. En tapant l'adresse, votre navigateur interroge la Base Adresse Nationale (service de l'IGN) pour proposer des suggestions : seul ce que vous tapez dans ce champ lui est envoyé. Adresse, surface, caractéristiques et DPE : tout est facultatif. Une case permet d'être alerté avant l'expiration du DPE et, pour un bien en location, si sa note interdit de le louer.
        </p>
        <p>
          <B>Un investissement locatif</B> a en plus son suivi sur cette fiche. Choisissez d'abord son mode de location : vide, meublé, colocation avec un bail pour tous, ou colocation avec un bail par chambre. La carte « Lots » liste ce qui se loue : le logement, chaque chambre en colocation par chambre, et les annexes louées à part (parking, cave). Un loyer espéré facultatif sur chaque lot sert à mesurer l'occupation et ce que coûte un lot vide. Un lot qui a eu des baux ne se supprime pas : il s'archive. Déclarez ensuite le bail de chaque lot, avec ses locataires (repris d'un bail à l'autre) et ses garanties : caution d'une personne, Visale, assurance loyers impayés, caution bancaire. Son type propose la durée et calcule le dépôt de garantie, tous deux modifiables. Sans congé, le bail se reconduit tout seul. Un congé se note dans le bail. Si la case des rappels est cochée, le tableau de bord prévient deux mois à l'avance de la fin du bail et du dernier jour pour donner congé : 6 mois avant la fin en location vide, 3 mois en meublé.
        </p>
        <p>
          Un loyer n'est reçu que lorsqu'il est pointé. « Reçu », sur la ligne d'un mois, enregistre le reste dû ; « Détail » note une somme partielle, son moyen de paiement (virement, chèque, aide au logement versée par la CAF…), ou remet le mois au locataire (mois offert, franchise après travaux). « Valider l'année » rattrape d'un coup les mois échus d'une année. Passé 10 jours après le jour d'échéance prévu au bail, un loyer non pointé est signalé au tableau de bord. La carte du bail propose alors l'étape de relance (rappel amiable, relance, puis mise en demeure, à 10, 20 et 30 jours par défaut, réglables dans Paramètres › Plan) et prépare le courrier avec le décompte des sommes dues ; « Noter l'envoi » garde la date. Le lien « Avis » d'un mois prépare l'avis d'échéance, et « Attestation de loyer » l'attestation à remettre au locataire. Ces courriers sont une aide, à relire avant envoi. À l'approche de l'anniversaire du bail, l'onglet Location calcule la révision d'après l'indice de référence des loyers de l'INSEE (ceux de Corse et d'outre-mer selon le code postal). « Réviser le loyer » applique le nouveau montant et prépare le courrier au locataire, avec le détail du calcul. La révision ne prend effet qu'à sa demande, jamais avant l'anniversaire, et n'est possible que dans l'année qui suit ; elle est interdite pour une note DPE F ou G. Un autre changement de loyer se note avec « Nouveau loyer », pour ne pas réécrire les mois passés. Les dépenses se notent à part, avec l'option « chaque année » pour la taxe foncière ou l'assurance. La carte « Autres recettes » reçoit la régularisation annuelle des charges et les indemnités. À la sortie du locataire, notez le dépôt rendu dans le bail : une retenue compte comme une recette.
        </p>
        <p>
          <B>La page Gestion locative</B> regroupe tout le parc loué : les loyers du mois, avec « Valider le mois » pour pointer d'un coup ceux qui sont arrivés, les loyers non reçus bail par bail, les lots vides et les loyers qu'ils font perdre, l'occupation (jours loués, et loyers reçus sur ceux que les lots pouvaient rapporter), le délai moyen de relocation, les rendements, et toutes les dates à venir : révisions, fins de bail, congés, dépôts à rendre, assurances, garanties, documents, DPE et dépenses annuelles. « Nouveau rappel » y ajoute une date à vous, une fois ou chaque année : assemblée générale, entretien de la chaudière.
        </p>
        <p>
          Les dépenses et travaux se notent sur tout bien, dans l'onglet Finances. Cochez « Améliore le bien » pour un agrandissement ou une rénovation : le montant s'ajoute au coût pour calculer le gain et le rendement. Chaque nouvelle estimation est gardée, et la page Historique montre le patrimoine net dans le temps, biens et crédits compris. Le bouton « Vendre » retire le bien du patrimoine à la date de vente, solde ses crédits et affiche le bilan.
        </p>
        <p>
          Sur la fiche, le registre des documents note où se trouve chaque papier et prévient avant une date d'expiration ; Hamac ne stocke pas les fichiers. Depuis la fiche, « Imprimer » donne une version à imprimer ou à enregistrer en PDF, et le lien « Quittance » de chaque mois prépare la quittance, ou un reçu pour un paiement partiel.
        </p>
        <p>
          Les résultats par année sont calculés pour votre part et avant impôt. Ce suivi reste séparé de vos comptes : il ne change pas le patrimoine financier, et un loyer versé sur un livret suivi dans Hamac se note aussi dans le Journal. L'impôt sur les loyers n'est pas calculé, et ces revenus n'entrent pas dans la projection.
        </p>
        <p>
          <B>Une SCPI</B> se crée comme un actif (type SCPI), puis s'achète dans le Journal sur un compte-titres, une assurance-vie ou un PER. Les loyers se notent en <B>Dividende</B>, et son prix se saisit à la main. Elle compte dans le patrimoine financier, reste hors répartition par défaut, et n'entre dans la projection que si sa classe est incluse avec un rendement attendu. L'impôt sur ses revenus n'est pas calculé.
        </p>
      </Fold>

      <Fold id="biens" title="Or, objets, véhicules, argent prêté">
        <p>
          Dans <L to="/autres-biens">Autres biens</L>, ajoutez ce qui n'est ni un compte ni de l'immobilier : pièces et lingots, bijoux et objets d'art, véhicules, parts d'une société non cotée, compte courant d'associé, argent prêté à un proche. Chacun a sa valeur estimée et la part que vous détenez ; des parts de société peuvent aussi être détenues en usufruit ou en nue-propriété. Ils s'ajoutent au patrimoine net ; ils n'entrent dans la répartition que si vous leur donnez une classe d'actifs.
        </p>
        <p>
          Pour une voiture, une <B>baisse de valeur par an</B> fait vieillir l'estimation toute seule. Pour une somme prêtée avec un échéancier, la somme encore due se calcule comme le capital restant d'un crédit. La <B>décote en cas de vente rapide</B> et le <B>délai</B> montrent ce que vous récupéreriez vite. Une nouvelle estimation se note en dépliant la ligne : les précédentes restent dans l'historique.
        </p>
        <p>
          <B>L'impôt à la vente</B> est estimé au régime le plus avantageux : pour l'or, la taxe forfaitaire de 11,5 % du prix, ou l'impôt sur la plus-value (19 % plus les prélèvements sociaux, avec un abattement de 5 % par an au-delà de deux ans, rien après 22 ans) si vous pouvez prouver le prix et la date d'achat ; pour les bijoux et objets d'art, 6,5 % du prix, rien en dessous de 5 000 €. Les voitures sont exonérées. C'est une estimation, sans valeur officielle.
        </p>
      </Fold>

      <Fold id="credits" title="Crédits">
        <p>
          Dans <L to="/credits">Crédits</L>, indiquez le type de crédit, le montant emprunté, le taux, la durée, la première échéance et l'assurance, comme dans votre contrat. Hamac calcule la mensualité, le capital restant dû, le coût total et la date de fin. Cliquez sur un crédit pour voir le détail année par année.
        </p>
        <p>L'assurance se saisit en montant fixe par mois, ou en taux annuel appliqué au capital emprunté ou au capital restant dû. Seuls les crédits immobiliers et travaux peuvent être rattachés à un bien.</p>
        <p>Si vous remboursez à plusieurs et que le montant saisi est le crédit entier, indiquez votre « Part à ma charge » : le patrimoine net et les mensualités ne comptent que cette part.</p>
        <p>Un différé se saisit dans le crédit. Pour un remboursement anticipé, ouvrez le détail du crédit : indiquez le montant, l'indemnité éventuelle, et si vous réduisez la durée ou la mensualité. Les crédits archivés restent listés sous le tableau, pour pouvoir les rétablir. Si la banque indique d'autres chiffres, saisissez la mensualité ou le capital restant dû d'un relevé, avec sa date : le calcul repart de là. Un crédit renouvelable, sans échéancier fixe, se saisit en « autre » et se corrige à la main.</p>
              <p>
          <B>Poids des crédits.</B> Sous la liste, Hamac montre la part du patrimoine financée à crédit, la part de chaque bien encore due à la banque, le taux réel de chaque crédit assurance comprise et ce qu'il reste à payer en intérêts et en assurance. Indiquez vos revenus nets dans Paramètres › Plan pour voir votre taux d'effort : les banques prêtent en général jusqu'à 35 % des revenus, assurance comprise.
        </p>
        <p>
          <B>Rembourser par avance ou placer ?</B> Choisissez un crédit, la somme disponible et un placement de comparaison (prérempli d'après vos hypothèses, après impôts). Hamac compare, à la fin prévue du crédit, ce que vous aurez dans les deux cas : en remboursant, les échéances économisées sont placées au même rendement ; en plaçant, la somme travaille d'un coup. L'indemnité de la banque est préremplie au plafond légal (crédit immobilier : 6 mois d'intérêts, au plus 3 % du capital restant dû) ; mettez 0 si votre contrat l'exclut. Rembourser rapporte un taux certain, placer un rendement espéré : gardez une épargne de précaution.
        </p>
      </Fold>

      <Fold id="autres" title="PEA-PME, PER, épargne salariale">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <B>PEA-PME :</B> un seul par personne, mêmes règles fiscales et mêmes frais que le PEA.
          </li>
          <li>
            <B>PER :</B> l'impôt affiché au retrait suppose une sortie en capital et des versements déduits de vos revenus à l'entrée. Le capital est imposé à votre tranche, les gains au prélèvement forfaitaire.
          </li>
          <li>
            <B>Épargne salariale (PEE, PERCO) :</B> seuls les prélèvements sociaux s'appliquent aux gains.
          </li>
          <li>Dans la projection, les versements sur un PER ou une épargne salariale suivent le rendement du fonds euros.</li>
        </ul>
      </Fold>

      <Part title="Aller plus loin" intro="Rien d'obligatoire ici : les réglages par défaut conviennent pour commencer." />

      <Fold id="repartition" title="Affiner sa répartition">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <B>Ma répartition cible :</B> une ligne par type de placement que vous détenez, avec sa part visée et son rendement attendu. Une classe sans rendement n'entre pas dans la projection, et l'immobilier physique n'y entre jamais.
          </li>
          <li>
            <B>Inclure ou exclure :</B> chaque type de placement peut être dans la répartition ou en dehors. Une exception reste possible sur un compte, un titre, un bien ou un projet, par exemple pour inclure seulement le Livret A. Ce qui est exclu compte toujours dans le patrimoine.
          </li>
          <li>
            <B>Créer un type de placement :</B> « Ajouter une classe » dans le même tableau, par exemple « Métaux précieux », puis choisissez la classe de chaque titre dans Paramètres › Actifs.
          </li>
          <li>
            <B>Allocations personnalisées :</B> pour orienter une part des versements vers un compte ou un type de compte, éventuellement jusqu'à une limite. Une fois la limite atteinte, cette part va à la ligne choisie, sinon aux autres au prorata.
          </li>
        </ul>
      </Fold>

      <Fold id="cours" title="Les cours de bourse">
        <p>Hamac actualise les cours tout seul, sans rien vous demander. Si un cours manque, saisissez-le à la main : il n'est jamais écrasé le même jour. Le prix des SCPI se saisit toujours à la main.</p>
        <p>Pour les curieux : Hamac essaie les sources dans l'ordre choisi (Paramètres › Cours) jusqu'à ce que l'une réponde : justETF, Euronext, Twelve Data, puis Yahoo en dernier recours, et CoinGecko pour la crypto. Un cours qui s'écarte de plus de 25 % de celui d'une autre source est écarté. L'onglet Cours montre quelle source a répondu pour chaque titre.</p>
        <p>Depuis sa fiche, un titre peut imposer sa source ou une adresse personnalisée. La clé Twelve Data est facultative et se règle sur le serveur, dans le fichier .env. Son offre gratuite ne couvre que les titres américains.</p>
      </Fold>

      <Fold id="impots" title="Impôts et déclaration">
        <p>
          La page <L to="/impots">Impôts</L> estime ce que vous devriez si vous retiriez tout aujourd'hui, compare les rendements après impôts, et détaille les impôts de chaque année. Ce sont des estimations, à comparer avec votre déclaration pré-remplie.
        </p>
        <p>
          La page <L to="/declaration">Aide à la déclaration</L> indique ce qu'il faut reporter, dans quelle case et d'après quelles opérations. C'est un document d'aide : il ne remplace ni l'IFU de votre établissement ni la notice officielle, et vous restez responsable de votre déclaration.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <B>Si un établissement ne transmet rien au fisc,</B> cochez « Hamac rédige le récapitulatif fiscal » sur sa fiche (Paramètres › Établissements). Ses montants sont alors à saisir sur votre déclaration. Sans la case, ils sont seulement à contrôler avec son IFU, pour ne pas les déclarer deux fois.
          </li>
          <li>
            <B>Pour un dividende ou des intérêts,</B> vous pouvez noter le brut et les retenues lus sur le relevé. Sinon, Hamac utilise les taux de Paramètres › Plan. Si un établissement retient autre chose, indiquez seulement le taux qui diffère sur sa fiche, et 0 s'il ne retient rien.
          </li>
          <li>
            <B>Pour vérifier,</B> recopiez sur la fiche de l'établissement les montants de son document fiscal : l'écart apparaît case par case. Le récapitulatif complet regroupe tous vos comptes.
          </li>
        </ol>
        <p>Chaque document indique l'année de validité de ses règles. Si une année n'a pas encore été vérifiée, c'est signalé, et ses numéros de case sont seulement indicatifs.</p>
        <p>
          <B>Liste de fin d'année.</B> En bas de la page <L to="/impots">Impôts</L>, une liste repliée chiffre ce qui ne se fait que jusqu'au 31 décembre : vendre des titres en perte du compte-titres pour compenser les plus-values de l'année, utiliser l'abattement de l'assurance-vie par un retrait partiel, verser sur un PER dans la limite de votre plafond, remplir les plafonds encore libres, préparer la déclaration du printemps. Dépliez-la pour la lire ; en novembre et en décembre, le tableau de bord la rappelle. Cochez ce qui est fait.
        </p>
        <p>
          <B>Compteurs et plafonds.</B> La page <L to="/compteurs">Compteurs et plafonds</L> rassemble ce qui avance avec le temps : la date des 5 ans de votre PEA et des 8 ans de chaque assurance-vie, les versements comparés au plafond du PEA (150 000 €) et du PEA-PME (225 000 € à eux deux), le solde de chaque livret face à son plafond, et vos versements PER de l'année si vous indiquez votre plafond de déduction (Paramètres › Plan). Pour l'assurance-vie, elle montre la part de l'abattement annuel déjà utilisée par vos retraits de l'année, et vos versements avant et après 70 ans.
        </p>
        <p>
          <B>Donations.</B> Notez les donations que vous faites ou recevez : pour chaque personne, Hamac montre l'abattement utilisé sur les 15 dernières années (100 000 € entre parent et enfant, 31 865 € pour un petit-enfant…), ce qu'il reste, le don familial de sommes d'argent encore possible et la date à laquelle l'abattement se renouvelle. Les présents d'usage ne comptent pas.
        </p>
      </Fold>

      <Fold id="donnees" title="Vos données et sauvegardes">
        <p>Vos données restent sur votre serveur, isolées de celles des autres comptes. Une copie est faite automatiquement avant chaque mise à jour de la base.</p>
        <p>
          Pour garder une copie chez vous, utilisez « Exporter une sauvegarde » dans <L to="/parametres?onglet=Application">Paramètres › Application</L>.
        </p>
      </Fold>

      <Fold id="securite" title="Protéger votre compte">
        <p>
          Vos données financières méritent mieux qu'un mot de passe, qui peut être volé ou deviné. La double authentification demande en plus, à chaque connexion, un code à 6 chiffres affiché par une application sur votre téléphone. Elle n'est pas obligatoire, mais Hamac vous la recommandera tant qu'elle n'est pas active.
        </p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            <B>Pour l'activer,</B> ouvrez <L to="/parametres?onglet=Application">Paramètres › Application</L>, carte « Double authentification ». Installez une application de codes (Aegis, 2FAS, Google Authenticator, Microsoft Authenticator…), scannez le QR code, puis saisissez le code affiché.
          </li>
          <li>
            <B>Gardez vos codes de secours à l'abri.</B> Ils ne sont affichés qu'une seule fois, et chacun ne sert qu'une fois. Copiez-les ou téléchargez-les, par exemple dans un gestionnaire de mots de passe.
          </li>
          <li>
            <B>Si vous perdez votre téléphone,</B> cliquez sur « Utiliser un code de secours » à la connexion, puis désactivez et réactivez la protection avec votre nouveau téléphone.
          </li>
          <li>
            <B>Si vous n'avez plus aucun code,</B> demandez à la personne qui gère cette instance de désactiver la protection de votre compte.
          </li>
        </ol>
      </Fold>

      <Fold id="lexique" title="Les mots à connaître">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_1fr]">
          {LEXIQUE.map(([a, b]) => (
            <div key={a} className="contents">
              <dt className="text-fg">{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </Fold>
    </div>
  );
}
