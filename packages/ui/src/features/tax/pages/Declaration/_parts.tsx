import { type ReactNode } from "react";
import { STATUS_LABELS, type TaxLine, type TaxStatus } from "@hamac/core";
import { Td } from "@/shared/components/table";
import { Badge, Card } from "@/shared/components/ui";
import { cn } from "@/shared/lib/cn";

/** Éléments communs aux deux vues : statut, bloc, case de la déclaration, notes, ligne. */

export function Status({ status }: { status: TaxStatus }) {
  return <Badge tone={status === "calcule" ? "positive" : status === "a_verifier" ? "accent" : "negative"}>{STATUS_LABELS[status]}</Badge>;
}

export function Block({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("mb-6", className)}>
      <h3 className="mb-4 font-medium">{title}</h3>
      {children}
    </Card>
  );
}

export function BoxCell({ line, covered }: { line: Pick<TaxLine, "rule">; covered: boolean }) {
  return (
    <Td className="font-semibold whitespace-nowrap">
      {line.rule.box}
      {!covered && <span className="ml-1 text-xs font-normal text-fg-faint">indicative</span>}
    </Td>
  );
}

export function Notes({ notes }: { notes: readonly string[] }) {
  if (notes.length === 0) return null;
  return <div className="mt-1 text-xs text-fg-faint">{notes.join(" ")}</div>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
