import type { Car } from "@/types/car";
import { generateDescription } from "@/lib/mock/description";

export function DescriptionSection({ car }: { car: Car }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        Описание
      </h2>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        {generateDescription(car)}
      </p>
    </div>
  );
}
