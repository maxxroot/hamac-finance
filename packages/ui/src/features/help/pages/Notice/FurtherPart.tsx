import { L, B, Part, Fold } from "./_parts";
import { LEXIQUE } from "./lexique";

/** Aller plus loin : réglages, fiscalité, sauvegardes, lexique. */
export function FurtherPart() {
  return (
    <>
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
    </>
  );
}
