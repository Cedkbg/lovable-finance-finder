import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { bulkEnrich } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";
import { exportToExcel } from "@/components/AssetTable";

interface BulkResult {
  identifier: string;
  asset: FinancialAsset | null;
  source: string;
}

interface BulkImportProps {
  onSelectResult?: (asset: FinancialAsset) => void;
}

const BulkImport = ({ onSelectResult }: BulkImportProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BulkResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = async (file: File): Promise<string[]> => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv" || ext === "txt") {
      return new Promise((resolve) => {
        Papa.parse(file, {
          complete: (result: Papa.ParseResult) => {
            const ids = result.data
              .flat()
              .map((v: unknown) => String(v).trim())
              .filter((v) => v.length > 0 && v !== "ISIN" && v !== "Ticker" && v !== "ticker" && v !== "isin");
            resolve(ids);
          },
        });
      });
    }

    if (ext === "xlsx" || ext === "xls") {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const ids = rows
        .flat()
        .map((v: any) => String(v).trim())
        .filter((v) => v.length > 0 && v !== "ISIN" && v !== "Ticker" && v !== "ticker" && v !== "isin");
      return ids;
    }

    return [];
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResults([]);
    setProgress({ done: 0, total: 0 });

    const identifiers = await parseFile(file);
    if (identifiers.length === 0) {
      setLoading(false);
      return;
    }

    setProgress({ done: 0, total: identifiers.length });

    const { results: enriched } = await bulkEnrich(identifiers, (done, total) => {
      setProgress({ done, total });
    });

    setResults(enriched);
    setLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const found = results.filter((r) => r.asset);
  const notFound = results.filter((r) => !r.asset);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground font-mono text-xs border border-border hover:border-primary/30 transition-colors"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        BULK_IMPORT
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden"
          >
            <div className="p-4 border border-border rounded-lg bg-card">
              <div className="flex items-center justify-between mb-3">
                <p className="label-xs text-primary">IMPORT_CSV_XLSX</p>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  {loading ? "PROCESSING..." : "DROP_FILE_OR_CLICK"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  CSV, TXT, XLSX, XLS
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFile}
                  className="hidden"
                  disabled={loading}
                />
              </label>

              {loading && (
                <div className="mt-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-mono text-xs text-muted-foreground">
                    ENRICHING {progress.done}/{progress.total}
                  </span>
                  <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {results.length > 0 && !loading && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 font-mono text-xs">
                      <span className="text-[hsl(var(--success))]">
                        <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                        {found.length} FOUND
                      </span>
                      <span className="text-destructive">
                        <XCircle className="w-3.5 h-3.5 inline mr-1" />
                        {notFound.length} NOT_FOUND
                      </span>
                    </div>
                    {found.length > 0 && (
                      <button
                        onClick={() => exportToExcel(found.map((r) => r.asset!),"bulk_enriched")}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-mono text-[10px] font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        EXPORT XLSX
                      </button>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {results.map((r, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between px-3 py-1.5 rounded text-xs font-mono ${
                          r.asset
                            ? "bg-secondary/30 cursor-pointer hover:bg-secondary/50"
                            : "bg-destructive/10"
                        }`}
                        onClick={() => r.asset && onSelectResult?.(r.asset)}
                      >
                        <span className="text-foreground">{r.identifier}</span>
                        <span className={r.asset ? "text-[hsl(var(--success))]" : "text-destructive"}>
                          {r.asset ? r.asset.assetName : "NOT_FOUND"}
                        </span>
                        <span className="text-muted-foreground text-[10px]">{r.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkImport;
