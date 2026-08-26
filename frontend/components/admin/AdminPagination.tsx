"use client";

import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <Button
        variant="secondary"
        size="md"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        {t("admin.pagination.prev")}
      </Button>
      <span className="text-[13px] text-muted-foreground">
        {t("admin.pagination.pageLabel")} {page} / {totalPages}
      </span>
      <Button
        variant="secondary"
        size="md"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        {t("admin.pagination.next")}
      </Button>
    </div>
  );
}
