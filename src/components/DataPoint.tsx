import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface DataPointProps {
  label: string;
  value: string;
}

const DataPoint = ({ label, value }: DataPointProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value || value === "—") return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast(`${label} copié`, { duration: 1500 });
    setTimeout(() => setCopied(false), 1500);
  }, [value, label]);

  return (
    <div
      className="data-cell group relative"
      onClick={handleCopy}
      title="Cliquer pour copier"
    >
      <div className="flex items-center justify-between">
        <p className="label-xs">{label}</p>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? (
            <Check className="w-3 h-3 text-[hsl(var(--success))]" />
          ) : (
            <Copy className="w-3 h-3 text-muted-foreground" />
          )}
        </span>
      </div>
      <p className={`value-sm mt-0.5 truncate transition-colors duration-150 ${copied ? "text-primary" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
};

export default DataPoint;
