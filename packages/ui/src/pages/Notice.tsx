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
      <PageHeader title="Notice" description="Comment utiliser Hamac. Une vingtaine de saisies par an suffisent." />

      <Section n={1} title="Le principe">
        <p>
          On note dans le <L to="/journal">Journal</L> ce qui se passe : argent qui arrive, achats, intérêts, retraits. Tout le reste se calcule : valeurs, plus-values, rendement, impôts, projection, alertes. Les
          versements mensuels automatiques se programment une fois dans <L to="/versements">Versements</L> ; chaque mois écoulé est compté comme versé, sauf s'il est déclaré manqué.
        </p>
        <p>Vos données restent sur cet ordinateur, dans un fichier sauvegardé automatiquement chaque jour (Paramètres › Application).</p>
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
              ["Paramètres › Plan", "Année de naissance, âge de départ, âge de sécurisation (début de la baisse des actions), âge horizon (jusqu'où l'argent doit durer)", "1990 · 64 · 57 · 90"],
              ["Paramètres › Plan", "Premier mois des versements, hypothèses de rendement et d'inflation", "janvier 2027 · 2 % · 3 % · 3,5 % · 6 % · 2 %"],
              ["Paramètres › Plan", "Allocation cible : part actions avant la sécurisation et au départ, part obligations (le fonds euros prend le reste)", "30 % · 15 % · 50 %"],
              ["Paramètres › Plan", "Plancher et plafond des livrets, seuil d'alerte, tranche d'imposition", "7 500 € · 15 000 € · 5 % · 11 %"],
              ["Établissements", "Votre banque, votre courtier, votre assurance-vie : comptes proposés et grille de frais (paliers de courtage, droits de garde, frais sur versements et de gestion)", "jusqu'à 500 € : 1,99 € · au-delà : 0,5 %"],
              ["Paramètres › Comptes", "Chaque compte : son établissement (qui fixe ses frais), date d'ouverture (règles des 5 et 8 ans), taux et plafond des livrets, clause bénéficiaire", "PEA ouvert le 15/03/2021"],
              ["Paramètres › Actifs", "Les ETF, obligations et cryptos détenus : recherche par nom ou ISIN, part cible de chaque ETF (total 100 %), classe personnalisée, dans ou hors allocation", "ETF monde · FR00… · 100 %"],
              ["Journal", "Un « Apport initial » par compte avec l'argent déjà là au départ", "LEP · Apport initial · 5 000 €"],
              ["Versements", "Le montant de chaque virement automatique, à partir de quel mois", "PEA · dès janvier 2027 · 150 €/mois"],
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
        <p>
          Un relevé de banque ou de courtier au format CSV peut être importé depuis le Journal (bouton « Importer ») : on indique à quoi correspond chaque colonne et on vérifie l'aperçu avant l'import.
        </p>
      </Section>

      <Section n={4} title="Calendrier des saisies">
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
              ["Quand c'est prévu", "Grosse dépense future (voiture, travaux)", "Projection"],
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

      <Section n={5} title="Acheter une obligation, pas à pas">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Regarder les espèces disponibles : alerte du Tableau de bord ou page <L to="/obligations">Obligations</L>.</li>
          <li>Acheter chez le courtier une obligation dont l'échéance tombe avant l'âge de départ (OAT ou obligation d'entreprise).</li>
          <li>
            Ajouter le titre dans Paramètres › Actifs : la recherche par ISIN pré-remplit le coupon et l'échéance.
          </li>
          <li>Saisir l'achat dans le Journal : nominal, prix en % du nominal (ex. 96,40) et frais. Le montant, le rendement à l'échéance et la valeur se calculent seuls.</li>
          <li>Chaque année, noter le coupon reçu. À l'échéance, le nominal revient automatiquement dans les espèces du compte-titres.</li>
          <li>Avant l'âge de sécurisation, racheter une ligne plus longue ; après, transférer le capital vers le fonds euros.</li>
        </ol>
        <p>
          <b className="text-fg">Le coupon n'est pas le rendement.</b> Une obligation à 3,5 % achetée à 96 % rapporte plus de 3,5 % par an, car l'émetteur rembourse 100 % à l'échéance.
        </p>
      </Section>

      <Section n={6} title="Crypto">
        <p>
          La crypto compte dans le patrimoine, l'historique et la performance, mais reste par défaut hors de l'allocation cible, et toujours hors de la projection. Les euros envoyés sur la plateforme sont un « Versement » sur le compte crypto ;
          un achat est un « Achat » du titre (Bitcoin…) avec la quantité reçue ; une vente contre des euros est une « Vente ».
        </p>
        <p>
          Seules les ventes contre des euros sont imposables. La plus-value de chaque vente est calculée selon la règle française (sur le portefeuille global), et l'impôt de l'année n'est dû que si le total des
          ventes dépasse 305 €. Pour des cryptos déjà détenues, noter ce qui a été réellement payé, daté au plus près des achats : sinon plus-value et impôt seront faux.
        </p>
      </Section>

      <Section n={7} title="Petit lexique">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[180px_1fr]">
          {[
            ["Enveloppe (compte)", "Le cadre fiscal qui contient les placements : livret, assurance-vie, PEA, compte-titres, plateforme crypto."],
            ["Classe d'actifs", "Ce que contient une enveloppe : livrets, fonds euros, obligations, actions, crypto. L'allocation cible porte sur fonds euros, obligations et actions."],
            ["Espèces", "Argent arrivé sur un compte mais pas encore investi."],
            ["Versé net", "Tout l'argent mis de sa poche, moins ce qui a été retiré."],
            ["Gain", "Valeur actuelle moins versé net."],
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
