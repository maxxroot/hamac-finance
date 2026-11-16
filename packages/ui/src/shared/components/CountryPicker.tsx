import { ChevronDown } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Flag } from "@/shared/components/Flag";
import { cn } from "@/shared/lib/cn";
import { filterCountries } from "@/shared/lib/countrySearch";

/**
 * Choix d'un pays dans une liste avec recherche et drapeaux : on tape quelques lettres (« belg »), on choisit à la souris
 * ou au clavier (flèches, Entrée), Échap referme la liste sans changer le choix.
 */
export function CountryPicker({
  id,
  value,
  codes,
  label,
  onChange,
}: {
  id?: string;
  value: string | null;
  codes: readonly string[];
  label: (code: string) => string;
  onChange: (code: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = useMemo(() => filterCountries(codes, label, query), [codes, label, query]);

  const show = () => {
    setQuery("");
    setActive(Math.max(0, value ? filterCountries(codes, label, "").indexOf(value) : 0));
    setOpen(true);
  };
  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
  };
  const move = (i: number) => {
    const next = Math.min(Math.max(0, i), matches.length - 1);
    setActive(next);
    listRef.current?.children[next]?.scrollIntoView?.({ block: "nearest" });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      e.preventDefault();
      show();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      // La liste se referme ; la fenêtre autour, elle, reste ouverte.
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 items-center">{value && !open && <Flag code={value} />}</div>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active]}` : undefined}
        autoComplete="off"
        value={open ? query : value ? label(value) : ""}
        placeholder={open ? "Rechercher un pays…" : "Choisir un pays"}
        onFocus={show}
        onClick={() => !open && show()}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (listRef.current) listRef.current.scrollTop = 0;
          if (!open) setOpen(true);
        }}
        onKeyDown={onKey}
        className={cn(
          "h-9 w-full rounded-lg border border-line-strong bg-field pr-8 text-sm text-fg placeholder:text-fg-faint transition-[border-color,box-shadow] duration-150",
          "focus:border-accent focus:ring-3 focus:ring-accent/15 focus:outline-none",
          value && !open ? "pl-10" : "pl-3",
        )}
      />
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-faint" />
      {open && (
        <ul ref={listRef} id={listId} role="listbox" aria-label="Pays" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-float">
          {matches.length === 0 && <li className="px-3 py-2 text-xs text-fg-muted">Aucun pays ne correspond.</li>}
          {matches.map((code, i) => (
            <li
              key={code}
              id={`${listId}-${code}`}
              role="option"
              aria-selected={code === value}
              // mousedown plutôt que click : le choix passe avant que le champ ne perde le focus et ne referme la liste.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(code);
              }}
              onMouseMove={() => i !== active && setActive(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm", i === active && "bg-surface-3", code === value && "font-medium text-accent")}
            >
              <Flag code={code} />
              <span className="truncate">{label(code)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
