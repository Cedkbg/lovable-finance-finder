import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Listens for new assets inserted by OTHER users and shows toast notifications.
 */
export function useAssetNotifications() {
  const { user } = useAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    // Skip notifications for the first few seconds to avoid noise on page load
    const timer = setTimeout(() => {
      initializedRef.current = true;
    }, 3000);

    const channel = supabase
      .channel("asset_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "financial_assets" },
        (payload) => {
          if (!initializedRef.current) return;
          const newAsset = payload.new as any;
          // Only notify for assets inserted by OTHER users
          if (newAsset.user_id && newAsset.user_id !== user.id) {
            toast.info(`Nouvel actif importé: ${newAsset.asset_name || newAsset.isin}`, {
              description: `Source: ${newAsset.source || "manual"} · ${newAsset.country || ""}`,
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user]);
}
