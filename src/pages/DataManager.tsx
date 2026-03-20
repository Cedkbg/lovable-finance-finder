import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import { getCountryCodes } from "@/lib/country-codes";
import { normalizeCountryLabel, normalizeSectorLabel, SECTOR_TAXONOMY } from "@/lib/asset-labels";
import { COUNTRY_ZONES } from "@/lib/country-zones";
import type { FinancialAsset } from "@/lib/mock-data";
import ThemeToggle from "@/components/ThemeToggle";
import { toast } from "sonner";
import { motion } from "framer-motion";
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
  Eye,
  ChevronDown,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const COLUMNS: { key: keyof FinancialAsset; label: string; width: string }[] = [
  { key: "assetName", label: "Nom", width: "200px" },
  { key: "isin", label: "ISIN", width: "140px" },
  { key: "ticker", label: "Ticker", width: "80px" },
  { key: "symbol", label: "Symbol", width: "80px" },
  { key: "ric", label: "RIC", width: "120px" },
  { key: "acf", label: "ACF/FIGI", width: "140px" },
  { key: "sector", label: "Secteur", width: "160px" },
  { key: "country", label: "Pays", width: "160px" },
  { key: "countryId", label: "Code Pays", width: "90px" },
  { key: "micCode", label: "MIC", width: "90px" },
  { key: "currency", label: "Devise", width: "90px" },
  { key: "currencyId", label: "Code Devise", width: "100px" },
  { key: "source", label: "Source", width: "100px" },
  { key: "description", label: "Description", width: "260px" },
];

const PAGE_SIZE = 50;

type SortKey = keyof FinancialAsset | "";

interface SavedFileFilters {
  searchQuery: string;
  sectorFilter: string;
  countryFilter: string;
  showFavoritesOnly: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}

interface SavedFile {
  id: string;
  name: string;
  count: number;
  createdAt: string;
  assetIds: string[];
  filters: SavedFileFilters;
}

const isSortKey = (value: unknown): value is SortKey => {
  if (value === "") return true;
  return COLUMNS.some((col) => col.key === value);
};

const normalizeSavedFile = (raw: any): SavedFile => ({
  id: typeof raw?.id === "string" ? raw.id : crypto.randomUUID(),
  name: typeof raw?.name === "string" ? raw.name : `export_${new Date().toISOString().slice(0, 10)}.xlsx`,
  count: typeof raw?.count === "number" ? raw.count : 0,
  createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  assetIds: Array.isArray(raw?.assetIds) ? raw.assetIds.filter((id: unknown) => typeof id === "string") : [],
  filters: {
    searchQuery: typeof raw?.filters?.searchQuery === "string" ? raw.filters.searchQuery : "",
    sectorFilter: normalizeSectorLabel(typeof raw?.filters?.sectorFilter === "string" ? raw.filters.sectorFilter : ""),
    countryFilter: normalizeCountryLabel(typeof raw?.filters?.countryFilter === "string" ? raw.filters.countryFilter : ""),
    showFavoritesOnly: Boolean(raw?.filters?.showFavoritesOnly),
    sortKey: isSortKey(raw?.filters?.sortKey) ? raw.filters.sortKey : "",
    sortDir: raw?.filters?.sortDir === "desc" ? "desc" : "asc",
  },
});

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
  const [sortKey, setSortKey] = useState<SortKey>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingCell, setEditingCell] = useState<{ row: number; col: keyof FinancialAsset } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [activeSavedFileId, setActiveSavedFileId] = useState<string | null>(null);
  const [showFileManager, setShowFileManager] = useState(false);
  const [enrichingFilters, setEnrichingFilters] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "disconnected">("disconnected");
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showCountryZones, setShowCountryZones] = useState(false);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const persistSavedFiles = useCallback((files: SavedFile[]) => {
    localStorage.setItem("enricher_saved_files", JSON.stringify(files));
  }, []);

  const clearSavedFileView = useCallback(() => {
    setActiveSavedFileId(null);
  }, []);

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

    try {
      const rawFiles = JSON.parse(localStorage.getItem("enricher_saved_files") || "[]");
      if (Array.isArray(rawFiles)) {
        const normalizedFiles = rawFiles.map(normalizeSavedFile);
        setSavedFiles(normalizedFiles);
        persistSavedFiles(normalizedFiles);
      } else {
        setSavedFiles([]);
      }
    } catch {
      setSavedFiles([]);
      localStorage.removeItem("enricher_saved_files");
    }

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAssets, persistSavedFiles]);

  const sectorStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      const sector = normalizeSectorLabel(asset.sector);
      if (!sector) continue;
      counts.set(sector, (counts.get(sector) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [assets]);

  const countryStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      const country = normalizeCountryLabel(asset.country, asset.countryId, asset.micCode);
      if (!country || country === "Unknown") continue;
      counts.set(country, (counts.get(country) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [assets]);

  const sectors = useMemo(() => sectorStats.map(([name]) => name), [sectorStats]);
  const countries = useMemo(() => countryStats.map(([name]) => name), [countryStats]);
  const sectorEditorOptions = useMemo(
    () => Array.from(new Set([...SECTOR_TAXONOMY, ...sectors])).sort((a, b) => a.localeCompare(b)),
    [sectors],
  );

  // Filters
  const baseFiltered = useMemo(() => {
    let result = [...assets];
    if (showFavoritesOnly) {
      result = result.filter((a) => isFavorite(a.id));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => {
        const country = normalizeCountryLabel(a.country, a.countryId, a.micCode).toLowerCase();
        const sector = normalizeSectorLabel(a.sector).toLowerCase();
        return (
          a.assetName.toLowerCase().includes(q) ||
          a.isin.toLowerCase().includes(q) ||
          a.ticker.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          a.ric.toLowerCase().includes(q) ||
          country.includes(q) ||
          sector.includes(q)
        );
      });
    }

    if (sectorFilter) {
      result = result.filter((a) => normalizeSectorLabel(a.sector) === sectorFilter);
    }

    if (countryFilter) {
      result = result.filter(
        (a) => normalizeCountryLabel(a.country, a.countryId, a.micCode) === countryFilter,
      );
    }

    if (sortKey) {
      result.sort((a, b) => {
        const va = String(a[sortKey] || "").toLowerCase();
        const vb = String(b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [assets, searchQuery, sectorFilter, countryFilter, sortKey, sortDir, showFavoritesOnly, isFavorite]);

  const activeSavedFile = useMemo(
    () => savedFiles.find((file) => file.id === activeSavedFileId) || null,
    [savedFiles, activeSavedFileId],
  );

  const filtered = useMemo(() => {
    if (!activeSavedFile) return baseFiltered;
    if (activeSavedFile.assetIds.length === 0) return baseFiltered;

    const snapshot = new Set(activeSavedFile.assetIds);
    let result = assets.filter((asset) => snapshot.has(asset.id));
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = String(a[sortKey] || "").toLowerCase();
        const vb = String(b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [activeSavedFile, assets, baseFiltered, sortKey, sortDir]);

  useEffect(() => {
    setPage(0);
  }, [activeSavedFileId]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAssets = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key: keyof FinancialAsset) => {
    clearSavedFileView();
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
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
      assetName: "asset_name",
      countryId: "country_id",
      micCode: "mic_code",
      currencyId: "currency_id",
      createdAt: "created_at",
      updatedAt: "updated_at",
    };

    let valueToSave = editValue;
    if (col === "country") {
      valueToSave = normalizeCountryLabel(editValue, asset.countryId, asset.micCode);
    }
    if (col === "sector") {
      valueToSave = normalizeSectorLabel(editValue);
    }

    const dbCol = keyMap[col] || col;

    const { error } = await supabase
      .from("financial_assets")
      .update({ [dbCol]: valueToSave })
      .eq("id", asset.id);

    if (error) {
      toast.error("Erreur de sauvegarde");
    } else {
      toast.success("Cellule mise à jour");
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, [col]: valueToSave } : a)));
    }
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const deleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const ids = Array.from(selectedRows);
    const { error } = await supabase.from("financial_assets").delete().in("id", ids);
    if (error) toast.error("Erreur de suppression");
    else {
      toast.success(`${ids.length} actif(s) supprimé(s)`);
      setSelectedRows(new Set());
      fetchAssets();
    }
  };

  const exportExcel = (filename = "enricher_data") => {
    const rows = filtered.map((a, i) => {
      const row: Record<string, string> = { "#": String(i + 1) };
      COLUMNS.forEach((col) => {
        row[col.label] = String(a[col.key] || "");
      });
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
    if (filtered.length === 0) {
      toast.error("Aucune donnée à enregistrer");
      return;
    }

    const name = prompt("Nom du fichier:", `export_${new Date().toISOString().slice(0, 10)}`);
    if (!name) return;

    exportExcel(name);

    const file: SavedFile = {
      id: crypto.randomUUID(),
      name: `${name}.xlsx`,
      count: filtered.length,
      createdAt: new Date().toISOString(),
      assetIds: filtered.map((asset) => asset.id),
      filters: {
        searchQuery,
        sectorFilter,
        countryFilter,
        showFavoritesOnly,
        sortKey,
        sortDir,
      },
    };

    const updated = [file, ...savedFiles];
    setSavedFiles(updated);
    persistSavedFiles(updated);
    toast.success(`Vue enregistrée: ${file.name}`);
  };

  const openSavedFile = (file: SavedFile) => {
    if (file.assetIds.length > 0) {
      setActiveSavedFileId(file.id);
      setSelectedRows(new Set());
      setPage(0);
      toast.success(`Affichage de ${file.name}`);
      return;
    }

    // Legacy fallback (anciennes versions de sauvegarde)
    setActiveSavedFileId(null);
    setSearchQuery(file.filters.searchQuery || "");
    setSectorFilter(file.filters.sectorFilter || "");
    setCountryFilter(file.filters.countryFilter || "");
    setShowFavoritesOnly(file.filters.showFavoritesOnly || false);
    setSortKey(file.filters.sortKey || "");
    setSortDir(file.filters.sortDir || "asc");
    setPage(0);
    toast.success(`Filtres restaurés depuis ${file.name}`);
  };

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedRows.size === pageAssets.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(pageAssets.map((a) => a.id)));
  };

  const deleteSavedFile = (fileId: string) => {
    const updated = savedFiles.filter((f) => f.id !== fileId);
    setSavedFiles(updated);
    persistSavedFiles(updated);
    if (activeSavedFileId === fileId) setActiveSavedFileId(null);
    toast.success("Fichier supprimé");
  };

  const renameSavedFile = (fileId: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = savedFiles.map((f) =>
      f.id === fileId ? { ...f, name: newName.trim().endsWith(".xlsx") ? newName.trim() : `${newName.trim()}.xlsx` } : f,
    );
    setSavedFiles(updated);
    persistSavedFiles(updated);
    setRenamingFileId(null);
    toast.success("Fichier renommé");
  };

  const refreshSavedFile = (fileId: string) => {
    const file = savedFiles.find((f) => f.id === fileId);
    if (!file) return;

    // Re-apply the saved filters to get fresh data
    let result = [...assets];
    const f = file.filters;
    if (f.showFavoritesOnly) result = result.filter((a) => isFavorite(a.id));
    if (f.searchQuery) {
      const q = f.searchQuery.toLowerCase();
      result = result.filter((a) =>
        a.assetName.toLowerCase().includes(q) ||
        a.isin.toLowerCase().includes(q) ||
        a.ticker.toLowerCase().includes(q) ||
        a.symbol.toLowerCase().includes(q) ||
        a.ric.toLowerCase().includes(q) ||
        normalizeCountryLabel(a.country, a.countryId, a.micCode).toLowerCase().includes(q) ||
        normalizeSectorLabel(a.sector).toLowerCase().includes(q)
      );
    }
    if (f.sectorFilter) result = result.filter((a) => normalizeSectorLabel(a.sector) === f.sectorFilter);
    if (f.countryFilter) result = result.filter((a) => normalizeCountryLabel(a.country, a.countryId, a.micCode) === f.countryFilter);

    const updatedFile: SavedFile = {
      ...file,
      assetIds: result.map((a) => a.id),
      count: result.length,
      createdAt: new Date().toISOString(),
    };

    const updatedFiles = savedFiles.map((sf) => (sf.id === fileId ? updatedFile : sf));
    setSavedFiles(updatedFiles);
    persistSavedFiles(updatedFiles);

    if (activeSavedFileId === fileId) {
      setActiveSavedFileId(null);
      setTimeout(() => setActiveSavedFileId(fileId), 0);
    }

    toast.success(`"${file.name}" mis à jour avec ${result.length} actifs`);
  };

  const getFilePreviewStats = (file: SavedFile) => {
    const matchedAssets = assets.filter((a) => file.assetIds.includes(a.id));
    const countryCounts = new Map<string, number>();
    const sectorCounts = new Map<string, number>();
    for (const a of matchedAssets) {
      const c = normalizeCountryLabel(a.country, a.countryId, a.micCode);
      const s = normalizeSectorLabel(a.sector);
      if (c && c !== "Unknown") countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
      if (s) sectorCounts.set(s, (sectorCounts.get(s) || 0) + 1);
    }
    const topCountries = Array.from(countryCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topSectors = Array.from(sectorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { topCountries, topSectors, liveCount: matchedAssets.length };
  };

  const enrichByFilters = async () => {
    if (!user?.id) {
      toast.error("Session utilisateur requise");
      return;
    }

    if (!countryFilter && !sectorFilter) {
      toast.error("Sélectionnez au moins un pays ou un secteur");
      return;
    }

    setEnrichingFilters(true);

    try {
      const pool: any[] = [];
      const seen = new Set<string>();
      const addUnique = (items: any[]) => {
        for (const item of items) {
          const key =
            item.isin ||
            item.acf ||
            item.ric ||
            `${item.ticker || ""}-${item.country_id || ""}-${item.mic_code || ""}-${item.asset_name || ""}`;
          if (!seen.has(key)) {
            seen.add(key);
            pool.push(item);
          }
        }
      };

      // Source 1: OpenFIGI (equities, bonds, etc.)
      if (countryFilter) {
        const codes = getCountryCodes(countryFilter);
        if (codes.length > 0) {
          const { data: countryData, error: countryError } = await supabase.functions.invoke("openfigi-lookup", {
            body: { exchCodes: codes },
          });
          if (!countryError && countryData?.assets) {
            addUnique(countryData.assets);
          }
        }
      }

      const searchQueryText = [sectorFilter, countryFilter].filter(Boolean).join(" ").trim();
      if (searchQueryText) {
        const { data: textData, error: textError } = await supabase.functions.invoke("openfigi-lookup", {
          body: { searchQuery: searchQueryText, limit: 300 },
        });
        if (!textError && textData?.assets) {
          addUnique(textData.assets);
        }
      }

      // Source 2: CoinGecko (crypto / digital assets)
      const sectorLower = (sectorFilter || "").toLowerCase();
      const isCryptoSector = sectorLower.includes("crypto") || sectorLower.includes("digital");
      if (isCryptoSector || (!sectorFilter && !countryFilter)) {
        try {
          const { data: cryptoData, error: cryptoError } = await supabase.functions.invoke("multi-source-lookup", {
            body: { source: "coingecko", query: countryFilter || "", limit: 100 },
          });
          if (!cryptoError && cryptoData?.assets) {
            addUnique(cryptoData.assets);
          }
        } catch (e) {
          console.warn("CoinGecko enrichment failed:", e);
        }
      }

      // Source 3: Exchange Rates API (currencies / forex)
      const isCurrencySector = sectorLower.includes("devis") || sectorLower.includes("currency") || sectorLower.includes("forex");
      if (isCurrencySector || (!sectorFilter && countryFilter)) {
        try {
          const { data: forexData, error: forexError } = await supabase.functions.invoke("multi-source-lookup", {
            body: { source: "exchangerates", country: countryFilter || "" },
          });
          if (!forexError && forexData?.assets) {
            addUnique(forexData.assets);
          }
        } catch (e) {
          console.warn("Exchange rates enrichment failed:", e);
        }
      }

      if (pool.length === 0) {
        toast.error("Aucune donnée externe trouvée pour ces filtres");
        return;
      }

      const selectedCountry = countryFilter ? normalizeCountryLabel(countryFilter) : "";
      const selectedSector = sectorFilter ? normalizeSectorLabel(sectorFilter) : "";

      const matching = pool.filter((item) => {
        const country = normalizeCountryLabel(item.country, item.country_id, item.mic_code);
        const sector = normalizeSectorLabel(item.sector);
        const okCountry = !selectedCountry || country === selectedCountry;
        const okSector = !selectedSector || sector === selectedSector;
        return okCountry && okSector;
      });

      // For crypto/forex, relax country filter since they're global
      const finalMatching = matching.length > 0 ? matching : (isCryptoSector || isCurrencySector) ? pool : [];

      if (finalMatching.length === 0) {
        toast.error("Aucun actif ne correspond exactement au pays/secteur sélectionné");
        return;
      }

      const now = Date.now();
      const rows = finalMatching.map((item, index) => ({
        asset_name: item.asset_name || item.ticker || "Unknown",
        isin:
          item.isin && String(item.isin).trim().length > 0
            ? item.isin
            : `NOISIN-${(item.ticker || item.asset_name || "ASSET").toString().replace(/\s+/g, "").toUpperCase()}-${now}-${index}`,
        sector: normalizeSectorLabel(item.sector),
        acf: item.acf || "",
        ric: item.ric || "",
        ticker: item.ticker || "",
        symbol: item.symbol || item.ticker || "",
        country_id: (item.country_id || "").toString().toUpperCase(),
        country: normalizeCountryLabel(item.country, item.country_id, item.mic_code),
        mic_code: item.mic_code || "",
        currency_id: (item.currency_id || "").toString().toUpperCase(),
        currency: item.currency || item.currency_id || "",
        description: item.description || "",
        source: item.source || "openfigi",
        user_id: user.id,
      }));

      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50);
        const { error } = await supabase
          .from("financial_assets")
          .upsert(chunk, { onConflict: "isin", ignoreDuplicates: true });

        if (error) {
          console.warn("Erreur upsert enrichissement:", error);
        }
      }

      await fetchAssets();
      clearSavedFileView();
      const sources = [...new Set(finalMatching.map(i => i.source || "openfigi"))].join(", ");
      toast.success(`${rows.length} actif(s) enrichis (sources: ${sources})`);
    } catch (error) {
      console.error("Erreur enrichissement filtres:", error);
      toast.error("Impossible d'enrichir les données pour ce filtre");
    } finally {
      setEnrichingFilters(false);
    }
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
            <div
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === "connected" ? "bg-[hsl(var(--success))] animate-pulse" : "bg-destructive"
              }`}
            />
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
              onChange={(e) => {
                clearSavedFileView();
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Rechercher..."
              className="w-full h-8 pl-9 pr-3 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-muted-foreground" />
            <select
              value={sectorFilter}
              onChange={(e) => {
                clearSavedFileView();
                setSectorFilter(e.target.value);
                setPage(0);
              }}
              className="h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Tous secteurs</option>
              <optgroup label="── En base ──">
                {sectorStats.map(([sector, count]) => (
                  <option key={`db-${sector}`} value={sector}>
                    {sector} ({count})
                  </option>
                ))}
              </optgroup>
              <optgroup label="── Tous secteurs ──">
                {SECTOR_TAXONOMY.filter(s => !sectorStats.some(([name]) => name === s)).map((sector) => (
                  <option key={`tax-${sector}`} value={sector}>
                    {sector}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Country zone dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCountryZones(!showCountryZones)}
              className="flex items-center gap-1 h-8 px-2 bg-background border border-input rounded-lg font-mono text-[10px] text-foreground hover:border-primary/30 transition-colors min-w-[120px]"
            >
              <Globe className="w-3 h-3 text-muted-foreground" />
              <span className="truncate max-w-[100px]">{countryFilter || "Tous pays"}</span>
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showCountryZones ? "rotate-180" : ""}`} />
            </button>
            {showCountryZones && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setShowCountryZones(false); setExpandedZone(null); }} />
                <div className="absolute top-full left-0 mt-1 w-64 max-h-72 overflow-y-auto z-50 rounded-lg border border-border bg-popover shadow-lg">
                  {/* Option "Tous pays" */}
                  <button
                    type="button"
                    onClick={() => {
                      clearSavedFileView();
                      setCountryFilter("");
                      setPage(0);
                      setShowCountryZones(false);
                      setExpandedZone(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border"
                  >
                    🌐 Tous les pays
                  </button>
                  {/* Pays déjà en base */}
                  {countryStats.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedZone(expandedZone === "_db" ? null : "_db")}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-foreground bg-muted/50 hover:bg-muted transition-colors sticky top-0"
                      >
                        <span>📊 En base ({assets.length} actifs)</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedZone === "_db" ? "rotate-180" : ""}`} />
                      </button>
                      {expandedZone === "_db" && (
                        <div className="py-1 max-h-40 overflow-y-auto">
                          {countryStats.map(([country, count]) => (
                            <button
                              key={country}
                              type="button"
                              onClick={() => {
                                clearSavedFileView();
                                setCountryFilter(country);
                                setPage(0);
                                setShowCountryZones(false);
                                setExpandedZone(null);
                              }}
                              className={`w-full text-left px-4 py-1 text-[10px] font-mono transition-colors ${
                                countryFilter === country
                                  ? "bg-primary/10 text-primary"
                                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
                              }`}
                            >
                              {country} <span className="text-muted-foreground">({count})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Zones géographiques */}
                  {COUNTRY_ZONES.map((zone) => (
                    <div key={zone.zone}>
                      <button
                        type="button"
                        onClick={() => setExpandedZone(expandedZone === zone.zone ? null : zone.zone)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-foreground bg-muted/50 hover:bg-muted transition-colors sticky top-0"
                      >
                        <span>{zone.emoji} {zone.zone}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedZone === zone.zone ? "rotate-180" : ""}`} />
                      </button>
                      {expandedZone === zone.zone && (
                        <div className="py-1">
                          {zone.countries.map((c, i) =>
                            c.query === "" ? (
                              <div key={i} className="px-3 py-1 text-[9px] text-muted-foreground font-mono select-none">
                                {c.label}
                              </div>
                            ) : (
                              <button
                                key={c.query}
                                type="button"
                                onClick={() => {
                                  clearSavedFileView();
                                  setCountryFilter(c.label);
                                  setPage(0);
                                  setShowCountryZones(false);
                                  setExpandedZone(null);
                                }}
                                className="w-full text-left px-4 py-1 text-[10px] font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                {c.label}
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Favorites toggle */}
          <button
            onClick={() => {
              clearSavedFileView();
              setShowFavoritesOnly(!showFavoritesOnly);
              setPage(0);
            }}
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

          {(sectorFilter || countryFilter) && filtered.length === 0 && (
            <button
              onClick={enrichByFilters}
              disabled={enrichingFilters}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-primary/10 text-primary font-mono text-[10px] border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {enrichingFilters ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} CREUSER LES DONNÉES
            </button>
          )}

          {selectedRows.size > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-destructive/10 text-destructive font-mono text-[10px] border border-destructive/20 hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> SUPPRIMER ({selectedRows.size})
            </button>
          )}

          <div className="flex-1" />

          {activeSavedFile && (
            <button
              onClick={clearSavedFileView}
              className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-accent text-accent-foreground font-mono text-[10px] border border-border hover:border-primary/30 transition-colors"
              title="Revenir aux données live"
            >
              <Wifi className="w-3 h-3" /> VUE LIVE
            </button>
          )}

          <button
            onClick={() => setShowFileManager(!showFileManager)}
            className={`flex items-center gap-1 px-2.5 h-8 rounded-lg font-mono text-[10px] border transition-colors ${
              showFileManager
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground border-border hover:border-primary/30"
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
        {showFileManager && (
            <div
              className="w-[300px] border-r border-border bg-card overflow-y-auto flex-shrink-0 animate-in slide-in-from-left-5 duration-200"
            >
              <div className="p-3">
                <h3 className="font-mono text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Gestionnaire de fichiers
                </h3>
                {savedFiles.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center py-8">Aucun fichier enregistré.</p>
                ) : (
                  <div className="space-y-2">
                    {savedFiles.map((file) => {
                      const isActive = activeSavedFileId === file.id;
                      const stats = getFilePreviewStats(file);
                      const hasFilters = file.filters.sectorFilter || file.filters.countryFilter || file.filters.searchQuery || file.filters.showFavoritesOnly;
                      const isRenaming = renamingFileId === file.id;
                      return (
                        <div
                          key={file.id}
                          className={`rounded-lg border transition-colors ${
                            isActive
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          {/* File header - clickable to open */}
                          <button
                            onClick={() => openSavedFile(file)}
                            className="w-full flex items-center gap-2 p-2 text-left"
                          >
                            <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                            <div className="flex-1 min-w-0">
                              {isRenaming ? (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") renameSavedFile(file.id, renameValue);
                                      if (e.key === "Escape") setRenamingFileId(null);
                                    }}
                                    className="w-full h-5 px-1 bg-background border border-primary rounded text-[10px] font-mono focus:outline-none"
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); renameSavedFile(file.id, renameValue); }}
                                    className="p-0.5 text-primary hover:bg-primary/10 rounded"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <p className="font-mono text-[11px] text-foreground truncate">{file.name}</p>
                                  <p className="font-mono text-[9px] text-muted-foreground">
                                    {file.count} actifs · {new Date(file.createdAt).toLocaleDateString("fr-FR")}
                                    {stats.liveCount !== file.count && (
                                      <span className="text-[hsl(var(--warning))]"> (live: {stats.liveCount})</span>
                                    )}
                                  </p>
                                </>
                              )}
                            </div>
                            <Eye className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </button>

                          {/* Detailed preview */}
                          <div className="px-2 pb-2 space-y-1">
                            {hasFilters && (
                              <div className="flex flex-wrap gap-1">
                                {file.filters.countryFilter && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-[8px]">
                                    🌍 {file.filters.countryFilter}
                                  </span>
                                )}
                                {file.filters.sectorFilter && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-[8px]">
                                    📊 {file.filters.sectorFilter}
                                  </span>
                                )}
                                {file.filters.searchQuery && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-[8px]">
                                    🔍 "{file.filters.searchQuery}"
                                  </span>
                                )}
                                {file.filters.showFavoritesOnly && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-mono text-[8px]">
                                    ⭐ Favoris
                                  </span>
                                )}
                              </div>
                            )}
                            {stats.topCountries.length > 0 && (
                              <p className="font-mono text-[8px] text-muted-foreground truncate">
                                Pays: {stats.topCountries.map(([c, n]) => `${c} (${n})`).join(", ")}
                              </p>
                            )}
                            {stats.topSectors.length > 0 && (
                              <p className="font-mono text-[8px] text-muted-foreground truncate">
                                Secteurs: {stats.topSectors.map(([s, n]) => `${s} (${n})`).join(", ")}
                              </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-1 pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshSavedFile(file.id);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[8px] hover:bg-primary/20 transition-colors"
                                title="Mettre à jour avec les données live"
                              >
                                <RefreshCw className="w-2.5 h-2.5" /> MAJ
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingFileId(file.id);
                                  setRenameValue(file.name.replace(/\.xlsx$/, ""));
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-[8px] hover:bg-accent/80 transition-colors"
                                title="Renommer"
                              >
                                ✏️ RENOMMER
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportExcel(file.name.replace(/\.xlsx$/, ""));
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-mono text-[8px] hover:bg-accent/80 transition-colors"
                                title="Re-télécharger"
                              >
                                <Download className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSavedFile(file.id);
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono text-[8px] hover:bg-destructive/20 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
        )}

        {/* Main Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center px-6">
                  <div className="text-center space-y-3 max-w-md">
                    <p className="font-mono text-xs text-foreground">Aucun résultat pour ce filtre.</p>
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez un pays/secteur existant ou lancez "CREUSER LES DONNÉES" pour enrichir automatiquement.
                    </p>
                    {(sectorFilter || countryFilter) && (
                      <button
                        onClick={enrichByFilters}
                        disabled={enrichingFilters}
                        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-primary text-primary-foreground font-mono text-[10px] hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {enrichingFilters ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        CREUSER LES DONNÉES
                      </button>
                    )}
                  </div>
                </div>
              ) : (
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
                                        onChange={(e) => {
                                          setEditValue(e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") saveEdit();
                                          if (e.key === "Escape") cancelEdit();
                                        }}
                                        onBlur={() => saveEdit()}
                                        className="w-full h-6 px-1 bg-primary/5 border border-primary rounded text-[11px] font-mono focus:outline-none"
                                        autoFocus
                                      >
                                        <option value="">— Aucun —</option>
                                        {sectorEditorOptions.map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                        {editValue && !sectorEditorOptions.includes(editValue) && (
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
                                    <button
                                      onClick={cancelEdit}
                                      className="p-0.5 text-destructive hover:bg-destructive/10 rounded"
                                    >
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
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {filtered.length} actif{filtered.length > 1 ? "s" : ""}
                    {(sectorFilter || countryFilter || searchQuery || showFavoritesOnly) && " (filtré)"}
                    {activeSavedFile && " (vue enregistrée)"}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Page {page + 1}/{totalPages || 1}
                  </p>
                  {selectedRows.size > 0 && (
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono bg-primary/5 text-primary border-primary/20"
                    >
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
                            pageNum === page
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted"
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
