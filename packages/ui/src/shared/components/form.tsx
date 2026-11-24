import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";
import { formatNumber } from "@/shared/lib/numbers";
import { readTypedNumber } from "@/shared/lib/expression";
import { isCompleteDateValue } from "@/shared/lib/dateTyping";

const inputBase =
  "h-9 w-full rounded-lg border border-line-strong bg-field px-3 text-sm text-fg placeholder:text-fg-faint transition-[border-color,box-shadow] duration-150 " +
  "focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:opacity-60 aria-[invalid=true]:border-negative";

// ——— Fenêtre modale ———

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // Fenêtres superposées : Échap ne ferme que celle du dessus.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && [...document.querySelectorAll('[role="dialog"]')].at(-1) === dialogRef.current && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    // Fond cliquable : un raccourci à la souris, Échap et le bouton de fermeture restent les vrais moyens de fermer.
    <div role="presentation" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#08120e]/55 p-6 pt-[8vh]" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("w-full rounded-2xl border border-line bg-surface shadow-float", width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-display text-xl font-medium">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-fg-muted hover:bg-surface-3 hover:text-fg" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ——— Champ avec libellé, aide et erreur ———

export function Field({
  label,
  help,
  error,
  children,
  className,
}: {
  label: string;
  help?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
      {error ? <p className="text-xs text-negative">{error}</p> : help ? <p className="text-xs leading-relaxed text-fg-faint">{help}</p> : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type === "date" || props.type === "month") return <DateTextInput {...props} />;
  return <input {...props} className={cn(inputBase, props.className)} />;
}

/**
 * Date ou mois. Le navigateur envoie une valeur à chaque chiffre de l'année (« 0002-05-31 »…) : elle reste affichée
 * dans le champ, mais n'est transmise qu'une fois l'année complète. Sinon le formulaire calcule sur l'an 2 et peut
 * se réinitialiser, et il ne reste qu'un chiffre. En quittant le champ, une année incomplète revient à la valeur connue.
 */
function DateTextInput({ value, onChange, onBlur, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const outer = value == null ? "" : String(value);
  const [text, setText] = useState(outer);
  // La valeur du formulaire ne change qu'une fois la date complète (ou ailleurs, par un calcul) : le champ la suit.
  useEffect(() => setText(outer), [outer]);
  return (
    <input
      {...rest}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (isCompleteDateValue(e.target.value)) onChange?.(e);
      }}
      onBlur={(e) => {
        if (!isCompleteDateValue(text)) setText(outer);
        onBlur?.(e);
      }}
      className={cn(inputBase, rest.className)}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "h-auto min-h-[72px] py-2", props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputBase, "cursor-pointer appearance-none bg-(image:--chevron) bg-size-[16px] bg-position-[right_0.6rem_center] bg-no-repeat pr-8", props.className)}>
      {children}
    </select>
  );
}

/**
 * Saisie numérique tolérante (virgule ou point, espaces). Garde le texte tapé tant que le champ
 * a le focus, et reformate à la sortie.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  decimals = 2,
  allowNegative = false,
  grouping = true,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  decimals?: number;
  allowNegative?: boolean;
  /** Séparateur de milliers (désactiver pour une année). */
  grouping?: boolean;
}) {
  const [text, setText] = useState(formatNumber(value, decimals, grouping));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(formatNumber(value, decimals, grouping));
  }, [value, decimals, grouping]);
  return (
    <div className="relative">
      <input
        {...rest}
        inputMode="decimal"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          focused.current = false;
          setText(formatNumber(value, decimals, grouping));
          rest.onBlur?.(e);
        }}
        onChange={(e) => {
          setText(e.target.value);
          // « =120+35 » : calcul comme dans un tableur ; incomplet, la valeur précédente reste.
          const n = readTypedNumber(e.target.value, { allowNegative, decimals });
          if (n !== undefined) onChange(n);
        }}
        className={cn(inputBase, "num text-right", suffix && "pr-9", rest.className)}
      />
      {suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-faint">{suffix}</span>}
    </div>
  );
}

export function MoneyInput(props: Omit<Parameters<typeof NumberInput>[0], "suffix">) {
  return <NumberInput suffix="€" {...props} />;
}

/** Pourcentage : affiché « 2,5 % », stocké 0.025. */
export function PercentInput({
  value,
  onChange,
  ...rest
}: Omit<Parameters<typeof NumberInput>[0], "suffix" | "value" | "onChange"> & { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <NumberInput
      {...rest}
      suffix="%"
      decimals={3}
      value={value == null ? null : Math.round(value * 100_000) / 1000}
      onChange={(v) => onChange(v == null ? null : Math.round(v * 1000) / 100_000)}
    />
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  return <div className={cn("grid gap-4", cols === 2 && "sm:grid-cols-2", cols === 3 && "sm:grid-cols-3")}>{children}</div>;
}
