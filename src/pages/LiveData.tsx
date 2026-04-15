import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Activity, RefreshCw, Save, TrendingUp, TrendingDown, Minus, ArrowLeft, Loader2, Check, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

interface LiveQuote {
  code: string;
  exchange: string;
  timestamp: number;
  gmtoffset: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  previousClose: number;
  change: number;
  change_p: number;
}

interface TrackedAsset {
  ticker: string;
  exchange: string;
  name?: string;
  quote: LiveQuote | null;
  history: { time: string; price: number }[];
  loading: boolean;
  error?: string;
}

const DEFAULT_WATCHLIST = [
  { ticker: "AAPL", exchange: "US", name: "Apple Inc." },
  { ticker: "MSFT", exchange: "US", name: "Microsoft Corp." },
  { ticker: "GOOGL", exchange: "US", name: "Alphabet Inc." },
  { ticker: "TSLA", exchange: "US", name: "Tesla Inc." },
  { ticker: "AMZN", exchange: "US", name: "Amazon.com" },
  { ticker: "META", exchange: "US", name: "Meta Platforms" },
  { ticker: "NVDA", exchange: "US", name: "NVIDIA Corp." },
  { ticker: "JPM", exchange: "US", name: "JPMorgan Chase" },
];

const LiveData = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<TrackedAsset[]>(
    DEFAULT_WATCHLIST.map((w) => ({
      ...w,
      quote: null,
      history: [],
      loading: true,
    }))
  );
  const [selectedAsset, setSelectedAsset] = useState<string>("AAPL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLive, setIsLive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQuote = useCallback(async (ticker: string, exchange: string): Promise<LiveQuote | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("eodhd-lookup", {
        body: { mode: "realtime", ticker, exchange },
      });
      if (error || !data?.asset) return null;
      return data.asset as LiveQuote;
    } catch {
      return null;
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const updated = await Promise.all(
      assets.map(async (asset) => {
        const quote = await fetchQuote(asset.ticker, asset.exchange);
        const newHistory = quote
          ? [...asset.history.slice(-29), { time: timeStr, price: quote.close || quote.previousClose || 0 }]
          : asset.history;
        return {
          ...asset,
          quote: quote || asset.quote,
          history: newHistory,
          loading: false,
          error: quote ? undefined : "Données indisponibles",
        };
      })
    );

    setAssets(updated);
    setLastUpdate(now);
    setIsRefreshing(false);
  }, [assets, fetchQuote]);

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => {
        refreshAll();
      }, 15000); // Refresh every 15s
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive, refreshAll]);

  const handleSaveToDb = async (asset: TrackedAsset) => {
    if (!asset.quote || !user) return;
    const key = `${asset.ticker}.${asset.exchange}`;
    setSavingIds((prev) => new Set(prev).add(key));

    try {
      const { error } = await supabase.from("financial_assets").upsert(
        {
          asset_name: asset.name || asset.ticker,
          isin: `LIVE-${asset.ticker}-${asset.exchange}`,
          ticker: asset.ticker,
          symbol: asset.ticker,
          ric: `${asset.ticker}.${asset.exchange}`,
          country_id: asset.exchange === "US" ? "US" : asset.exchange,
          mic_code: asset.exchange === "US" ? "XNAS" : asset.exchange,
          currency_id: "USD",
          currency: "US Dollar",
          sector: "Equity",
          description: `${asset.name || asset.ticker} — Live quote: ${asset.quote.close}`,
          source: "eodhd",
          user_id: user.id,
        },
        { onConflict: "isin" }
      );

      if (error) throw error;
      setSavedIds((prev) => new Set(prev).add(key));
      toast.success(`${asset.ticker} sauvegardé dans Data Manager`);
    } catch (err: any) {
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setSavingIds((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  };

  const selectedData = assets.find((a) => a.ticker === selectedAsset);

  const getTrendIcon = (change_p: number | undefined) => {
    if (!change_p) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
    if (change_p > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
    return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  };

  const getChangeColor = (change_p: number | undefined) => {
    if (!change_p) return "text-muted-foreground";
    return change_p > 0 ? "text-emerald-500" : "text-red-500";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="font-mono text-xs font-semibold text-foreground tracking-wide">LIVE DATA</span>
          </div>
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
              isLive ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
            }`}
          >
            {isLive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {isLive ? "LIVE" : "PAUSED"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] font-mono text-muted-foreground">
              MAJ: {lastUpdate.toLocaleTimeString("fr-FR")}
            </span>
          )}
          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-mono font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            ACTUALISER
          </button>
          <Link to="/data" className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-xs font-mono font-semibold transition-all">
            DATA MANAGER
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Left: Asset cards */}
        <div className="lg:w-[420px] border-r border-border overflow-y-auto max-h-[calc(100vh-56px)]">
          <div className="p-3 border-b border-border bg-card/50">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Watchlist · {assets.length} actifs · Rafraîchissement {isLive ? "auto 15s" : "manuel"}
            </p>
          </div>
          <div className="divide-y divide-border">
            {assets.map((asset) => {
              const key = `${asset.ticker}.${asset.exchange}`;
              const isSaving = savingIds.has(key);
              const isSaved = savedIds.has(key);
              const isSelected = asset.ticker === selectedAsset;

              return (
                <motion.div
                  key={key}
                  onClick={() => setSelectedAsset(asset.ticker)}
                  className={`p-3 cursor-pointer transition-all hover:bg-muted/50 ${
                    isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                  }`}
                  layout
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${
                        asset.quote?.change_p && asset.quote.change_p > 0
                          ? "bg-emerald-500/10 text-emerald-500"
                          : asset.quote?.change_p && asset.quote.change_p < 0
                          ? "bg-red-500/10 text-red-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {asset.ticker.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold text-foreground">{asset.ticker}</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{asset.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        {asset.loading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                        ) : asset.quote ? (
                          <>
                            <p className="font-mono text-xs font-semibold text-foreground">
                              ${asset.quote.close?.toFixed(2) || "—"}
                            </p>
                            <div className={`flex items-center gap-0.5 justify-end ${getChangeColor(asset.quote.change_p)}`}>
                              {getTrendIcon(asset.quote.change_p)}
                              <span className="font-mono text-[10px] font-semibold">
                                {asset.quote.change_p ? `${asset.quote.change_p > 0 ? "+" : ""}${asset.quote.change_p.toFixed(2)}%` : "—"}
                              </span>
                            </div>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveToDb(asset); }}
                        disabled={isSaving || isSaved || !asset.quote}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-40"
                        title="Sauvegarder dans Data Manager"
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : isSaved ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Save className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Mini sparkline */}
                  {asset.history.length > 1 && (
                    <div className="mt-2 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={asset.history}>
                          <defs>
                            <linearGradient id={`grad-${asset.ticker}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={asset.quote?.change_p && asset.quote.change_p >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                              <stop offset="100%" stopColor={asset.quote?.change_p && asset.quote.change_p >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke={asset.quote?.change_p && asset.quote.change_p >= 0 ? "#10b981" : "#ef4444"}
                            fill={`url(#grad-${asset.ticker})`}
                            strokeWidth={1.5}
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right: Chart & details */}
        <div className="flex-1 p-4 overflow-y-auto">
          {selectedData && (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedData.ticker}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Title */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">{selectedData.name || selectedData.ticker}</h1>
                    <p className="font-mono text-xs text-muted-foreground">
                      {selectedData.ticker}.{selectedData.exchange} · Source: EODHD
                    </p>
                  </div>
                  {selectedData.quote && (
                    <div className="text-right">
                      <p className="text-2xl font-mono font-bold text-foreground">
                        ${selectedData.quote.close?.toFixed(2)}
                      </p>
                      <div className={`flex items-center gap-1 justify-end ${getChangeColor(selectedData.quote.change_p)}`}>
                        {getTrendIcon(selectedData.quote.change_p)}
                        <span className="font-mono text-sm font-semibold">
                          {selectedData.quote.change ? `${selectedData.quote.change > 0 ? "+" : ""}${selectedData.quote.change.toFixed(2)}` : ""}
                          {" "}({selectedData.quote.change_p ? `${selectedData.quote.change_p > 0 ? "+" : ""}${selectedData.quote.change_p.toFixed(2)}%` : ""})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Main chart */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      Évolution en temps réel
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-mono text-muted-foreground">LIVE</span>
                    </div>
                  </div>
                  {selectedData.history.length > 1 ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedData.history}>
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: 12,
                              fontFamily: "monospace",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="price"
                            stroke="hsl(var(--primary))"
                            fill="url(#chartGrad)"
                            strokeWidth={2}
                            dot={false}
                            animationDuration={300}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground font-mono">En attente de données...</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Le graphique s'affichera après 2 actualisations</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quote details */}
                {selectedData.quote && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Ouverture", value: selectedData.quote.open?.toFixed(2) },
                      { label: "Haut", value: selectedData.quote.high?.toFixed(2) },
                      { label: "Bas", value: selectedData.quote.low?.toFixed(2) },
                      { label: "Clôture préc.", value: selectedData.quote.previousClose?.toFixed(2) },
                      { label: "Volume", value: selectedData.quote.volume?.toLocaleString() },
                      { label: "Variation", value: selectedData.quote.change?.toFixed(2) },
                      { label: "Variation %", value: `${selectedData.quote.change_p?.toFixed(2)}%` },
                      { label: "Timestamp", value: selectedData.quote.timestamp ? new Date(selectedData.quote.timestamp * 1000).toLocaleTimeString("fr-FR") : "—" },
                    ].map((item) => (
                      <div key={item.label} className="bg-card rounded-lg border border-border p-3">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase">{item.label}</p>
                        <p className="font-mono text-sm font-semibold text-foreground mt-1">{item.value || "—"}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveData;
