/**
 * Pendant la frappe de l'année, un champ de date donne une valeur à chaque chiffre : « 0002-05-31 », « 0020-05-31 »,
 * « 0203-05-31 », puis « 2030-05-31 ». Seule la dernière est une date voulue. Une valeur est complète quand son année
 * a quatre chiffres significatifs (1000 ou plus) ; un champ vidé (« ») l'est aussi.
 */
export function isCompleteDateValue(value: string): boolean {
  if (value === "") return true;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  return !!m && Number(m[1]) >= 1000;
}
