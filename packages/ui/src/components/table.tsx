import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <th
      {...props}
      className={cn(
        "sticky top-0 border-b border-line bg-surface-2 px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-fg-muted",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    />
  );
}

export function Td({ className, align, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: "right" | "center" }) {
  return (
    <td
      {...props}
      className={cn("border-b border-line/60 px-3 py-2.5 align-middle", align === "right" && "num text-right whitespace-nowrap", align === "center" && "text-center", className)}
    />
  );
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("transition-colors hover:bg-surface-2/60", className)} />;
}

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-10 text-center text-sm text-fg-muted">
        {children}
      </td>
    </tr>
  );
}
