import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { TextInput } from "@/shared/components/form";
import { cn } from "@/shared/lib/cn";
import { searchAddress, type AddressSuggestion } from "@/features/realestate/lib/addressSearch";

const DEBOUNCE_MS = 250;

/** Champ d'adresse avec suggestions de la Base Adresse Nationale ; la saisie libre reste possible. */
export function AddressInput({ id, value, onChange, onSelect, autoFocus }: { id: string; value: string; onChange: (v: string) => void; onSelect: (s: AddressSuggestion) => void; autoFocus?: boolean }) {
  const [typed, setTyped] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [unavailable, setUnavailable] = useState(false);
  const listId = useId();
  const blurred = useRef(false);

  // Seulement ce que l'utilisateur tape : ouvrir une fiche déjà remplie n'interroge pas le service.
  useEffect(() => {
    if (typed == null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddress(typed, controller.signal)
        .then((found) => {
          setUnavailable(false);
          setActive(-1);
          setSuggestions(blurred.current ? [] : found);
        })
        .catch((e: Error) => {
          if (e.name === "AbortError") return;
          setSuggestions([]);
          setUnavailable(true);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [typed]);

  const choose = (s: AddressSuggestion) => {
    setTyped(null);
    setSuggestions([]);
    onSelect(s);
  };
  const open = suggestions.length > 0;
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(suggestions[active]);
    } else if (e.key === "Escape") {
      // La liste se ferme, pas la fenêtre.
      e.nativeEvent.stopPropagation();
      setSuggestions([]);
    }
  };

  return (
    <div className="relative">
      <TextInput
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          blurred.current = false;
          onChange(e.target.value);
          setTyped(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          blurred.current = true;
          setSuggestions([]);
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-float">
          {suggestions.map((s, i) => (
            <li
              key={s.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn("cursor-pointer px-3 py-2 text-sm hover:bg-surface-3", i === active && "bg-surface-3")}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {unavailable && <p className="mt-1 text-xs text-fg-faint">Recherche d'adresse indisponible : saisissez-la à la main.</p>}
    </div>
  );
}
