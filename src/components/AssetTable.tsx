import { useState, useMemo } from "react";
import { Download, Filter, ChevronLeft, ChevronRight, Database, HardDrive, TrendingUp, Wifi } from "lucide-react";
import * as XLSX from "xlsx";
import * as fileSaver from "file-saver";
import type { FinancialAsset } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
type LivePrice = {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
};

// import { useLivePrices } from "@/hooks/useLivePrice"; // Temporairement désactivé car useQueries manquant


interface AssetTableProps {
  assets: FinancialAsset[];
  title?: string;
  showExport?: boolean;
}

const COLUMNS: { key: keyof FinancialAsset; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "assetName", label: "Asset Name" },
  { key: "isin", label: "ISIN" },
  { key: "source", label: "Source" },
  { key: "sector", label: "Sector" },
  { key: "acf", label: "ACF" },
  { key: "ric", label: "RIC" },
  { key: "ticker", label: "Ticker" },
  { key: "symbol", label: "Symbol" },
  { key: "countryId", label: "Country ID" },
  { key: "country", label: "Country" },
  { key: "micCode", label: "MIC Code" },
  { key: "currencyId", label: "Currency ID" },
  { key: "currency", label: "Currency" },
  { key: "description", label: "Description" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
];

const PAGE_SIZE = 25;

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; className: string }> = {
  database: { label: "DB", icon: Database, className: "bg-primary/10 text-primary border-primary/20" },
  local_dataset: { label: "LOCAL", icon: HardDrive, className: "bg-accent text-accent-foreground border-accent" },
  eodhd: { label: "EOD", icon: TrendingUp, className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  openfigi: { label: "FIGI", icon: Wifi, className: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  manual: { label: "MANUAL", icon: Database, className: "bg-muted text-muted-foreground border-border" },
};

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.manual;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[9px] font-mono gap-1 px-1.5 py-0.5 ${config.className}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </Badge>
  );
}

export function exportToExcel(assets: FinancialAsset[], filename = "enriched_assets") {
  const rows = assets.map((a) =>
    COLUMNS.reduce((obj, col) => {
      obj[col.label] = String(a[col.key] || "");
      return obj;
    }, {} as Record<string, string>)
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assets");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  fileSaver.saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

const AssetTable = ({ assets, title, showExport = true }: AssetTableProps) => {
  const [page, setPage] = useState(0);
  const [sectorFilter, setSectorFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof FinancialAsset | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const symbols: string[] = useMemo(() => assets.map(a => a.symbol).filter((s): s is string => Boolean(s)), [assets]);

  const priceData = useMemo(() => {
    const map = new Map<string, LivePrice | null>();
    symbols.forEach(symbol => {
      map.set(symbol, null);
    });
    return map;
  }, [symbols]);


  const handleSort = (key: keyof FinancialAsset) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const sectors = useMemo(() => {
    const s = new Set(assets.map((a) => a.sector).filter(Boolean));
    return Array.from(s).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    let result = sectorFilter ? assets.filter((a) => a.sector === sectorFilter) : [...assets];
    if (sortKey) {
      result.sort((a, b) => {
        const va = String(a[sortKey] || "").toLowerCase();
        const vb = String(b[sortKey] || "").toLowerCase();
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [assets, sectorFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageAssets = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSectorChange = (val: string) => {
    setSectorFilter(val);
    setPage(0);
  };

  if (assets.length === 0) return null;

  return (
    <div className="w-full border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5 gap-2 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {title && (
            <p className="font-mono text-xs font-semibold text-primary">{title}</p>
          )}
          {sectors.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <select
                value={sectorFilter}
                onChange={(e) => handleSectorChange(e.target.value)}
                className="h-7 px-2 bg-background border border-input rounded-md font-mono text-[10px] text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Tous secteurs ({assets.length})</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s} ({assets.filter((a) => a.sector === s).length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showExport && (
            <button
              onClick={() => exportToExcel(filtered)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-[11px] font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT XLSX ({filtered.length})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="font-mono text-[10px] px-2 py-2 whitespace-nowrap">#</TableHead>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="font-mono text-[10px] px-2 py-2 whitespace-nowrap cursor-pointer select-none hover:text-primary transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageAssets.map((asset, idx) => (
              <TableRow key={asset.id + idx} className="hover:bg-muted/50">
                <TableCell className="font-mono text-[11px] px-2 py-1.5 text-muted-foreground">
                  {page * PAGE_SIZE + idx + 1}
                </TableCell>
                {COLUMNS.map((col) => {
                  if (col.key === "symbol" && asset.symbol) {
                    const price = priceData.get(asset.symbol);
                    return (
                      <TableCell
                        key={col.key}
                        className="font-mono text-[11px] px-2 py-1.5 whitespace-nowrap"
                        title={String(asset[col.key] || "")}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold">{asset.symbol}</span>
                          {price && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 ml-auto">
                              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                              {price.price.toFixed(2)} {asset.currency || ''}
                              <span className={`ml-1 text-[9px] ${price.change >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                {price.changePercent.toFixed(1)}%
                              </span>
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell
                      key={col.key}
                      className={`font-mono text-[11px] px-2 py-1.5 whitespace-nowrap ${
                        col.key === "description" ? "max-w-[200px] truncate" : ""
                      }`}
                      title={String(asset[col.key] || "")}
                    >
                      {col.key === "source" ? (
                        (() => {
                          const baseSource = String(asset[col.key] || "manual");
                          const hasPrice = asset.symbol && priceData.has(asset.symbol);
                          const fullSource = hasPrice ? `${baseSource.toUpperCase()}+LIVE` : baseSource;
                          return <SourceBadge source={fullSource.toLowerCase()} />;
                        })()
                      ) : (
                        asset[col.key] || "—"
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 gap-2 flex-wrap">
        <p className="font-mono text-[10px] text-muted-foreground">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          {sectorFilter && ` (filtré)`}
          {totalPages > 1 && ` — Page ${page + 1}/${totalPages}`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-md font-mono text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Préc
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-6 h-6 rounded-md font-mono text-[10px] transition-colors ${
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
              Suiv <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetTable;
