import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  ArrowLeft,
  Download,
  Save,
  Trash2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Check,
  X,
  Loader2,
  RefreshCw,
  FolderOpen,
  FileText,
  BarChart3,
  Star,
  Zap,
  Wifi,
  BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLUMNS: { key: keyof FinancialAsset; label: string; width: string }[] = [
  { key: "assetName", label: "Nom", width: "200px" },
  { key: "isin", label: "ISIN", width: "140px" },
  { key: "ticker", label: "Ticker", width: "80px" },
  { key: "symbol", label: "Symbol", width: "80px" },
  { key: "ric", label: "RIC", width: "120px" },
  { key: "acf", label: "ACF/FIGI", width: "140px" },
  { key: "sector", label: "Secteur", width: "120px" },
  { key: "country", label: "Pays", width: "120px" },
  { key: "countryId", label: "Code Pays", width: "80px" },
  { key: "micCode", label: "MIC", width: "80px" },
  { key: "currency", label: "Devise", width: "80px" },
  { key: "currencyId", label: "Code Devise", width: "80px" },
  { key: "source", label: "Source", width: "80px" },
  { key: "description", label: "Description", width: "250px" },
];

const SECTOR_LIST = [
  "Equity", "Fixed Income", "Commodity", "Currency", "Index",
  "Finance", "Banking", "Insurance", "Asset Management",
  "Technology", "Software", "Hardware", "Semiconductors",
  "Healthcare", "Pharmaceuticals", "Biotechnology", "Medical Devices",
  "Energy", "Oil & Gas", "Renewable Energy", "Utilities",
  "Real Estate", "REIT", "Construction",
  "Consumer Goods", "Retail", "E-Commerce", "Food & Beverage", "Luxury",
  "Industrials", "Manufacturing", "Aerospace & Defense", "Transportation",
  "Telecommunications", "Media", "Entertainment",
  "Materials", "Chemicals", "Mining", "Metals",
  "Agriculture", "Forestry", "Fishing",
  "Import & Export", "Trade", "Logistics", "Supply Chain",
  "Government", "Municipal", "Sovereign",
  "ETF", "ETP", "Mutual Fund", "Hedge Fund",
  "Derivatives", "Options", "Futures", "Warrants",
  "Crypto", "Digital Assets",
  "Private Equity", "Venture Capital",
  "Other",
];

const PAGE_SIZE = 50;

interface SavedFile {
  id: string;
  name: string;
  count: number;
  createdAt: string;
}

const DataManager = () => {
  const { user } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();
  const [assets, setAssets] = useState<FinancialAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<keyof FinancialAsset | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{ row: number; col: keyof FinancialAsset } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [showFileManager, setShowFileManager] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("disconnected");
  const editRef = useRef<HTMLInputElement>(null);

  // Load all assets from DB
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    // Fetch all assets (handle >1000 rows)
    let allData: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("financial_assets")
        .select("*")
        .order("asset_name")
        .range(from, from + batchSize - 1);
      if (error || !data || data.length === 0) break;
      allData = [...allData, ...data];
      if (data.length < batchSize) break;
      from += batchSize;
    }
    setAssets(allData.map((d) => dbToFinancialAsset(d as DbAsset)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
    const files = JSON.parse(localStorage.getItem("enricher_saved_files") || "[]");
    setSavedFiles(files);

    // Realtime subscription
    const channel = supabase
      .channel("datamanager_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_assets" }, (payload) => {
        // Granular update instead of full refetch
        if (payload.eventType === "INSERT" && payload.new) {
          setAssets((prev) => [...prev, dbToFinancialAsset(payload.new as DbAsset)]);
        } else if (payload.eventType === "UPDATE" && payload.new) {
          const updated = dbToFinancialAsset(payload.new as DbAsset);
          setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        } else if (payload.eventType === "DELETE" && payload.old) {
          setAssets((prev) => prev.filter((a) => a.id !== (payload.old as any).id));
        }
      })
      .subscribe((status) => {
        setRealtimeStatus(status === "SUBSCRIBED" ? "connected" : "disconnected");
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchAssets]);

  // Filters
  const sectors = useMemo(() => {
    const fromData = new Set(assets.map((a) => a.sector).filter(Boolean));
    const all = new Set([...SECTOR_LIST, ...fromData]);
    return Array.from(all).sort();
  }, [assets]);

  const countries = useMemo(() => {
    const c = new Set(assets.map((a) => a.country).filter(Boolean));
    return Array.from(c).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    let result = [...assets];
    if (showFavoritesOnly) {
      result = result.filter((a) => isFavorite(a.id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.assetName.toLowerCase().includes(q) ||
          a.isin.toLowerCase().includes(q) ||
          a.ticker.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          a.ric.toLowerCase().includes(q) ||
          a.country.toLowerCase().includes(q)
      );
    }
    if (sectorFilter) result = result.filter((a) => a.sector === sectorFilter);
    if (countryFilter) result = result.filter((a) => a.country === countryFilter);
    if (sortKey) {
      result.sort((a, b) => {
        const va = String(a[sortKey] || "").toLowerCase();
        const vb = String(b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [assets, searchQuery, sectorFilter, countryFilter, sortKey, sortDir, showFavoritesOnly, isFavorite]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAssets = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: keyof FinancialAsset) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(0);
  };

  const startEdit = (rowIdx: number, col: keyof FinancialAsset) => {
    const asset = pageAssets[rowIdx];
    setEditingCell({ row: rowIdx, col });
    setEditValue(String(asset[col] || ""));
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const asset = pageAssets[editingCell.row];
    const col = editingCell.col;
    const keyMap: Record<string, string> = {
      assetName: "asset_name", countryId: "country_id", micCode: "mic_code",
      currencyId: "currency_id", createdAt: "created_at", updatedAt: "updated_at",
    };
    const dbCol = keyMap[col] || col;

    const { error } = await supabase
      .from("financial_assets")
      .update({ [dbCol]: editValue })
      .eq("id", asset.id);

    if (error) {
      toast.error("Erreur de sauvegarde");
    } else {
      toast.success("Cellule mise à jour");
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, [col]: editValue } : a)));
    }
    setEditingCell(null);
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };

  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const ids = Array.from(selectedRows);
    const { error } = await supabase.from("financial_assets").delete().in("id", ids);
    if (error) toast.error("Erreur de suppression");
    else { toast.success(`${ids.length} actif(s) supprimé(s)`); setSelectedRows(new Set()); fetchAssets(); }
  };

  const exportExcel = (filename = "enricher_data") => {
    const rows = filtered.map((a, i) => {
      const row: Record<string, string> = { "#": String(i + 1) };
      COLUMNS.forEach((col) => { row[col.label] = String(a[col.key] || ""); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => (r[key] || "").length)).valueOf() + 2,
    }));
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
    toast.success(`"${filename}.xlsx" exporté`);
  };

  const saveAsFile = () => {
    const name = prompt("Nom du fichier:", `export_${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;
    exportExcel(name);
    const file: SavedFile = { id: crypto.randomUUID(), name: `${name}.xlsx`, count: filtered.length, createdAt: new Date().toISOString() };
    const updated = [file, ...savedFiles];
    setSavedFiles(updated);
    localStorage.setItem("enricher_saved_files", JSON.stringify(updated));
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const selectAll = () => {
    if (selectedRows.size === pageAssets.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(pageAssets.map((a) => a.id)));
  };

  const deleteSavedFile = (fileId: string) => {
    const updated = savedFiles.filter((f) => f.id !== fileId);
    setSavedFiles(updated);
    localStorage.setItem("enricher_saved_files", JSON.stringify(updated));
    toast.success("Fichier supprimé");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-semibold text-foreground tracking-wide">DATA MANAGER</span>
          <Badge variant="outline" className="text-[9px] font-mono">
            {assets.length} ACTIFS
          </Badge>
          {/* Realtime indicator */}
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${realtimeStatus === "connected" ? "bg-[hsl(var(--success))] animate-pulse" : "bg-destructive"}`} />
            <span className="font-mono text-[9px] text-muted-foreground">
              {realtimeStatus === "connected" ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/compare" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Comparateur">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              placeholder="Rechercher..."
              className="w-full h-8 pl-9 pr-3 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select
              value={sectorFilter}
              onChange={(e) => { setSectorFilter(e.target.value); setPage(0); }}
              className="h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Tous secteurs</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <select
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value); setPage(0); }}
            className="h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">Tous pays</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Favorites toggle */}
          <button
            onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setPage(0); }}
            className={`flex items-center gap-1 px-2.5 h-8 rounded-lg font-mono text-[10px] border transition-colors ${
              showFavoritesOnly
                ? "bg-[hsl(var(--warning))]/20 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30"
                : "bg-secondary text-secondary-foreground border-border hover:border-primary/30"
            }`}
          >
            <Star className={`w-3 h-3 ${showFavoritesOnly ? "fill-current" : ""}`} />
            FAVORIS
          </button>

          <div className="h-6 w-px bg-border mx-1" />

          <button
            onClick={() => fetchAssets()}
            className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-secondary text-secondary-foreground font-mono text-[10px] border border-border hover:border-primary/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> ACTUALISER
          </button>

          {selectedRows.size > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-destructive/10 text-destructive font-mono text-[10px] border border-destructive/20 hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> SUPPRIMER ({selectedRows.size})
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={() => setShowFileManager(!showFileManager)}
            className={`flex items-center gap-1 px-2.5 h-8 rounded-lg font-mono text-[10px] border transition-colors ${
              showFileManager ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:border-primary/30"
            }`}
          >
            <FolderOpen className="w-3 h-3" /> FICHIERS ({savedFiles.length})
          </button>

          <button
            onClick={saveAsFile}
            className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-primary/10 text-primary font-mono text-[10px] border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <Save className="w-3 h-3" /> ENREGISTRER SOUS
          </button>

          <button
            onClick={() => exportExcel()}
            className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-primary text-primary-foreground font-mono text-[10px] hover:bg-primary/90 transition-colors"
          >
            <Download className="w-3 h-3" /> XLSX ({filtered.length})
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File Manager Sidebar */}
        <AnimatePresence>
          {showFileManager && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-border bg-card overflow-y-auto flex-shrink-0"
            >
              <div className="p-3">
                <h3 className="font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gestionnaire de fichiers
                </h3>
                {savedFiles.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center py-8">
                    Aucun fichier enregistré.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {savedFiles.map((file) => (
                      <div key={file.id} className="group flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors">
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] text-foreground truncate">{file.name}</p>
                          <p className="font-mono text-[9px] text-muted-foreground">
                            {file.count} actifs · {new Date(file.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <button onClick={() => deleteSavedFile(file.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted">
                    <tr>
                      <th className="w-10 px-2 py-2 border-b border-r border-border text-center">
                        <input
                          type="checkbox"
                          checked={selectedRows.size === pageAssets.length && pageAssets.length > 0}
                          onChange={selectAll}
                          className="w-3.5 h-3.5 rounded border-input accent-primary"
                        />
                      </th>
                      <th className="w-8 px-1 py-2 border-b border-r border-border font-mono text-[10px] text-muted-foreground text-center">
                        <Star className="w-3 h-3 mx-auto text-muted-foreground" />
                      </th>
                      <th className="w-10 px-2 py-2 border-b border-r border-border font-mono text-[10px] text-muted-foreground">#</th>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="px-2 py-2 border-b border-r border-border font-mono text-[10px] text-muted-foreground cursor-pointer select-none hover:text-primary hover:bg-primary/5 transition-colors whitespace-nowrap text-left"
                          style={{ minWidth: col.width }}
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {sortKey === col.key && (
                              <span className="text-primary text-[9px]">{sortDir === "asc" ? "▲" : "▼"}</span>
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageAssets.map((asset, rowIdx) => (
                      <tr
                        key={asset.id}
                        className={`group transition-colors ${
                          selectedRows.has(asset.id) ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="px-2 py-1 border-b border-r border-border/50 text-center">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(asset.id)}
                            onChange={() => toggleRow(asset.id)}
                            className="w-3.5 h-3.5 rounded border-input accent-primary"
                          />
                        </td>
                        <td className="px-1 py-1 border-b border-r border-border/50 text-center">
                          <button
                            onClick={() => toggleFavorite(asset.id)}
                            className="p-0.5 rounded hover:bg-[hsl(var(--warning))]/10 transition-colors"
                          >
                            <Star
                              className={`w-3.5 h-3.5 transition-colors ${
                                isFavorite(asset.id)
                                  ? "text-[hsl(var(--warning))] fill-[hsl(var(--warning))]"
                                  : "text-muted-foreground/30 hover:text-[hsl(var(--warning))]/50"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-2 py-1 border-b border-r border-border/50 font-mono text-[10px] text-muted-foreground text-center">
                          {page * PAGE_SIZE + rowIdx + 1}
                        </td>
                        {COLUMNS.map((col) => {
                          const isEditing = editingCell?.row === rowIdx && editingCell?.col === col.key;
                          return (
                            <td
                              key={col.key}
                              className="px-1 py-0.5 border-b border-r border-border/50 font-mono text-[11px] text-foreground"
                              style={{ minWidth: col.width }}
                              onDoubleClick={() => startEdit(rowIdx, col.key)}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-0.5">
                                  {col.key === "sector" ? (
                                    <select
                                      ref={editRef as any}
                                      value={editValue}
                                      onChange={(e) => { setEditValue(e.target.value); }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEdit();
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                      onBlur={() => saveEdit()}
                                      className="w-full h-6 px-1 bg-primary/5 border border-primary rounded text-[11px] font-mono focus:outline-none"
                                      autoFocus
                                    >
                                      <option value="">— Aucun —</option>
                                      {SECTOR_LIST.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                      {editValue && !SECTOR_LIST.includes(editValue) && (
                                        <option value={editValue}>{editValue}</option>
                                      )}
                                    </select>
                                  ) : (
                                    <input
                                      ref={editRef}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEdit();
                                        if (e.key === "Escape") cancelEdit();
                                      }}
                                      className="w-full h-6 px-1 bg-primary/5 border border-primary rounded text-[11px] font-mono focus:outline-none"
                                    />
                                  )}
                                  <button onClick={saveEdit} className="p-0.5 text-primary hover:bg-primary/10 rounded">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={cancelEdit} className="p-0.5 text-destructive hover:bg-destructive/10 rounded">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={`block truncate px-1 py-0.5 rounded cursor-default group-hover:cursor-text ${
                                    col.key === "description" ? "max-w-[250px]" : ""
                                  }`}
                                  title={String(asset[col.key] || "")}
                                >
                                  {asset[col.key] || "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {filtered.length} actif{filtered.length > 1 ? "s" : ""}
                    {(sectorFilter || countryFilter || searchQuery || showFavoritesOnly) && " (filtré)"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Page {page + 1}/{totalPages || 1}
                  </p>
                  {selectedRows.size > 0 && (
                    <Badge variant="outline" className="text-[9px] font-mono bg-primary/5 text-primary border-primary/20">
                      {selectedRows.size} sélectionné(s)
                    </Badge>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 9) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 9) pageNum = i;
                      else if (page < 4) pageNum = i;
                      else if (page > totalPages - 5) pageNum = totalPages - 9 + i;
                      else pageNum = page - 4 + i;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-6 h-6 rounded font-mono text-[10px] transition-colors ${
                            pageNum === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {pageNum + 1}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManager;
