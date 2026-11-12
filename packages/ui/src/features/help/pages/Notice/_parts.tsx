import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Table, Td, Th, Tr } from "@/shared/components/table";
import { Card } from "@/shared/components/ui";

/** Mise en page de la notice : liens, parties, sections, volets dépliables, étapes et tableaux. */

export function goTo(id: string) {
  const el = document.getElementById(id);
  if (el instanceof HTMLDetailsElement) el.open = true;
  el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
}

export const L = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="text-accent hover:underline">
    {children}
  </Link>
);

/** Renvoi vers une autre section de la notice. */
export const See = ({ id, children }: { id: string; children: ReactNode }) => (
  <button type="button" onClick={() => goTo(id)} className="text-left text-accent hover:underline">
    {children}
  </button>
);

export const B = ({ children }: { children: ReactNode }) => <b className="text-fg">{children}</b>;

export const BODY = "space-y-3 text-sm leading-relaxed text-fg-muted";

export function Part({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mt-9 mb-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="mt-1 text-sm text-fg-muted">{intro}</p>}
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="mb-4 scroll-mt-6">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className={BODY}>{children}</div>
    </Card>
  );
}

/** Section repliée : on n'ouvre que ce qui vous concerne. */
export function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <details id={id} className="group mb-3 scroll-mt-6 rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 text-accent transition-transform group-open:rotate-90" />
        {title}
      </summary>
      <div className={`${BODY} px-5 pb-5`}>{children}</div>
    </details>
  );
}

export function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="font-medium text-fg">
          {title}
          {optional && <span className="ml-2 text-xs font-normal text-fg-faint">facultatif</span>}
        </div>
        <div className="mt-1 space-y-1.5">{children}</div>
      </div>
    </li>
  );
}

export function Rows({ head, rows, firstNowrap }: { head: readonly string[]; rows: ReadonlyArray<readonly ReactNode[]>; firstNowrap?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          {head.map((h) => (
            <Th key={h}>{h}</Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <Tr key={i}>
            {r.map((c, j) => (
              <Td key={j} className={j === 0 ? `text-fg ${firstNowrap ? "whitespace-nowrap" : ""}` : undefined}>
                {c}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
