"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cancelRequest, updateRequest } from "@/lib/api/requests";
import { ApiError } from "@/lib/api/client";
import { regions } from "@/lib/mock/cars";
import type { BuyerRequest } from "@/types/dashboard";

export function RequestRow({ request }: { request: BuyerRequest }) {
  const { lang, t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const status = listingStatusLabels[lang][request.status];

  const [isEditing, setIsEditing] = useState(false);
  const [region, setRegion] = useState(request.region);
  const [formError, setFormError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard", "requests"] });

  const updateMutation = useMutation({
    mutationFn: () => updateRequest(token as string, request.id, { region }),
    onSuccess: () => {
      invalidate();
      setIsEditing(false);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : t("cars.empty.error.description"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRequest(token as string, request.id),
    onSuccess: invalidate,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    updateMutation.mutate();
  }

  function handleCancel() {
    if (window.confirm(t("row.cancelRequestConfirm"))) {
      cancelMutation.mutate();
    }
  }

  const canManage = request.status === "active";

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-foreground">
            {request.make} {request.model}, {request.yearFrom}–{request.yearTo}
          </span>
          <button
            type="button"
            aria-label={t("row.cancelEdit")}
            onClick={() => setIsEditing(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.04]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            {t("quickSearch.price")}
          </span>
          <span className="text-[15px] text-foreground">
            {formatTenge(request.currentOffer)} · {t("row.exchangePriceLocked")}
          </span>
        </div>

        <Select label={t("quickSearch.region")} value={region} onChange={(e) => setRegion(e.target.value)}>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        {formError ? <p className="text-[13px] text-destructive">{formError}</p> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" size="md" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? t("row.saving") : t("row.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => setIsEditing(false)}
            disabled={updateMutation.isPending}
          >
            {t("row.cancelEdit")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <div className="flex h-16 w-full shrink-0 items-center justify-center rounded-xl bg-brand-light sm:w-24">
        <Search size={22} className="text-brand" />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:gap-3">
          <span className="text-[15px] font-semibold text-foreground">
            {request.make} {request.model}, {request.yearFrom}–
            {request.yearTo}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <span className="text-[13px] text-muted-foreground">
          {request.region} · {t("row.updated").toLowerCase()}{" "}
          {formatShortDate(request.updatedAt, lang)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          {formatTenge(request.currentOffer)}
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/exchange"
            className="text-[14px] font-semibold text-brand hover:text-brand-dark"
          >
            {t("row.details")}
          </Link>
          <button
            type="button"
            aria-label={t("row.edit")}
            onClick={() => setIsEditing(true)}
            disabled={!canManage}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            aria-label={t("row.cancelRequest")}
            onClick={handleCancel}
            disabled={cancelMutation.isPending || !canManage}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
