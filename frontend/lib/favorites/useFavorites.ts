"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/AuthProvider";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/api/favorites";

const FAVORITES_KEY = ["favorites"];

// useFavorites is the single source of truth for "which cars does the
// current user have favorited" — every FavoriteButton and the dashboard
// favorites page share this one query, so toggling on one screen is
// reflected everywhere else without a manual refresh.
export function useFavorites() {
  const { token, status } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: () => listFavorites(token as string),
    enabled: status === "authenticated" && Boolean(token),
  });

  const favoriteIds = new Set((query.data ?? []).map((car) => car.id));

  const addMutation = useMutation({
    mutationFn: (carId: string) => addFavorite(token as string, carId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (carId: string) => removeFavorite(token as string, carId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FAVORITES_KEY }),
  });

  function toggle(carId: string) {
    if (favoriteIds.has(carId)) {
      removeMutation.mutate(carId);
    } else {
      addMutation.mutate(carId);
    }
  }

  return {
    favorites: query.data ?? [],
    favoriteIds,
    isLoading: query.isLoading,
    isError: query.isError,
    isMutating: addMutation.isPending || removeMutation.isPending,
    toggle,
  };
}
