import { useState, useCallback, useEffect } from "react";
import { Search, Database, Wifi, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { searchAsset, seedDatabase } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import DataGrid from "@/components/DataGrid";
import SkeletonGrid from "@/components/SkeletonGrid";
import BulkImport from "@/components/BulkImport";
import { supabase } from "@/integrations/supabase/client";

const SOURCE_ICONS: Record<string, { icon: typeof Database; label: string }> = {
  database: { icon: Database, label: "FROM_DATABASE" },
  local_dataset: { icon: HardDrive, label: "FROM_LOCAL_DATASET" },
  openfigi: { icon: Wifi, label: "FROM_OPENFIGI_API" },
};

const Index = () => {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<FinancialAsset | null>(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [dbCount, setDbCount] = useState(0);

  // Seed DB and get count on mount
  useEffect(() => {
    seedDatabase().then(() => {
      supabase
        .from("financial_assets")
        .select("*", { count: "exact", head: true })
        .then(({ count }) => setDbCount(count || 0));
    });
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim().toUpperCase();
    if (!q) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);
    setSource("");

    const { asset, source: src } = await searchAsset(q);

    if (asset) {
      setResult(asset);
      setSource(src);
      // Refresh count
      supabase
        .from("financial_assets")
        .select("*", { count: "exact", head: true })
        .then(({ count }) => setDbCount(count || 0));

      const srcInfo = SOURCE_ICONS[src];
      toast(srcInfo?.label || "DATA_RETRIEVED_OK", {
        style: {
          background: "hsl(240, 10%, 6%)",
          border: "1px solid hsl(142, 70%, 45%)",
          color: "hsl(142, 70%, 45%)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
        },
      });
    } else {
      setNotFound(true);
    }

    setLoading(false);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const srcInfo = SOURCE_ICONS[source];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs text-muted-foreground tracking-widest">
            ENRICHER_v2.0
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {dbCount} ASSETS_IN_DB
        </span>
      </header>

      {/* Search */}
      <div className="p-4 bg-card border-b border-border">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="WAITING_FOR_INPUT..."
            className="w-full h-12 pl-10 pr-4 bg-background border border-input rounded-lg font-mono text-primary text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-ring transition-all duration-200"
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
      <div className="flex-1 max-w-2xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {loading && <SkeletonGrid key="skeleton" />}

          {result && !loading && (
            <div key="result">
              {srcInfo && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary/20 border-b border-border"
                >
                  <srcInfo.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[10px] text-primary">{srcInfo.label}</span>
                </motion.div>
              )}
              <DataGrid data={result} />
            </div>
          )}

          {notFound && !loading && (
            <motion.div
              key="notfound"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <p className="font-mono text-destructive text-sm">IDENTIFIER_NOT_FOUND</p>
              <p className="text-muted-foreground text-xs mt-2 font-mono">
                "{query}" ne correspond à aucun actif (DB + dataset + OpenFIGI)
              </p>
            </motion.div>
          )}

          {!result && !loading && !notFound && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <p className="font-mono text-muted-foreground text-sm">READY</p>
              <p className="text-muted-foreground/60 text-xs mt-2 font-mono">
                Entrez un ISIN ou ticker pour enrichir
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                <span className="label-xs">Pipeline:</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-mono text-secondary-foreground">1. DATABASE</span>
                <span className="text-muted-foreground text-[10px]">→</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-mono text-secondary-foreground">2. LOCAL_DATASET</span>
                <span className="text-muted-foreground text-[10px]">→</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-[10px] font-mono text-secondary-foreground">3. OPENFIGI_API</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {["AAPL", "US0378331005", "TTE", "MC", "NESN", "MSFT", "TSLA"].map((example) => (
                  <button
                    key={example}
                    onClick={() => setQuery(example)}
                    className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground font-mono text-xs border border-border hover:border-primary/30 transition-colors duration-150"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
