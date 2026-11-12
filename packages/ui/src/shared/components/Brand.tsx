import { cn } from "@/shared/lib/cn";

/**
 * Le logo : un H dont la barre se creuse comme une toile tendue entre deux poteaux.
 * Poteaux en or, toile en ivoire, sur un carré vert bouteille (vert nuit dans le thème sombre).
 */
export function HamacMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="32" height="32" rx="7" fill="var(--color-side-active)" />
      <path d="M9 7v18M23 7v18" stroke="var(--color-gold)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M9 12.5C12 20 20 20 23 12.5" fill="none" stroke="var(--color-side-fg)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-display text-[1.4rem] leading-none font-medium tracking-[0.005em]", className)}>Hamac</span>;
}

/**
 * Signature de jour : la courbe du hamac, en or, sous le patrimoine. Une seule par écran.
 * La nuit, le guilloché la remplace, sauf sur un fond vert (`always`).
 */
export function HamacCurve({ className, always = false }: { className?: string; always?: boolean }) {
  return (
    <svg viewBox="0 0 168 16" aria-hidden="true" className={cn("block h-4 w-40", !always && "dark:hidden", className)}>
      <circle cx="3" cy="3" r="2.2" fill="var(--color-gold)" />
      <circle cx="165" cy="3" r="2.2" fill="var(--color-gold)" />
      <path d="M3 3C50 17 118 17 165 3" fill="none" stroke="var(--color-gold)" strokeWidth="1.4" />
    </svg>
  );
}
