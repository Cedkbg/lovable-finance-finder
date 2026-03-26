import { useQuery } from "@tanstack/react-query";
import { getLivePrice  } from "@/services/alphaVantage";

export interface LivePrice {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export const useLivePrices = (symbols: string[]) => {
  return useQueries({
    queries: symbols.map(symbol => ({
      queryKey: ["price", symbol],
      queryFn: () => getLivePrice(symbol),
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 3,
      enabled: !!symbol,
    })),
  });
};

export const useLivePrice = (symbol: string) => useLivePrices([symbol])[0];

