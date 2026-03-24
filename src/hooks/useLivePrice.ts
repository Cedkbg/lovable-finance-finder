import { useQuery } from "@tanstack/react-query";
import { fetchStockPrice } from "@/services/alphaVantage";

export interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export const useLivePrice = (symbol: string) => {
  return useQuery<LivePrice, Error>({
    queryKey: ["price", symbol],
    queryFn: () => fetchStockPrice(symbol),
    refetchInterval: 5000, // 5s pour real-time
    refetchOnWindowFocus: true,
    staleTime: 30_000, // 30s fresh
    gcTime: 5 * 60_000, // 5min cache
    retry: 3,
    enabled: !!symbol,
  });
};

