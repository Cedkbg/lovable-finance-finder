import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorites")
      .select("asset_id")
      .eq("user_id", user.id);
    if (data) {
      setFavoriteIds(new Set(data.map((f: any) => f.asset_id)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
    if (!user) return;
    const channel = supabase
      .channel("favorites_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, () => fetchFavorites())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchFavorites, user]);

  const toggleFavorite = useCallback(async (assetId: string) => {
    if (!user) return;
    if (favoriteIds.has(assetId)) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("asset_id", assetId);
      setFavoriteIds((prev) => { const next = new Set(prev); next.delete(assetId); return next; });
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, asset_id: assetId });
      setFavoriteIds((prev) => new Set(prev).add(assetId));
    }
  }, [user, favoriteIds]);

  const isFavorite = useCallback((assetId: string) => favoriteIds.has(assetId), [favoriteIds]);

  return { favoriteIds, toggleFavorite, isFavorite, loading };
}
