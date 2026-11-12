import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/** Une carte se distingue par un filet et un fond un peu plus clair, sans ombre. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface p-5", className)} {...props} />;
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.9375rem] font-semibold text-fg">{children}</h2>
      {hint && <span className="text-xs text-fg-faint">{hint}</span>}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-strong",
  secondary: "border border-line-strong bg-surface text-fg hover:border-fg-faint hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "positive" | "negative" }) {
  const tones = {
    neutral: "bg-surface-3 text-fg-muted",
    accent: "bg-gold/18 text-gold-ink",
    positive: "bg-positive/14 text-positive",
    negative: "bg-negative/14 text-negative",
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone])}>{children}</span>;
}

/** Titre de page en serif : avec les grands montants, c'est le seul usage du serif. */
export function PageTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="min-w-0">
      <h1 className="font-display text-[2rem] leading-tight font-medium tracking-[-0.01em] text-fg">{children}</h1>
      {description && <p className="mt-1.5 max-w-[68ch] text-sm text-fg-muted">{description}</p>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <PageTitle description={description}>{title}</PageTitle>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Barre d'onglets : l'onglet actif est souligné d'or, comme la page active du menu. */
export const tabListClass = "mb-6 flex flex-wrap gap-1 border-b border-line";

export function tabClass(active: boolean): string {
  return cn(
    "-mb-px shrink-0 cursor-pointer border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors duration-150",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
    active ? "border-gold font-medium text-fg" : "border-transparent text-fg-muted hover:border-line-strong hover:text-fg",
  );
}
