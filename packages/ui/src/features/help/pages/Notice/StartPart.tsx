import { L, See, B, Part, Section, Step } from "./_parts";

/** Bien commencer : créer ses comptes, saisir ses opérations, régler son plan. */
export function StartPart() {
  return (
    <>
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
    </>
  );
}
