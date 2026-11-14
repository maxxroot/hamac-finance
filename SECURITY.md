# Politique de sécurité

Hamac garde des données financières personnelles et s'utilise à plusieurs sur une même instance. Une faille
compte donc beaucoup : merci de la signaler en privé.

## Signaler une faille

**N'ouvrez pas d'issue publique.** Passez par le signalement privé de GitHub : onglet **Security** du dépôt,
puis **Report a vulnerability**. Le signalement n'est visible que du mainteneur.

Indiquez si possible :

- la version concernée (commit ou date de l'image Docker) et la configuration utile (HTTPS fourni ou reverse
  proxy, mode d'inscription, variables `HAMAC_*` modifiées) ;
- les étapes pour reproduire, et ce qu'un attaquant obtient ;
- une preuve de concept minimale si vous en avez une.

N'envoyez jamais de vraies données financières ni de mots de passe : reproduisez le cas avec le jeu de
démonstration ou des montants fictifs.

## Ce qui se passe ensuite

Hamac est maintenu sur le temps libre d'une seule personne. L'objectif est d'accuser réception sous une
semaine, puis de convenir avec vous d'un calendrier de correction et de publication. Une fois la correction
publiée, la faille est décrite dans un avis de sécurité GitHub, avec votre nom si vous le souhaitez.

## Versions suivies

Seule la dernière version de la branche `main` reçoit des correctifs. Mettez votre instance à jour avant de
signaler un problème.

## Périmètre

Sont notamment concernés :

- l'authentification : mots de passe, sessions, double authentification, codes de secours, limitation des
  tentatives ;
- l'isolation entre comptes : un utilisateur ne doit jamais lire ni modifier les données d'un autre, ni les
  cours partagés de l'instance ;
- les protections du navigateur : CSRF, Content-Security-Policy, cookies ;
- les requêtes sortantes du serveur, en particulier les cours par URL personnalisée ;
- les sauvegardes et leur restauration.

Ne relèvent pas d'une faille : une instance exposée en HTTP simple avec `HAMAC_ALLOW_HTTP=1`, un
`HAMAC_TRUST_PROXY=1` activé sans reverse proxy devant, ou l'accès d'une personne qui contrôle déjà le
serveur ou la base de données.

Le fonctionnement des comptes et des protections est décrit dans
[docs/comptes-et-securite/technique.md](docs/comptes-et-securite/technique.md).
