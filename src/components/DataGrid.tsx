import { motion } from "framer-motion";
import type { FinancialAsset } from "@/lib/mock-data";
import DataPoint from "./DataPoint";

interface DataGridProps {
  data: FinancialAsset;
}

const DataGrid = ({ data }: DataGridProps) => {
  const identifiers = [
    { label: "ISIN", value: data.isin },
    { label: "RIC", value: data.ric },
    { label: "TICKER", value: data.ticker },
    { label: "SYMBOL", value: data.symbol },
    { label: "ACF", value: data.acf },
    { label: "ID", value: data.id },
  ];

  const classification = [
    { label: "ASSET NAME", value: data.assetName },
    { label: "SECTOR", value: data.sector },
    { label: "DESCRIPTION", value: data.description },
  ];

  const geography = [
    { label: "COUNTRY", value: data.country },
    { label: "COUNTRY ID", value: data.countryId },
    { label: "MIC CODE", value: data.micCode },
    { label: "CURRENCY", value: data.currency },
    { label: "CURRENCY ID", value: data.currencyId },
  ];

  const metadata = [
    { label: "CREATED AT", value: new Date(data.createdAt).toLocaleDateString("fr-FR") },
    { label: "UPDATED AT", value: new Date(data.updatedAt).toLocaleDateString("fr-FR") },
  ];

  const sections = [
    { title: "IDENTIFIERS", items: identifiers },
    { title: "CLASSIFICATION", items: classification },
    { title: "GEOGRAPHY", items: geography },
    { title: "METADATA", items: metadata },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="w-full border border-border rounded-xl overflow-hidden bg-card shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div>
          <p className="label-xs text-primary">DATA_RETRIEVED_OK</p>
          <h2 className="text-foreground font-mono text-lg font-semibold mt-0.5">
            {data.assetName}
          </h2>
        </div>
        <span className="font-mono text-primary text-sm font-semibold px-3 py-1 rounded-lg bg-primary/10">
          {data.ticker}
        </span>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.title}>
          <div className="px-4 py-2 bg-muted/30 border-b border-border/50">
            <p className="label-xs text-secondary-foreground">{section.title}</p>
          </div>
          <div className="grid grid-cols-2">
            {section.items.map((item) => (
              <div
                key={item.label}
                className={item.label === "DESCRIPTION" || item.label === "ASSET NAME" ? "col-span-2" : ""}
              >
                <DataPoint label={item.label} value={item.value} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
};

export default DataGrid;
