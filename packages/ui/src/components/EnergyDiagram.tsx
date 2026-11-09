import { ENERGY_LETTERS, type EnergyLetter } from "@hamac/core";
import { DPE_COLORS, GES_COLORS } from "@/lib/colors";

const KINDS = {
  dpe: { label: "Note DPE", title: "Consommation d'énergie", top: "Logement économe", bottom: "Logement énergivore", colors: DPE_COLORS },
  ges: { label: "Note climat (GES)", title: "Émissions de gaz à effet de serre", top: "Peu d'émissions", bottom: "Émissions importantes", colors: GES_COLORS },
} as const;

// Flèche de l'étiquette : pointe à droite.
const ARROW = "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)";

/** Étiquette en escalier, de A à G, avec la note du bien repérée. */
export function EnergyDiagram({ kind, value }: { kind: "dpe" | "ges"; value: EnergyLetter | null }) {
  const { label, title, top, bottom, colors } = KINDS[kind];
  return (
    <div className="break-inside-avoid">
      <div className="mb-1 text-xs font-medium">{title}</div>
      <div className="text-[11px] opacity-60">{top}</div>
      <div className="my-1 flex flex-col gap-[3px]" role="img" aria-label={value ? `${label} : ${value}` : `${label} : non renseignée`}>
        {ENERGY_LETTERS.map((letter, i) => {
          const current = letter === value;
          return (
            <div key={letter} className="flex items-center gap-1.5">
              <div
                className={`flex items-center justify-end pr-3.5 [print-color-adjust:exact] ${current ? "h-8 text-base font-bold" : "h-5 text-xs font-semibold"}`}
                style={{ width: `${32 + i * 8}%`, background: colors[letter].background, color: colors[letter].text, clipPath: ARROW }}
              >
                {letter}
              </div>
              {current && <span className="text-sm font-bold">◄ {letter}</span>}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] opacity-60">{bottom}</div>
    </div>
  );
}
