import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <span className="text-sm font-semibold uppercase tracking-wide text-brand">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-[32px] font-semibold tracking-tight text-foreground sm:text-[38px]">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-lg text-muted-foreground",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
