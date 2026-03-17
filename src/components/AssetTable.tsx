import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { FinancialAsset } from "@/lib/mock-data";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface AssetTableProps {
  assets: FinancialAsset[];
  title?: string;
  showExport?: boolean;
}

const COLUMNS: { key: keyof FinancialAsset; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "assetName", label: "Asset Name" },
  { key: "isin", label: "ISIN" },
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

export function exportToExcel(assets: FinancialAsset[], filename = "enriched_assets") {
  const rows = assets.map((a) =>
    COLUMNS.reduce((obj, col) => {
      obj[col.label] = a[col.key] || "";
      return obj;
    }, {} as Record<string, string>)
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assets");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

const AssetTable = ({ assets, title, showExport = true }: AssetTableProps) => {
  if (assets.length === 0) return null;

  return (
    <div className="w-full border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {(title || showExport) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
          {title && (
            <p className="font-mono text-xs font-semibold text-primary">{title}</p>
          )}
          {showExport && (
            <button
              onClick={() => exportToExcel(assets)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-mono text-[11px] font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT XLSX
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow>
              <TableHead className="font-mono text-[10px] px-2 py-2 whitespace-nowrap">#</TableHead>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className="font-mono text-[10px] px-2 py-2 whitespace-nowrap">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.map((asset, idx) => (
              <TableRow key={asset.id + idx} className="hover:bg-muted/50">
                <TableCell className="font-mono text-[11px] px-2 py-1.5 text-muted-foreground">
                  {idx + 1}
                </TableCell>
                {COLUMNS.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`font-mono text-[11px] px-2 py-1.5 whitespace-nowrap ${
                      col.key === "description" ? "max-w-[200px] truncate" : ""
                    }`}
                    title={String(asset[col.key] || "")}
                  >
                    {asset[col.key] || "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="font-mono text-[10px] text-muted-foreground">
          {assets.length} résultat{assets.length > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
};

export default AssetTable;
