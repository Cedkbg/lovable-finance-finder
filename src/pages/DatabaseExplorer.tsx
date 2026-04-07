import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import ThemeToggle from "@/components/ThemeToggle";
import { ArrowLeft, Database, Search, RefreshCw, BarChart3, Globe, Briefcase, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const DatabaseExplorer = () => {
  const [assets, setAssets] = useState<FinancialAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTable, setSelectedTable] = useState("financial_assets");
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});

  const fetchAll = async () => {
    setLoading(true);
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("financial_assets")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }
    setAssets(allData.map((d) => dbToFinancialAsset(d as DbAsset)));

    // Table counts
    const counts: Record<string, number> = { financial_assets: allData.length };
    const { count: favCount } = await supabase.from("favorites").select("*", { count: "exact", head: true });
    counts.favorites = favCount || 0;
    const { count: profCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    counts.profiles = profCount || 0;
    setTableCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter((a) =>
      a.assetName.toLowerCase().includes(q) ||
      a.isin.toLowerCase().includes(q) ||
      a.ticker.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q) ||
      a.sector.toLowerCase().includes(q) ||
      (a.source || "").toLowerCase().includes(q)
    );
  }, [assets, searchQuery]);

  const stats = useMemo(() => {
    const byCountry = new Map<string, number>();
    const bySector = new Map<string, number>();
    const bySource = new Map<string, number>();
    for (const a of assets) {
      if (a.country) byCountry.set(a.country, (byCountry.get(a.country) || 0) + 1);
      if (a.sector) bySector.set(a.sector, (bySector.get(a.sector) || 0) + 1);
      const src = a.source || "unknown";
      bySource.set(src, (bySource.get(src) || 0) + 1);
    }
    return {
      byCountry: Array.from(byCountry.entries()).sort((a, b) => b[1] - a[1]),
      bySector: Array.from(bySector.entries()).sort((a, b) => b[1] - a[1]),
      bySource: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [assets]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <Database className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground tracking-wide">BASE DE DONNÉES</span>
          <Badge variant="outline" className="text-[9px] font-mono">{assets.length} ENREGISTREMENTS</Badge>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-secondary text-secondary-foreground font-mono text-[10px] border border-border hover:border-primary/30 transition-colors">
            <RefreshCw className="w-3 h-3" /> ACTUALISER
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Table selector + stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { key: "financial_assets", label: "Actifs Financiers", icon: Briefcase },
            { key: "favorites", label: "Favoris", icon: BarChart3 },
            { key: "profiles", label: "Profils", icon: Globe },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSelectedTable(key)}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selectedTable === key ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <Icon className="w-4 h-4 text-primary" />
              <div className="text-left">
                <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
                <div className="font-mono text-sm font-bold text-foreground">{(tableCounts[key] || 0).toLocaleString()}</div>
              </div>
            </button>
          ))}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <div className="text-left">
              <div className="font-mono text-[10px] text-muted-foreground">Sources</div>
              <div className="flex gap-1 flex-wrap">
                {stats.bySource.slice(0, 3).map(([src, count]) => (
                  <Badge key={src} variant="secondary" className="text-[9px] font-mono">{src}: {count}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[10px] font-semibold text-foreground">PAR PAYS (top 10)</span>
            </div>
            <div className="space-y-1">
              {stats.byCountry.slice(0, 10).map(([country, count]) => (
                <div key={country} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-foreground truncate max-w-[200px]">{country}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-primary/20" style={{ width: `${Math.min(100, (count / (stats.byCountry[0]?.[1] || 1)) * 100)}px` }}>
                      <div className="h-full rounded-full bg-primary" style={{ width: "100%" }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[10px] font-semibold text-foreground">PAR SECTEUR (top 10)</span>
            </div>
            <div className="space-y-1">
              {stats.bySector.slice(0, 10).map(([sector, count]) => (
                <div key={sector} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-foreground truncate max-w-[200px]">{sector}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 rounded-full bg-primary/20" style={{ width: `${Math.min(100, (count / (stats.bySector[0]?.[1] || 1)) * 100)}px` }}>
                      <div className="h-full rounded-full bg-primary" style={{ width: "100%" }} />
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Search + data table */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans la base..."
            className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">#</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nom</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">ISIN</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Ticker</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Secteur</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Pays</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Source</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((a, i) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 text-foreground max-w-[200px] truncate">{a.assetName}</td>
                    <td className="px-3 py-1.5 text-foreground">{a.isin}</td>
                    <td className="px-3 py-1.5 text-foreground">{a.ticker}</td>
                    <td className="px-3 py-1.5"><Badge variant="outline" className="text-[9px]">{a.sector || "—"}</Badge></td>
                    <td className="px-3 py-1.5 text-foreground">{a.country || "—"}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant={a.source === "eodhd" ? "default" : "secondary"} className="text-[9px]">
                        {a.source || "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{new Date(a.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="px-3 py-2 text-center text-[10px] text-muted-foreground font-mono bg-muted/30">
                Affichage des 200 premiers sur {filtered.length.toLocaleString()} résultats
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DatabaseExplorer;
