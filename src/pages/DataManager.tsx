import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  Upload,
  Save,
  Trash2,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileSpreadsheet,
  Edit3,
  Check,
  X,
  Bold,
  Italic,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  RefreshCw,
  FolderOpen,
  FileText,
  BarChart3,
  Zap,
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

const PAGE_SIZE = 50;

interface SavedFile {
  id: string;
  name: string;
  count: number;
  createdAt: string;
}

const DataManager = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<FinancialAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof FinancialAsset | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{ row: number; col: keyof FinancialAsset } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [showFileManager, setShowFileManager] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);

  // Load all assets from DB
  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financial_assets")
      .select("*")
      .order("asset_name");

    if (!error && data) {
      setAssets(data.map((d) => dbToFinancialAsset(d as DbAsset)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
    // Load saved files list from localStorage
    const files = JSON.parse(localStorage.getItem("enricher_saved_files") || "[]");
    setSavedFiles(files);

    // Realtime
    const channel = supabase
      .channel("datamanager_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "financial_assets" }, () => fetchAssets())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAssets]);

  // Filters
  const sectors = useMemo(() => {
    const s = new Set(assets.map((a) => a.sector).filter(Boolean));
    return Array.from(s).sort();
  }, [assets]);

  const countries = useMemo(() => {
    const c = new Set(assets.map((a) => a.country).filter(Boolean));
    return Array.from(c).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    let result = [...assets];
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
  }, [assets, searchQuery, sectorFilter, countryFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAssets = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: keyof FinancialAsset) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  // Edit cell
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

    // Map camelCase to snake_case for DB
    const keyMap: Record<string, string> = {
      assetName: "asset_name",
      countryId: "country_id",
      micCode: "mic_code",
      currencyId: "currency_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };
    const dbCol = keyMap[col] || col;

    const { error } = await supabase
      .from("financial_assets")
      .update({ [dbCol]: editValue })
      .eq("id", asset.id);

    if (error) {
      toast.error("Erreur de sauvegarde");
      console.error(error);
    } else {
      toast.success("Cellule mise à jour");
      // Update local state
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? { ...a, [col]: editValue } : a))
      );
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Delete selected
  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const ids = Array.from(selectedRows);
    
    const { error } = await supabase
      .from("financial_assets")
      .delete()
      .in("id", ids);

    if (error) {
      toast.error("Erreur de suppression");
    } else {
      toast.success(`${ids.length} actif(s) supprimé(s)`);
      setSelectedRows(new Set());
      fetchAssets();
    }
  };

  // Export Excel
  const exportExcel = (filename = "enricher_data") => {
    const rows = filtered.map((a, i) => {
      const row: Record<string, string> = { "#": String(i + 1) };
      COLUMNS.forEach((col) => {
        row[col.label] = String(a[col.key] || "");
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...rows.map((r) => (r[key] || "").length)).valueOf() + 2,
    }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Données");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    saveAs(blob, `${filename}.xlsx`);
    toast.success(`Fichier "${filename}.xlsx" exporté`);
  };

  // Save as named file
  const saveAsFile = () => {
    const name = prompt("Nom du fichier:", `export_${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;
    
    exportExcel(name);
    
    const file: SavedFile = {
      id: crypto.randomUUID(),
      name: `${name}.xlsx`,
      count: filtered.length,
      createdAt: new Date().toISOString(),
    };
    const updated = [file, ...savedFiles];
    setSavedFiles(updated);
    localStorage.setItem("enricher_saved_files", JSON.stringify(updated));
    toast.success(`Fichier "${name}.xlsx" enregistré dans le gestionnaire`);
  };

  // Toggle row selection
  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRows.size === pageAssets.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(pageAssets.map((a) => a.id)));
    }
  };

  // Delete a saved file entry
  const deleteSavedFile = (fileId: string) => {
    const updated = savedFiles.filter((f) => f.id !== fileId);
    setSavedFiles(updated);
    localStorage.setItem("enricher_saved_files", JSON.stringify(updated));
    toast.success("Fichier supprimé du gestionnaire");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs font-semibold text-foreground tracking-wide">DATA MANAGER</span>
            <Badge variant="outline" className="text-[9px] font-mono">
              {assets.length} ACTIFS
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Dashboard">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-border bg-card/50 px-4 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
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

          {/* Sector filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select
              value={sectorFilter}
              onChange={(e) => { setSectorFilter(e.target.value); setPage(0); }}
              className="h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Tous secteurs</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Country filter */}
          <select
            value={countryFilter}
            onChange={(e) => { setCountryFilter(e.target.value); setPage(0); }}
            className="h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">Tous pays</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Text tools */}
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Gras">
              <Bold className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Italique">
              <Italic className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Police">
              <Type className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Aligner gauche">
              <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Centrer">
              <AlignCenter className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Aligner droite">
              <AlignRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Actions */}
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
                    Aucun fichier enregistré.<br />
                    Cliquez "Enregistrer sous" pour créer un fichier.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {savedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="group flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-[11px] text-foreground truncate">{file.name}</p>
                          <p className="font-mono text-[9px] text-muted-foreground">
                            {file.count} actifs · {new Date(file.createdAt).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteSavedFile(file.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                        >
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
              {/* Excel-like table */}
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
                      <th className="w-10 px-2 py-2 border-b border-r border-border font-mono text-[10px] text-muted-foreground">
                        #
                      </th>
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
                    {(sectorFilter || countryFilter || searchQuery) && " (filtré)"}
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
