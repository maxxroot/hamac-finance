import type { ReactNode } from "react";

/** Page à imprimer ou à enregistrer en PDF : fond blanc, sans menu, quel que soit le thème. */
export function PrintPage({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-auto bg-white text-sm text-black print:static print:overflow-visible">
      <div className="mx-auto max-w-3xl p-8 print:max-w-none print:p-0">
        <div className="mb-6 flex justify-end print:hidden">
          <button type="button" className="rounded-lg border border-neutral-400 px-3 py-1.5 text-sm text-black" onClick={() => window.print()}>
            Imprimer ou enregistrer en PDF
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-1.5 border-b border-neutral-400 pb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function PrintLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-0.5">
      <span className="text-neutral-600">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
