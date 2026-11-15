import { L, B, Part, Section, Rows } from "./_parts";

/** Au fil des mois : ce qu'on fait de temps en temps. */
export function MonthsPart() {
  return (
    <>
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
            [<L to="/performance" key="p">Performance</L>, "Ce que votre argent a réellement rapporté, par enveloppe, par placement et par compte, sa plus forte baisse et ses variations (volatilité), et sa comparaison avec un ETF ou un autre titre, même sans le détenir."],
            [<L to="/exposition" key="x">Exposition réelle</L>, "Ce que contiennent vraiment vos actions et ETF : pays, secteurs, devises et plus grosses lignes."],
            [<L to="/projection" key="j">Projection</L>, "Votre patrimoine à la retraite et le revenu mensuel possible."],
            [<L to="/historique" key="h">Historique</L>, "Où en était votre patrimoine à une date, ce qui a changé depuis, et si vous êtes en avance sur votre plan."],
            [<L to="/projets" key="o">Projets</L>, "Ce que vous préparez : la somme réunie pour chaque projet, l'avance ou le retard, et ce qu'il faut mettre de côté chaque mois."],
            [<L to="/simulateurs" key="m">Simulateurs</L>, "Avant d'investir : ce qu'un placement rapporterait avant et après impôts, et plusieurs placements côte à côte."],
            [<L to="/comptes" key="s">Mes comptes</L>, "Tous vos comptes et contrats côte à côte, et ce qui est garanti si un établissement fait faillite."],
          ]}
        />
        <p>Pour voir l'évolution d'un compte, cliquez sur sa ligne (Mes comptes, Livrets, Crowdlending) ou sur « Évolution » dans les blocs Fonds euros, Actions et Crypto. Pour un titre seul, cliquez sur sa ligne. Sur le graphique, cliquez sur un nom de la légende pour masquer sa courbe.</p>
        <p>
          <B>Projets.</B> Dans <L to="/projets">Projets</L>, notez ce que vous préparez : la somme, la date, et les comptes où vous mettez l'argent de côté, soit en pourcentage du compte (la somme suit sa valeur), soit en montant réservé. Hamac montre la somme réunie, si vous êtes en avance ou en retard, et ce qu'il faut mettre de côté chaque mois, au rendement que vous indiquez sur le projet (0 % par défaut). Il prévient si l'échéance approche alors que l'argent est en actions, matières premières ou crypto, et si un compte est affecté à plus que ce qu'il contient.
        </p>
        <p>
          <B>Concentration.</B> La page Mes comptes montre aussi ce qui pèse le plus dans votre patrimoine financier : chaque titre (tous comptes confondus), chaque émetteur d'obligations, chaque plateforme de crowdlending avec ses projets en retard ou en défaut, et chaque établissement. Au-delà de 20 % sur un seul titre, émetteur ou plateforme, le tableau de bord vous le signale ; le seuil se règle dans Paramètres › Plan. Les obligations de l'État français ne déclenchent pas d'alerte.
        </p>
        <p>
          <B>Exposition réelle.</B> Un ETF MSCI World, c'est environ 70 % d'actions américaines : la page <L to="/exposition">Exposition réelle</L> le montre, d'après la composition publiée par Amundi ou iShares, que Hamac récupère dès que vous choisissez l'ETF (il suffit de son ISIN) et met à jour chaque trimestre. Un ETF synthétique, comme la plupart des ETF « monde » ou « États-Unis » du PEA, publie le panier d'actions européennes qu'il détient, pas l'exposition qu'il donne : choisissez alors un ETF physique qui suit le même indice, Hamac vous en propose un et reprend sa composition. Faites de même pour un ETF d'un autre émetteur. Le premier équivalent choisi sur l'instance est proposé aux autres utilisateurs, qui peuvent en choisir un autre pour eux seuls. Une action détenue en direct compte pour le pays de son ISIN.
        </p>
        <p>
          <B>Protection en cas de faillite.</B> La page Mes comptes compare ce que vous avez chez chaque établissement aux garanties légales : 100 000 € de dépôts par banque, 100 000 € de plus pour Livret A, LDDS et LEP, 70 000 € de titres, 70 000 € par assureur pour l'assurance-vie et le PER. Le plafond vaut par établissement agréé, pas par marque : sur la fiche d'un établissement (Paramètres › Établissements), indiquez l'établissement garant s'il diffère, et son pays. Pour l'assurance-vie, c'est l'assureur de l'offre qui compte.
        </p>
      </Section>
    </>
  );
}
