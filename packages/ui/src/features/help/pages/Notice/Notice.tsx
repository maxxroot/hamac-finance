import { Card, PageHeader } from "@/shared/components/ui";
import { See } from "./_parts";
import { NOTICE_PLAN } from "./plan";
import { StartPart } from "./StartPart";
import { MonthsPart } from "./MonthsPart";
import { HoldingsPart } from "./HoldingsPart";
import { FurtherPart } from "./FurtherPart";

export function Notice() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Notice" description="Tout ce qu'il faut savoir pour utiliser Hamac, sans être un spécialiste." />

      <Card className="mb-2">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {NOTICE_PLAN.map((g) => (
            <div key={g.part}>
              <div className="mb-1.5 text-xs font-medium text-fg-faint">{g.part}</div>
              <ul className="space-y-1 text-sm">
                {g.items.map(([id, label]) => (
                  <li key={id}>
                    <See id={id}>{label}</See>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <StartPart />
      <MonthsPart />
      <HoldingsPart />
      <FurtherPart />
    </div>
  );
}
