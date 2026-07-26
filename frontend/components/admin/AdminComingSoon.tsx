export function AdminComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
        {title}
      </h1>
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-[15px] text-muted-foreground">
        Раздел в разработке — появится на следующем этапе.
      </div>
    </div>
  );
}
