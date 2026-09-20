"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Search, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatTenge } from "@/lib/format/money";
import { formatShortDate } from "@/lib/format/date";
import { listingStatusLabels } from "@/lib/labels/dashboard";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cancelRequest, updateRequest } from "@/lib/api/requests";
import { ApiError } from "@/lib/api/client";
import {
  LocationSelector,
  EMPTY_LOCATION_VALUE,
  type LocationValue,
} from "@/features/location/LocationSelector";
import { listRegions, listCitiesByRegion, resolveLegacyRegionText } from "@/lib/api/locations";
import type { BuyerRequest } from "@/types/dashboard";

export function RequestRow({ request }: { request: BuyerRequest }) {
  const { lang, t } = useLanguage();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const status = listingStatusLabels[lang][request.status];

  const [isEditing, setIsEditing] = useState(false);
  // null = "not yet committed by the user (or by an auto-resolution)" —
  // the actual value shown/submitted is derived below (effectiveLocation),
  // never written here from an effect (avoids the setState-in-effect
  // anti-pattern): it only ever changes via LocationSelector's onChange,
  // i.e. a real interaction (including its own auto-city-select for a
  // republican-significance region).
  const [locationValue, setLocationValue] = useState<LocationValue | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Stage 6Б: an old request may have only the free-text `region` (no
  // regionId) — try an exact match against the reference data. Applied
  // only as a fallback for `effectiveLocation` below, never written to
  // PostgreSQL by itself — only an explicit "Сохранить" click does that.
  const needsLegacyMatch = isEditing && !request.regionId && !!request.region;
  const legacyMatchQuery = useQuery({
    queryKey: ["locations", "legacy-match", request.region],
    queryFn: () => resolveLegacyRegionText(request.region),
    enabled: needsLegacyMatch,
    staleTime: Infinity,
  });

  const savedLocation: LocationValue = {
    regionId: request.regionId ?? null,
    cityId: request.cityId ?? null,
    districtId: request.districtId ?? null,
  };
  const legacyResolved: LocationValue | null = legacyMatchQuery.data
    ? { regionId: legacyMatchQuery.data.regionId, cityId: legacyMatchQuery.data.cityId, districtId: null }
    : null;
  // What LocationSelector actually shows: whatever the user has already
  // committed (via onChange) takes priority; otherwise the request's own
  // saved location; otherwise, for a legacy request, the resolved match
  // once it arrives (or nothing, until then).
  const effectiveLocation: LocationValue =
    locationValue ?? (needsLegacyMatch ? (legacyResolved ?? EMPTY_LOCATION_VALUE) : savedLocation);

  // Same derivation as RequestForm's create path (Stage 6А): the legacy
  // `region` text — still what Match reads — is the selected city's name
  // if any, else the region's.
  const regionsForTextQuery = useQuery({
    queryKey: ["locations", "regions"],
    queryFn: listRegions,
    enabled: isEditing,
    staleTime: 5 * 60 * 1000,
  });
  const citiesForTextQuery = useQuery({
    queryKey: ["locations", "cities", effectiveLocation.regionId],
    queryFn: () => listCitiesByRegion(effectiveLocation.regionId as string),
    enabled: isEditing && Boolean(effectiveLocation.regionId),
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard", "requests"] });

  const updateMutation = useMutation({
    mutationFn: () => {
      const regionName = regionsForTextQuery.data?.find((r) => r.id === effectiveLocation.regionId)?.nameRu ?? "";
      const cityName = citiesForTextQuery.data?.find((c) => c.id === effectiveLocation.cityId)?.nameRu ?? "";
      return updateRequest(token as string, request.id, {
        region: cityName || regionName || request.region,
        regionId: effectiveLocation.regionId ?? undefined,
        cityId: effectiveLocation.cityId ?? undefined,
        districtId: effectiveLocation.districtId ?? undefined,
      });
    },
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

  function handleCancelEdit() {
    setIsEditing(false);
    setLocationValue(null); // back to "derive from the saved request" next time
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
            onClick={handleCancelEdit}
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

        <LocationSelector value={effectiveLocation} onChange={setLocationValue} />

        {formError ? <p className="text-[13px] text-destructive">{formError}</p> : null}

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            size="md"
            disabled={updateMutation.isPending || !effectiveLocation.regionId}
          >
            {updateMutation.isPending ? t("row.saving") : t("row.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCancelEdit}
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
