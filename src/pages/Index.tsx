import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Database, Wifi, HardDrive, Zap, BarChart3, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { searchAsset } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import DataGrid from "@/components/DataGrid";
import SkeletonGrid from "@/components/SkeletonGrid";
import BulkImport from "@/components/BulkImport";
import SearchHistory from "@/components/SearchHistory";
import ThemeToggle from "@/components/ThemeToggle";
import { useSearchHistory } from "@/hooks/use-search-history";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const SOURCE_ICONS: Record<string, { icon: typeof Database; label: string }> = {
  database: { icon: Database, label: "FROM_DATABASE" },
  local_dataset: { icon: HardDrive, label: "FROM_LOCAL_DATASET" },
  openfigi: { icon: Wifi, label: "FROM_OPENFIGI_API" },
};

const Index = () => {
  const { user, profile, signOut } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<FinancialAsset | null>(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [dbCount, setDbCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useSearchHistory();

  useEffect(() => {
    seedDatabase().then(() => refreshCount());
  }, []);

  const refreshCount = () => {
    supabase
      .from("financial_assets")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => setDbCount(count || 0));
  };

  useEffect(() => {
    const channel = supabase
      .channel("financial_assets_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_assets" }, () => refreshCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery || query).trim().toUpperCase();
    if (!q) return;

    setQuery(q);
    setLoading(true);
    setResult(null);
    setNotFound(false);
    setSource("");
    setShowHistory(false);

    const { asset, source: src } = await searchAsset(q);

    addEntry({ query: q, assetName: asset?.assetName || null, source: src });

    if (asset) {
      setResult(asset);
      setSource(src);
      refreshCount();
      const srcInfo = SOURCE_ICONS[src];
      toast(srcInfo?.label || "DATA_RETRIEVED_OK", { duration: 2000 });
    } else {
      setNotFound(true);
    }

    setLoading(false);
  }, [query, addEntry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const srcInfo = SOURCE_ICONS[source];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <span className="font-mono text-xs font-semibold text-foreground tracking-wide">ENRICHER</span>
            <span className="font-mono text-[10px] text-muted-foreground ml-1.5">v2.0</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted">
            <Database className="w-3 h-3 text-primary" />
            <span className="font-mono text-[10px] text-muted-foreground">{dbCount}</span>
          </div>
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Dashboard">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </Link>
          <ThemeToggle />
          <div className="flex items-center gap-1.5 pl-2 border-l border-border">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:block max-w-[100px] truncate">
              {profile?.display_name || user?.email}
            </span>
            <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Déconnexion">
              <LogOut className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="p-4 bg-card/50 border-b border-border">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            onFocus={() => history.length > 0 && setShowHistory(true)}
            onBlur={() => setTimeout(() => setShowHistory(false), 200)}
            placeholder="Rechercher un ISIN, ticker, symbole..."
            className="w-full h-12 pl-11 pr-4 bg-background border border-input rounded-xl font-mono text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-ring transition-all duration-200"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-between max-w-2xl mx-auto mt-2">
          <p className="label-xs">ISIN · TICKER · SYMBOL · RIC</p>
          <BulkImport onSelectResult={(asset) => { setResult(asset); setSource("database"); setNotFound(false); }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full p-4 space-y-4">
        <AnimatePresence>
          {showHistory && !loading && !result && (
            <SearchHistory key="history" history={history} onSelect={(q) => handleSearch(q)} onClear={clearHistory} />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {loading && <SkeletonGrid key="skeleton" />}

          {result && !loading && (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {srcInfo && (
                <div className="flex items-center gap-2 px-4 py-2 mb-3 rounded-lg bg-primary/5 border border-primary/10">
                  <srcInfo.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[10px] text-primary font-medium">{srcInfo.label}</span>
                </div>
              )}
              <DataGrid data={result} />
            </motion.div>
          )}

          {notFound && !loading && (
            <motion.div key="notfound" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-destructive" />
              </div>
              <p className="font-mono text-destructive text-sm font-semibold">IDENTIFIER_NOT_FOUND</p>
              <p className="text-muted-foreground text-xs mt-2 font-mono text-center">
                "{query}" ne correspond à aucun actif<br />(DB + dataset + OpenFIGI)
              </p>
            </motion.div>
          )}

          {!result && !loading && !notFound && !showHistory && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Search className="w-7 h-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-sm">Prêt à enrichir</p>
              <p className="text-muted-foreground text-xs mt-1 text-center max-w-sm">
                Entrez un ISIN ou ticker pour obtenir toutes les données financières
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5 justify-center items-center">
                <span className="label-xs mr-1">Pipeline:</span>
                {["DATABASE", "DATASET", "OPENFIGI"].map((step, i) => (
                  <span key={step} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-muted-foreground text-[10px]">→</span>}
                    <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground">{step}</span>
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {["AAPL", "US0378331005", "TTE", "MC", "NESN", "MSFT", "TSLA"].map((example) => (
                  <button
                    key={example}
                    onClick={() => { setQuery(example); handleSearch(example); }}
                    className="px-3 py-1.5 rounded-lg bg-muted text-foreground font-mono text-xs border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-150"
                  >
                    {example}
                  </button>
                ))}
              </div>

              {history.length > 0 && (
                <div className="mt-8 w-full">
                  <SearchHistory history={history.slice(0, 5)} onSelect={(q) => handleSearch(q)} onClear={clearHistory} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
