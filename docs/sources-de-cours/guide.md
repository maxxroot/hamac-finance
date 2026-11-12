# Sources de cours : guide

> Pour les développeurs : [documentation technique](technique.md).

Ce guide s'adresse à vous si vous utilisez Hamac, et aussi à la personne qui administre l'instance (le premier compte créé, ou la personne qui gère le serveur). Les passages réservés à l'administration le disent.

## À quoi ça sert

Hamac a besoin du cours de vos titres pour calculer la valeur de vos placements. Il va chercher ces cours lui-même, sur des sites publics, sans clé d'API par défaut. Vous pouvez aussi saisir un cours à la main, ou donner à un titre sa propre adresse de cours.

Les cours sont communs à toute l'instance : un titre détenu par plusieurs personnes n'est téléchargé qu'une fois. Ces requêtes révèlent aux fournisseurs les identifiants des titres suivis, jamais les montants.

## Ce que vous y voyez

Tout se trouve dans Paramètres › Cours, dans cet ordre.

### Ordre des sources

La liste des sources, numérotées. Pour chaque titre, Hamac essaie les sources dans cet ordre et garde la première qui répond.

| Source | Ce qu'elle couvre |
|---|---|
| justETF | ETF en euros, par ISIN. Sans clé. |
| Euronext | Actions et ETF cotés en euros (Paris, Bruxelles, Lisbonne, Dublin, Milan), par ISIN. Sans clé, site public non documenté. |
| Twelve Data | Par symbole, avec une clé. L'offre gratuite ne couvre que le marché américain. |
| Yahoo Finance | Dernier recours, par symbole. Non officiel : l'accès peut être refusé selon le réseau. |
| CoinGecko | Cryptomonnaies. Sans clé. |

- Si vous administrez l'instance, vous pouvez cocher ou décocher chaque source et la monter ou la descendre.
- Sinon, la liste est en lecture seule, avec la mention « Active » ou « Désactivée ».

### Twelve Data (administration seulement)

Ce bloc n'apparaît que pour l'administrateur.

- Sans clé : un message indique de renseigner `HAMAC_TWELVEDATA_KEY` dans le fichier `.env` du serveur, puis de relancer Hamac.
- Avec une clé : le nombre de titres qui peuvent passer par Twelve Data, le rythme d'actualisation, le nombre maximal de requêtes par jour qui en découle, et les requêtes utilisées aujourd'hui sur le total autorisé.

### État des cours

- La date de la dernière actualisation et celle de la prochaine.
- Le bouton « Actualiser ».
- Un tableau : pour chaque titre, la source qui a répondu (ou « Aucune »), la date du dernier cours, et le détail des échecs source par source.

### Compositions des ETF et ETF équivalents (administration seulement)

Deux blocs de plus, réservés à l'administrateur, qui concernent l'exposition réelle des ETF et non leurs cours.

### En haut de chaque page

Un bouton indique l'âge des cours (« Cours il y a 12 min », par exemple). Un clic relance l'actualisation. Si un titre n'a pas pu être actualisé, une icône d'alerte s'affiche ; un clic ouvre la liste des titres concernés, avec « Réessayer » et « Voir les sources ».

## Comment faire

### Laisser Hamac trouver le cours d'un titre

1. Paramètres › Actifs : ouvrez la fiche du titre.
2. Source du cours : « Automatique (fournisseur de cours) ».
3. Renseignez l'ISIN. Pour une action ou un ETF hors des sources par ISIN, ajoutez le symbole chez le fournisseur (par exemple `PSP5.PA`). Pour une crypto, le symbole est l'identifiant CoinGecko (par exemple `bitcoin`).
4. Laissez « Fournisseur » sur « Automatique » pour suivre l'ordre des sources, ou choisissez une source précise.
5. Enregistrez, puis cliquez sur « Actualiser » dans Paramètres › Cours.

### Saisir un cours à la main

- Pour un seul cours : page Actions (ou Crypto), cliquez sur le cours du titre, saisissez le cours et sa date, puis enregistrez. Pour une obligation, le cours est en pourcentage du nominal, pied de coupon.
- Pour un titre sans aucune source : sur sa fiche, choisissez « Saisi à la main » comme source du cours, et saisissez le cours.

### Donner à un titre sa propre adresse de cours

1. Fiche du titre : source « Automatique », fournisseur « URL personnalisée ».
2. Adresse : une adresse `https` qui renvoie du JSON. `{isin}` et `{symbol}` y sont remplacés par ceux du titre.
3. Chemin du prix dans la réponse : par exemple `data.0.close` pour une réponse `{"data":[{"close":12}]}`.
4. Le cours renvoyé doit être en euros.

### Régler l'ordre des sources (administration)

1. Paramètres › Cours : montez, descendez, activez ou désactivez les sources.
2. Chaque changement s'enregistre aussitôt et vaut pour toute l'instance.

### Activer Twelve Data (administration)

1. Créez une clé sur twelvedata.com.
2. Dans le fichier `.env` à côté de `docker-compose.yml`, renseignez `HAMAC_TWELVEDATA_KEY`. Si votre offre n'est pas l'offre gratuite, renseignez aussi `HAMAC_TWELVEDATA_DAILY_LIMIT` (800 par défaut).
3. Relancez : `docker compose up -d`.

La clé n'est jamais enregistrée en base, jamais envoyée à l'interface et jamais incluse dans les sauvegardes.

### Changer le rythme d'actualisation (administration)

Dans `.env` :

- `HAMAC_REFRESH_MINUTES` : minutes entre deux actualisations, 30 par défaut, 10 au minimum. Le quota de Twelve Data peut ralentir ce rythme.
- `HAMAC_PRICES=0` : plus d'actualisation automatique. Le bouton « Actualiser » fonctionne toujours.

## Comprendre

- **Une base commune.** Les cours téléchargés pour un titre servent à toutes les personnes qui le détiennent. Un même titre n'est pas réinterrogé avant 10 minutes, quel que soit le nombre de personnes qui le demandent. Le serveur actualise ces cours tout seul, même quand personne n'est connecté.
- **Un titre, plusieurs cotations.** Hamac reconnaît un titre à son type, son ISIN, son symbole et la source imposée. Deux symboles différents pour le même ISIN (deux places de cotation, deux devises) sont deux titres distincts.
- **Le repli.** Si la première source échoue, Hamac essaie la suivante. Si un titre impose sa source, seule celle-ci est essayée.
- **Le contrôle de vraisemblance.** Un nouveau cours qui s'écarte de plus de 25 % du dernier cours connu venant d'une autre source, à moins de 30 jours d'écart, est rejeté : c'est souvent une cotation dans une autre devise. Ce contrôle ne s'applique pas à la crypto.
- **Qui l'emporte.** Pour un même jour, le cours saisi à la main passe avant le cours commun, qui passe avant l'historique propre à votre compte (cours d'une adresse personnalisée, cours restaurés d'une sauvegarde). D'un jour à l'autre, c'est le cours le plus récent qui compte. Une actualisation automatique n'écrase jamais un cours saisi à la main.
- **Ce que vous voyez.** Pour alléger les pages, Hamac garde le dernier cours de chaque mois, et tous les cours du jour pour la crypto.
- **Ce qui n'a pas de cours.** Une obligation détenue jusqu'à l'échéance a une valeur calculée. Une SCPI demande un prix de part saisi à la main, sauf adresse personnalisée. Un fonds euros n'a pas de cours.
- **Twelve Data et son quota.** Hamac compte les requêtes et ne dépasse jamais 95 % du quota du jour, ni 8 requêtes par minute. Il allonge l'intervalle entre deux actualisations pour que tous les titres concernés tiennent dans le quota. Un symbole refusé par votre offre n'est pas redemandé avant 24 heures. Une cotation dans une autre devise que l'euro est refusée.
- **Adresses personnalisées.** Elles restent propres à votre compte et ne vont jamais dans la base commune. Le serveur n'accepte que des adresses `https` publiques : une adresse qui vise un réseau privé est refusée, la réponse est limitée à 2 Mo et à 15 secondes.

## Limites

- Les accès non officiels (Euronext, Yahoo Finance) peuvent cesser de fonctionner sans préavis. Respectez les conditions d'utilisation de chaque fournisseur.
- L'offre gratuite de Twelve Data ne couvre que les titres américains ; les cotations européennes demandent une offre payante.
- Les cours d'une adresse personnalisée et l'état des cours affiché dans votre compte ne sont actualisés automatiquement que pendant que vous utilisez Hamac (le serveur referme votre espace après 15 minutes sans requête), ou quand vous cliquez sur « Actualiser ». Les cours communs, eux, sont actualisés en continu.
- Un cours saisi à la main en milieu de mois peut céder la place, dans les historiques mensuels, à un cours automatique plus récent du même mois.
