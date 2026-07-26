"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useFavorites } from "@/lib/favorites/useFavorites";

export function FavoriteButton({
  carId,
  className,
  label,
}: {
  carId: string;
  className?: string;
  label: string;
}) {
  const router = useRouter();
  const { status } = useAuth();
  const { favoriteIds, toggle, isMutating } = useFavorites();
  const active = favoriteIds.has(carId);

  function handleClick() {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    toggle(carId);
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active ? `Убрать «${label}» из избранного` : `Добавить «${label}» в избранное`
      }
      onClick={handleClick}
      disabled={isMutating}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-foreground/70 transition-colors hover:text-brand disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <Heart
        size={18}
        className={active ? "fill-brand text-brand" : undefined}
      />
    </button>
  );
}
