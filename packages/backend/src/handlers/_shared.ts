
/** Aides partagées par plusieurs domaines de handlers. */

export async function count(query: Promise<{ n: number } | undefined>): Promise<number> {
  return (await query)?.n ?? 0;
}
