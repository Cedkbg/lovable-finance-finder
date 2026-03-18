import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import ThemeToggle from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Search,
  Plus,
  X,
  Star,
  BarChart3,
  TrendingUp,
  Globe,
  Building2,
  Hash,
  Layers,
} from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

const COMPARE_FIELDS: { key: keyof FinancialAsset; label: string; icon: typeof Globe }[] = [
  { key: "assetName", label: "Nom", icon: Building2 },
  { key: "isin", label: "ISIN", icon: Hash },
  { key: "ticker", label: "Ticker", icon: Hash },
  { key: "symbol", label: "Symbol", icon: Hash },
  { key: "ric", label: "RIC", icon: Hash },
  { key: "acf", label: "ACF/FIGI", icon: Layers },
  { key: "sector", label: "Secteur", icon: Layers },
  { key: "country", label: "Pays", icon: Globe },
  { key: "countryId", label: "Code Pays", icon: Globe },
  { key: "micCode", label: "MIC", icon: Building2 },
  { key: "currency", label: "Devise", icon: TrendingUp },
  { key: "currencyId", label: "Code Devise", icon: TrendingUp },
  { key: "source", label: "Source", icon: Layers },
  { key: "description", label: "Description", icon: Layers },
];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

const Compare = () => {
  const [allAssets, setAllAssets] = useState<FinancialAsset[]>([]);
  const [selected, setSelected] = useState<FinancialAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    supabase
      .from("financial_assets")
      .select("*")
      .order("asset_name")
      .then(({ data }) => {
        if (data) setAllAssets(data.map((d) => dbToFinancialAsset(d as DbAsset)));
      });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allAssets
      .filter(
        (a) =>
          !selected.find((s) => s.id === a.id) &&
          (a.assetName.toLowerCase().includes(q) ||
            a.isin.toLowerCase().includes(q) ||
            a.ticker.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [searchQuery, allAssets, selected]);

  const addAsset = (asset: FinancialAsset) => {
    if (selected.length >= 4) return;
    setSelected((prev) => [...prev, asset]);
    setSearchQuery("");
    setShowSearch(false);
  };

  const removeAsset = (id: string) => {
    setSelected((prev) => prev.filter((a) => a.id !== id));
  };

  // Chart data: field completeness comparison
  const completenessData = useMemo(() => {
    const fields: (keyof FinancialAsset)[] = ["isin", "ticker", "ric", "acf", "sector", "country", "currency", "description"];
    return fields.map((field) => {
      const row: any = { field: field.toUpperCase() };
      selected.forEach((asset, i) => {
        row[`asset${i}`] = asset[field] ? 1 : 0;
      });
      return row;
    });
  }, [selected]);

  // Radar data
  const radarData = useMemo(() => {
    const fields: { key: keyof FinancialAsset; label: string }[] = [
      { key: "isin", label: "ISIN" },
      { key: "ticker", label: "Ticker" },
      { key: "ric", label: "RIC" },
      { key: "acf", label: "FIGI" },
      { key: "sector", label: "Secteur" },
      { key: "country", label: "Pays" },
      { key: "currency", label: "Devise" },
      { key: "micCode", label: "MIC" },
    ];
    return fields.map((f) => {
      const row: any = { field: f.label };
      selected.forEach((asset, i) => {
        row[`asset${i}`] = asset[f.key] ? 100 : 0;
      });
      return row;
    });
  }, [selected]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    selected.forEach((asset, i) => {
      config[`asset${i}`] = { label: asset.ticker || asset.assetName, color: COLORS[i] };
    });
    return config;
  }, [selected]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground tracking-wide">COMPARATEUR</span>
          <Badge variant="outline" className="text-[9px] font-mono">
            {selected.length}/4 ACTIFS
          </Badge>
        </div>
        <ThemeToggle />
      </header>

      {/* Asset selector */}
      <div className="border-b border-border bg-card/50 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {selected.map((asset, i) => (
            <motion.div
              key={asset.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card"
              style={{ borderLeftColor: COLORS[i], borderLeftWidth: 3 }}
            >
              <span className="font-mono text-xs font-semibold" style={{ color: COLORS[i] }}>
                {asset.ticker || asset.isin.slice(0, 6)}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
                {asset.assetName}
              </span>
              <button onClick={() => removeAsset(asset.id)} className="p-0.5 rounded hover:bg-destructive/10">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </motion.div>
          ))}

          {selected.length < 4 && (
            <div className="relative">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary font-mono text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                AJOUTER
              </button>

              <AnimatePresence>
                {showSearch && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden"
                  >
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Rechercher un actif..."
                          className="w-full h-8 pl-8 pr-3 bg-background border border-input rounded-md font-mono text-xs focus:outline-none focus:border-primary"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {searchResults.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => addAsset(asset)}
                          className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center gap-2"
                        >
                          <span className="font-mono text-xs font-semibold text-foreground">{asset.ticker || "—"}</span>
                          <span className="font-mono text-[10px] text-muted-foreground truncate">{asset.assetName}</span>
                          <span className="ml-auto font-mono text-[9px] text-muted-foreground">{asset.country}</span>
                        </button>
                      ))}
                      {searchQuery && searchResults.length === 0 && (
                        <p className="p-3 text-center text-muted-foreground text-xs">Aucun résultat</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {selected.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="w-7 h-7 text-primary" />
            </div>
            <p className="font-semibold text-foreground text-sm">Comparateur d'actifs</p>
            <p className="text-muted-foreground text-xs mt-1 text-center max-w-sm">
              Sélectionnez jusqu'à 4 actifs pour les comparer côte à côte
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Comparison table */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="px-4 py-3 border-b border-border bg-primary/5">
                <p className="font-mono text-xs font-semibold text-primary">COMPARAISON DÉTAILLÉE</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-3 py-2 text-left font-mono text-[10px] text-muted-foreground border-b border-r border-border w-32">
                        CHAMP
                      </th>
                      {selected.map((asset, i) => (
                        <th
                          key={asset.id}
                          className="px-3 py-2 text-left font-mono text-[10px] border-b border-r border-border"
                          style={{ color: COLORS[i] }}
                        >
                          {asset.ticker || asset.isin.slice(0, 8)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map((field) => {
                      const Icon = field.icon;
                      return (
                        <tr key={field.key} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 border-b border-r border-border/50 font-mono text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Icon className="w-3 h-3" />
                              {field.label}
                            </span>
                          </td>
                          {selected.map((asset) => (
                            <td key={asset.id} className="px-3 py-1.5 border-b border-r border-border/50 font-mono text-[11px] text-foreground">
                              {asset[field.key] || <span className="text-muted-foreground/50">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts */}
            {selected.length >= 2 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Completeness bar chart */}
                <div className="border border-border rounded-xl bg-card p-4">
                  <p className="font-mono text-[10px] font-semibold text-muted-foreground mb-3">COMPLÉTUDE DES DONNÉES</p>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <BarChart data={completenessData}>
                      <XAxis dataKey="field" tick={{ fontSize: 9, fontFamily: "monospace" }} />
                      <YAxis tick={{ fontSize: 9 }} domain={[0, 1]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {selected.map((_, i) => (
                        <Bar key={i} dataKey={`asset${i}`} fill={COLORS[i]} radius={[2, 2, 0, 0]} />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>

                {/* Radar chart */}
                <div className="border border-border rounded-xl bg-card p-4">
                  <p className="font-mono text-[10px] font-semibold text-muted-foreground mb-3">COUVERTURE RADAR</p>
                  <ChartContainer config={chartConfig} className="h-[250px]">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="field" tick={{ fontSize: 9, fontFamily: "monospace" }} />
                      <PolarRadiusAxis tick={false} domain={[0, 100]} />
                      {selected.map((_, i) => (
                        <Radar
                          key={i}
                          dataKey={`asset${i}`}
                          stroke={COLORS[i]}
                          fill={COLORS[i]}
                          fillOpacity={0.15}
                          strokeWidth={2}
                        />
                      ))}
                    </RadarChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Compare;
