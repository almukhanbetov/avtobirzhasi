"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/ui/EmptyState";
import { MatchCard } from "@/components/dashboard/MatchCard";
import { RowSkeleton } from "@/components/dashboard/RowSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { listMyMatches } from "@/lib/api/matches";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function MatchesContent() {
  const { token } = useAuth();
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "matches"],
    queryFn: () => listMyMatches(token as string),
    enabled: Boolean(token),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
          {t("dashboard.nav.matches")}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {t("dashboard.matches.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : isError ? (
        <EmptyState
          title={t("dashboard.matches.loadErrorTitle")}
          description={t("cars.empty.error.description")}
        />
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.matches.emptyTitle")}
          description={t("dashboard.matches.emptyDescription")}
        />
      )}
    </div>
  );
}
