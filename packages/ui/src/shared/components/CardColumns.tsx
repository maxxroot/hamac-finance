import type { ReactNode } from "react";

/**
 * Deux colonnes de cartes empilées chacune de son côté : une carte haute à droite ne laisse
 * pas de vide sous une carte courte à gauche, comme le ferait une grille rangée par rangée.
 * Sur écran étroit, une seule colonne : la première, puis la seconde.
 */
export function CardColumns({ children }: { children: ReactNode }) {
  return <div className="grid items-start gap-5 @3xl:grid-cols-2">{children}</div>;
}

/** Une colonne de {@link CardColumns}. */
export function CardColumn({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-5">{children}</div>;
}
