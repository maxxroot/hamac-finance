# 0005. La clé Twelve Data ne vit que dans `.env`

- Statut : acceptée
- Date : 2026-11-09 (rédigée le 2026-11-12)

## Contexte

La clé d'API Twelve Data donne accès à un quota payant ou limité. Stockée en base, elle partirait dans les sauvegardes et pourrait être exposée à un tenant ou à l'interface.

## Décision

La clé se lit uniquement dans la variable `HAMAC_TWELVEDATA_KEY` du fichier `.env` de l'instance. Elle n'est jamais enregistrée en base ni envoyée à l'interface. Les autres réglages de l'instance sont aussi dans `.env` (modèle : `.env.example`).

## Conséquences

- L'ancien emplacement de la clé dans les données d'un tenant (`MARKET_SECRETS_KEY`) n'est jamais exporté ni restauré.
- Le rythme d'actualisation est calculé pour ne pas dépasser le quota quotidien de Twelve Data sur une instance allumée en permanence.
