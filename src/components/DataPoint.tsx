import { useState, useCallback } from "react";
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
    toast(`${label} copié`, {
      duration: 1500,
      style: {
        background: "hsl(240, 10%, 6%)",
        border: "1px solid hsl(240, 5%, 15%)",
        color: "hsl(240, 5%, 84%)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12px",
      },
    });
    setTimeout(() => setCopied(false), 1500);
  }, [value, label]);

  return (
    <div
      className="data-cell"
      onClick={handleCopy}
      title="Cliquer pour copier"
    >
      <p className="label-xs">{label}</p>
      <p className={`value-sm mt-0.5 truncate transition-colors duration-150 ${copied ? "text-primary" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
};

export default DataPoint;
