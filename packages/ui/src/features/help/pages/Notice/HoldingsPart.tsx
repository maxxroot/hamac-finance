import { L, B, Part, Fold, Rows } from "./_parts";

/** Selon ce que vous possédez : une section par type de placement ou de bien. */
export function HoldingsPart() {
  return (
    <>
      <Part title="Selon ce que vous possédez" intro="Ouvrez seulement ce qui vous concerne." />

      <Fold id="livrets" title="Livrets et fonds euros">
        <p>Ces placements demandent très peu de suivi. Chaque janvier, notez dans le Journal les intérêts de l'année écoulée, datés du 31/12, tels qu'ils sont arrivés sur le compte.</p>
        <p>
          Pour le fonds euros, notez aussi le taux servi dans la page <L to="/fonds-euros">Fonds euros</L>. Si vous avez un excédent sur vos livrets, un <B>Transfert</B> vers l'assurance-vie le déplace en une seule ligne.
        </p>
        <p>
          <B>Les supports d'un contrat.</B> Le fonds euros est un support de votre contrat d'assurance-vie ou de PER, comme les unités de compte (ETF, fonds). Chaque contrat a un fonds euros par défaut, choisi dans sa fiche : il reçoit l'argent quand une opération ne précise pas de support. Si votre contrat en propose plusieurs, choisissez le support dans la saisie. Pour passer d'un support à l'autre sans sortir du contrat, notez un <B>Arbitrage</B> : support cédé, support reçu et valeur de l'échange. Rien n'est imposable tant que l'argent reste dans le contrat.
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
          <li>Chaque année, notez le coupon reçu : la tuile « Coupons perçus » de la page signale ceux qui ne sont pas saisis. À l'échéance, le nominal revient tout seul dans les espèces du compte-titres.</li>
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
            ["J'ai échangé une crypto contre une autre (stablecoins compris)", "Arbitrage, avec les deux quantités et la valeur de l'échange en euros"],
          ]}
        />
        <p>La crypto compte dans votre patrimoine, mais reste par défaut hors de la répartition et de la projection.</p>
        <p>
          <B>Côté impôts :</B> seules les ventes contre des euros sont imposables, pas les échanges entre cryptos, et seulement si le total des ventes de l'année dépasse 305 €. Pour des cryptos déjà détenues, notez ce que vous avez réellement payé, au plus près des dates d'achat : sinon la plus-value et l'impôt seront faux.
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
    </>
  );
}
