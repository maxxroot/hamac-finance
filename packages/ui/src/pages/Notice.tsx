import type { ReactNode } from "react";
import { Link } from "react-router";
import { Table, Td, Th, Tr } from "@/components/table";
import { Card, PageHeader } from "@/components/ui";

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card className="mb-5">
      <h2 className="mb-3 text-base font-semibold">
        <span className="mr-2 text-accent">{n}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-fg-muted">{children}</div>
    </Card>
  );
}

const L = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="text-accent hover:underline">
    {children}
  </Link>
);

export function Notice() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="Notice" description="Comment utiliser Hamac." />

      <Section n={1} title="Le principe">
        <p>
          On note dans le <L to="/journal">Journal</L> ce qui se passe : argent qui arrive, achats, intérêts, retraits. Tout le reste se calcule : valeurs, plus-values, rendement, impôts, projection, alertes. Les
          versements mensuels automatiques se programment une fois dans <L to="/versements">Versements</L> ; chaque mois écoulé est compté comme versé, sauf s'il est déclaré manqué.
        </p>
        <p>Vos données restent sur votre serveur, isolées de celles des autres comptes. Une copie est faite automatiquement avant chaque mise à jour de la base ; pour une copie à garder chez vous, exportez une sauvegarde (Paramètres › Application).</p>
        <p>
          Hamac s'adapte à votre usage. Dans <L to="/parametres">Paramètres › Plan</L>, choisissez de préparer votre retraite ou seulement de gérer votre patrimoine (sans projection, avec une allocation fixe), et masquez les pages dont vous n'avez pas besoin avec les modules : aucun calcul ne change.
        </p>
      </Section>

      <Section n={2} title="Démarrage : ce qu'on règle une seule fois">
        <Table>
          <thead>
            <tr>
              <Th>Où</Th>
              <Th>Quoi</Th>
              <Th>Exemple</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Paramètres › Plan", "Usage : préparer sa retraite (projection, baisse des actions avec l'âge) ou gérer son patrimoine (allocation fixe, sans projection)", "Préparer ma retraite"],
              ["Paramètres › Plan", "Modules : les pages à garder dans le menu", "Crypto masquée"],
              ["Paramètres › Plan", "Année de naissance et, pour la retraite : âge de départ, âge de sécurisation (début de la baisse des actions), âge horizon (jusqu'où l'argent doit durer)", "1990 · 64 · 57 · 90"],
              ["Paramètres › Plan", "Premier mois et jour des versements, inflation", "janvier 2027 · le 5 · 2 %"],
              ["Paramètres › Plan", "Plancher et plafond des livrets, tranche d'imposition", "7 500 € · 15 000 € · 11 %"],
              ["Paramètres › Répartition", "Ma répartition cible : la part visée et le rendement attendu de chaque classe, la part actions au départ pour une retraite, le seuil d'alerte de rééquilibrage", "actions 30 % · obligations 50 % · alerte à 5 %"],
              ["Paramètres › Établissements", "Votre banque, votre courtier, votre assurance-vie : comptes proposés et grille de frais (paliers de courtage, droits de garde, frais sur versements et de gestion)", "jusqu'à 500 € : 1,99 € · au-delà : 0,5 %"],
              ["Paramètres › Comptes", "Chaque compte : livret, assurance-vie, PEA, PEA-PME, compte-titres, PER, épargne salariale ou plateforme crypto. Son établissement (qui fixe ses frais), sa date d'ouverture (règles des 5 et 8 ans), taux et plafond des livrets, clause bénéficiaire, dans ou hors allocation", "PEA ouvert le 15/03/2021"],
              ["Paramètres › Actifs", "Les ETF, actions, obligations, fonds, SCPI et cryptos détenus : recherche par nom ou ISIN, part cible de chaque ETF (total 100 %), classe d'actifs, dans ou hors allocation", "ETF monde · FR00… · 100 %"],
              ["Journal", "Un « Apport initial » par compte avec l'argent déjà là au départ", "LEP · Apport initial · 5 000 €"],
              ["Versements", "Le montant de chaque virement automatique, à partir de quel mois, ou votre capacité d'épargne en gestion suggérée", "PEA · dès janvier 2027 · 150 €/mois"],
              ["Immobilier, Crédits", "Vos biens et vos crédits en cours, pour obtenir le patrimoine net (facultatif)", "Appartement · 180 000 €"],
            ].map(([a, b, c]) => (
              <Tr key={b}>
                <Td className="whitespace-nowrap text-fg">{a}</Td>
                <Td>{b}</Td>
                <Td className="text-fg-faint">{c}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section n={3} title="Le journal : la seule saisie du quotidien">
        <p>Une ligne = un événement. Les montants sont toujours positifs : le type d'opération donne le sens (seule une correction peut être négative). Les frais d'achat et de vente se calculent seuls d'après la grille de l'établissement du compte, et restent modifiables.</p>
        <Table>
          <thead>
            <tr>
              <Th>Exemple</Th>
              <Th>Compte · opération</Th>
              <Th>Montant</Th>
              <Th>Quantité</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Achat de 41 parts d'ETF", "PEA · Achat (titre : l'ETF)", "1 203,50 € (frais compris)", "41"],
              ["Passer le PEA à 150 €/mois en mars", "Versements › À partir de mars : 150 €", "—", "—"],
              ["Retrait pour la voiture", "LDDS · Retrait", "8 000 €", "—"],
              ["Intérêts du fonds euros", "Assurance-vie · Intérêts, daté du 31/12", "312,40 € (tels que crédités)", "—"],
              ["Excédent des livrets vers le fonds euros", "LDDS · Transfert vers Assurance-vie (une seule ligne)", "2 000 €", "—"],
              ["Achat d'une obligation", "Compte-titres · Achat (titre : l'obligation)", "nominal × prix % + frais, calculé", "nominal, ex. 3 000"],
              ["Coupon d'une obligation", "Compte-titres · Intérêts / coupon", "net reçu", "—"],
              ["Valeur réelle différente du calcul", "Le compte · Correction", "l'écart, négatif possible", "—"],
            ].map(([a, b, c, d]) => (
              <Tr key={a}>
                <Td className="text-fg">{a}</Td>
                <Td>{b}</Td>
                <Td>{c}</Td>
                <Td>{d}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section n={4} title="Importer un relevé">
        <p>
          Depuis le <L to="/journal">Journal</L>, le bouton « Importer » accepte les relevés de banque ou de courtier aux formats CSV, OFX et QIF. Choisissez le compte concerné, vérifiez l'aperçu, puis importez les lignes cochées. En CSV, indiquez à quoi correspond chaque colonne : votre choix est retenu pour les prochains fichiers de même format.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b className="text-fg">Déjà au journal :</b> une opération identique (date, type, montant, titre) est décochée, pour ne pas la compter deux fois.</li>
          <li><b className="text-fg">Déjà programmé :</b> un versement égal au montant programmé ce mois-là est décoché, car Hamac le compte déjà. Si le montant diffère, il n'est pas repéré : à vérifier.</li>
          <li><b className="text-fg">Titres non reconnus :</b> associez-les à un titre existant ou créez-les depuis l'aperçu. Les obligations s'ajoutent dans Paramètres › Actifs.</li>
        </ul>
      </Section>

      <Section n={5} title="Versements : gestion libre ou suggérée">
        <p>
          Dans <L to="/versements">Versements</L>, la <b className="text-fg">gestion libre</b> vous laisse fixer le montant de chaque compte. La <b className="text-fg">gestion suggérée</b> part de votre capacité d'épargne mensuelle et propose un montant par compte, dans cet ordre : vos allocations personnalisées, puis le matelas de précaution s'il est sous le plancher, puis l'allocation de base vers les classes d'actifs en retard sur leur cible. Un bouton applique ces montants à partir du mois choisi ; les mois précédents ne changent pas.
        </p>
      </Section>

      <Section n={6} title="Allocation : régler sa répartition">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b className="text-fg">Ma répartition cible</b> (Paramètres › Répartition) : une ligne par classe que vous détenez, avec sa cible et son rendement attendu. Le total doit faire 100 %. Une classe sans rendement renseigné n'entre pas dans la projection (l'immobilier physique n'y entre jamais).</li>
          <li><b className="text-fg">Dans ou hors allocation</b> : à régler classe par classe. Une exception reste possible sur chaque compte, titre, bien ou projet (par exemple inclure seulement le Livret A). Hors allocation, un élément reste compté dans le patrimoine.</li>
          <li><b className="text-fg">Vos propres classes</b> : « Ajouter une classe » dans le même tableau, par exemple « Métaux précieux », puis choisissez la classe de chaque titre dans Paramètres › Actifs.</li>
          <li><b className="text-fg">Allocations personnalisées</b> (Paramètres › Répartition) : une part des versements vers un compte ou un type de compte, éventuellement jusqu'à une limite. Une fois la limite atteinte, sa part va à la ligne choisie, sinon aux autres au prorata.</li>
        </ul>
      </Section>

      <Section n={7} title="Les cours">
        <p>
          Hamac actualise les cours tout seul. Pour chaque titre, il essaie les sources dans l'ordre choisi (Paramètres › Cours) jusqu'à ce que l'une réponde : justETF, Euronext, Twelve Data, puis Yahoo en dernier recours ; CoinGecko pour la crypto. Un cours qui s'écarte de plus de 25 % de celui d'une autre source est écarté (ligne en dollars, par exemple). L'onglet Cours montre quelle source a répondu pour chaque titre.
        </p>
        <p>
          La clé Twelve Data est facultative et se règle sur le serveur, dans le fichier .env : son offre gratuite ne couvre que les titres américains. Depuis sa fiche, un titre peut imposer sa source ou une adresse personnalisée. Le prix des SCPI se saisit à la main, et un cours saisi à la main n'est jamais écrasé le même jour.
        </p>
      </Section>

      <Section n={8} title="Calendrier des saisies">
        <Table>
          <thead>
            <tr>
              <Th>Quand</Th>
              <Th>Quoi faire</Th>
              <Th>Où</Th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Tous les 2 à 3 mois", "Acheter des ETF avec les espèces du PEA (montant conseillé sur le Tableau de bord), puis noter l'achat", "Courtier, puis Journal"],
              ["Janvier", "Noter les intérêts de l'année écoulée des livrets et du fonds euros, datés du 31/12 (une alerte le rappelle)", "Journal"],
              ["Janvier", "Noter le taux servi par le fonds euros, vérifier sa valeur sur le site de l'assureur", "Fonds euros"],
              ["Janvier", "Acheter une obligation avec les espèces du compte-titres (une alerte l'indique)", "Courtier, puis Journal"],
              ["Février et août", "Mettre à jour le taux des livrets s'il a changé", "Paramètres › Comptes"],
              ["À chaque coupon", "Noter le coupon reçu", "Journal"],
              ["Quand ça arrive", "Changement de versement mensuel, mois manqué, retrait, versement exceptionnel", "Versements, Journal"],
              ["Quand c'est prévu", "Grosse dépense future (voiture, travaux), si vous préparez votre retraite", "Projection"],
              ["De temps en temps", "Actualiser l'estimation de vos biens et le capital restant dû d'après un relevé", "Immobilier, Crédits"],
              ["Si besoin", "Cours d'un titre non récupéré automatiquement", "Actions & ETF (cliquer sur le cours)"],
            ].map(([a, b, c]) => (
              <Tr key={a + b}>
                <Td className="whitespace-nowrap text-fg">{a}</Td>
                <Td>{b}</Td>
                <Td className="text-fg-faint">{c}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section n={9} title="Acheter une obligation, pas à pas">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Regarder les espèces disponibles : alerte du Tableau de bord ou page <L to="/obligations">Obligations</L>.</li>
          <li>Acheter chez le courtier une obligation (OAT ou obligation d'entreprise), dont l'échéance tombe avant l'âge de départ si vous préparez votre retraite.</li>
          <li>
            Ajouter le titre dans Paramètres › Actifs : la recherche par ISIN pré-remplit le coupon et l'échéance.
          </li>
          <li>Saisir l'achat dans le Journal : nominal, prix en % du nominal (ex. 96,40) et frais. Le montant, le rendement à l'échéance et la valeur se calculent seuls.</li>
          <li>Chaque année, noter le coupon reçu. À l'échéance, le nominal revient automatiquement dans les espèces du compte-titres.</li>
          <li>Pour une retraite : avant l'âge de sécurisation, racheter une ligne plus longue ; après, transférer le capital vers le fonds euros. Sinon, racheter ou placer le capital là où l'allocation est en retard.</li>
        </ol>
        <p>
          <b className="text-fg">Le coupon n'est pas le rendement.</b> Une obligation à 3,5 % achetée à 96 % rapporte plus de 3,5 % par an, car l'émetteur rembourse 100 % à l'échéance.
        </p>
      </Section>

      <Section n={10} title="Crypto">
        <p>
          La crypto compte dans le patrimoine, l'historique et la performance, mais reste par défaut hors de l'allocation cible et de la projection. Les euros envoyés sur la plateforme sont un « Versement » sur le compte crypto ;
          un achat est un « Achat » du titre (Bitcoin…) avec la quantité reçue ; une vente contre des euros est une « Vente ».
        </p>
        <p>
          Seules les ventes contre des euros sont imposables. La plus-value de chaque vente est calculée selon la règle française (sur le portefeuille global), et l'impôt de l'année n'est dû que si le total des
          ventes dépasse 305 €. Pour des cryptos déjà détenues, noter ce qui a été réellement payé, daté au plus près des achats : sinon plus-value et impôt seront faux.
        </p>
      </Section>

      <Section n={11} title="Autres enveloppes">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><b className="text-fg">PEA-PME :</b> un seul par personne, mêmes règles fiscales et même grille de frais que le PEA.</li>
          <li><b className="text-fg">PER :</b> l'impôt affiché au retrait suppose une sortie en capital et des versements déduits à l'entrée (capital à votre tranche d'imposition, gains au prélèvement forfaitaire).</li>
          <li><b className="text-fg">Épargne salariale (PEE, PERCO) :</b> prélèvements sociaux seulement sur les gains.</li>
          <li>Dans la projection, les versements sur un PER ou une épargne salariale suivent le rendement du fonds euros.</li>
        </ul>
      </Section>

      <Section n={12} title="Immobilier et SCPI">
        <p>
          Dans <L to="/immobilier">Immobilier</L>, chaque bien a une valeur estimée et une part détenue (50 % pour un bien à deux). Il s'ajoute au patrimoine net et reste hors allocation cible, sauf si vous cochez le contraire.
        </p>
        <p>
          Une SCPI se crée comme un actif (type SCPI), puis s'achète dans le Journal sur un compte-titres, une assurance-vie ou un PER ; les loyers se notent en « Dividende ». Elle compte dans le patrimoine financier, reste hors allocation par défaut, et n'entre dans la projection que si sa classe est incluse avec un rendement attendu. L'impôt sur ses revenus n'est pas calculé.
        </p>
      </Section>

      <Section n={13} title="Crowdlending">
        <p>
          Créez chaque plateforme (Bricks, par exemple) dans Paramètres › Établissements, ajoutez-lui un compte de crowdlending, puis saisissez chaque projet dans <L to="/crowdlending">Crowdlending</L> : montant, taux, durée, type de remboursement. L'argent déposé sur la plateforme se note en « Versement » au <L to="/journal">Journal</L> ; investir dans un projet le sort des espèces, et le capital remboursé y revient. Les intérêts se déclarent avec le bouton « Déclarer les intérêts du mois » : un seul montant pour toute la plateforme, paiements partiels compris. La page affiche le rendement réel de chaque plateforme, pertes et argent non investi compris, à partir d'un an d'historique. Le bouton « Importer un fichier Bricks » lit l'export de transactions (.xlsx) et propose uniquement ce qui est nouveau ou a changé : réimporter le même fichier ne crée aucun doublon. Le taux et la durée d'un projet importé restent à compléter si vous voulez le taux moyen et les échéances.
        </p>
        <p>
          Un projet « En cours » dont l'échéance est passée déclenche une alerte : indiquez alors s'il est remboursé, en retard, en défaut, ou renseignez sa nouvelle date dans « Échéance prolongée au » si la plateforme l'a repoussée. En retard, ses mensualités cessent d'être comptées comme remboursées ; si la plateforme indique un autre chiffre, saisissez le capital déjà remboursé. Un projet en défaut compte pour 0 € dans le patrimoine, jusqu'à ce que vous saisissiez le montant espéré. Le crowdlending reste hors allocation par défaut, et n'entre dans la projection que si sa classe est incluse avec un rendement attendu. La déduction fiscale des pertes n'est pas calculée.
        </p>
        <p>
          Sur la fiche de la plateforme (Paramètres › Établissements), cochez « La plateforme prélève les impôts automatiquement » et indiquez le taux : déclarez alors les intérêts nets, et l'impôt prélevé apparaît dans la page Impôts. Sans cette case, les intérêts sont considérés comme bruts et l'impôt est affiché à payer.
        </p>
      </Section>

      <Section n={14} title="Crédits">
        <p>
          Dans <L to="/credits">Crédits</L>, indiquez le type (immobilier, travaux, consommation, auto, autre), le montant emprunté, le taux d'intérêt, la durée, la première échéance et l'assurance : un montant fixe par mois, ou un taux annuel appliqué au capital emprunté (prime constante) ou au capital restant dû (prime dégressive), comme indiqué dans votre contrat. Hamac calcule l'échéance, l'assurance, le capital restant dû, le coût total et la date de fin. Cliquez sur un crédit pour afficher, année par année, le capital remboursé, les intérêts et l'assurance. Seuls les crédits immobiliers et travaux peuvent être rattachés à un bien.
        </p>
        <p>
          Si la banque indique d'autres chiffres, saisissez l'échéance ou le capital restant dû d'un relevé, avec sa date : le calcul repart de ce montant. Le patrimoine net correspond au patrimoine financier, plus les biens, moins les crédits. Un crédit renouvelable, sans échéancier fixe, se saisit en « autre » et se corrige à la main.
        </p>
      </Section>

      <Section n={15} title="Petit lexique">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_1fr]">
          {[
            ["Enveloppe (compte)", "Le cadre fiscal qui contient les placements : livret, assurance-vie, PEA, PEA-PME, compte-titres, PER, épargne salariale, plateforme de crowdlending, plateforme crypto."],
            ["Classe d'actifs", "Ce que contient une enveloppe : livrets, fonds euros, obligations, actions, immobilier, crypto, ou une classe que vous créez. L'allocation cible se règle classe par classe."],
            ["Allocation cible", "La répartition visée entre classes d'actifs, à laquelle Hamac compare vos placements."],
            ["Espèces", "Argent arrivé sur un compte mais pas encore investi."],
            ["Versé net", "Tout l'argent mis de sa poche, moins ce qui a été retiré."],
            ["Gain", "Valeur actuelle moins versé net."],
            ["Patrimoine net", "Patrimoine financier, plus les biens immobiliers (part détenue), moins le capital restant dû des crédits."],
            ["Capital restant dû", "Ce qu'il reste à rembourser sur un crédit, hors intérêts à venir."],
            ["Crowdlending", "Prêt à des entreprises ou à des projets via une plateforme, en échange d'intérêts, avec un risque de perte du capital."],
            ["SCPI", "Société qui détient de l'immobilier, dont on achète des parts et qui reverse des loyers."],
            ["PRU", "Prix de revient unitaire : prix moyen payé par part, frais compris."],
            ["Rendement annualisé", "Ce que l'argent a rapporté par an, en tenant compte de la date de chaque versement (TRI)."],
            ["Coupon", "Intérêt fixe versé chaque année par une obligation, en % du nominal."],
            ["Rendement à l'échéance", "Vrai rendement annuel d'une obligation gardée jusqu'au bout, compte tenu de son prix d'achat."],
            ["TER", "Frais de gestion annuels d'un ETF, déjà déduits de son cours."],
            ["Sécurisation", "Période avant le départ où la part actions baisse progressivement au profit du fonds euros."],
          ].map(([a, b]) => (
            <div key={a} className="contents">
              <dt className="text-fg">{a}</dt>
              <dd>{b}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
