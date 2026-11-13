/**
 * Projection d'un bien en location et revente à une date choisie. Hypothèses de l'utilisateur, pas des règles :
 * hausse des loyers, des charges et de la valeur (Paramètres › Plan › Biens en location), mois type du cashflow
 * prévu, impôt du bien estimé seul. La plus-value suit `realEstateGain` (domaine tax).
 */
export { defaultHorizon, projectionYears, type ProjectionContext, type ProjectionYear } from "./_years";
export { internalRate, rentalSale, type RentalSale, type SaleContext } from "./_sale";
