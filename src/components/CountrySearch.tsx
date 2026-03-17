import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import type { FinancialAsset } from "@/lib/mock-data";

interface CountrySearchProps {
  onResults: (assets: FinancialAsset[], country: string) => void;
}

const CountrySearch = ({ onResults }: CountrySearchProps) => {
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const q = country.trim();
    if (!q) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("financial_assets")
      .select("*")
      .or(`country.ilike.%${q}%,country_id.ilike.%${q}%`)
      .order("asset_name");

    if (!error && data) {
      onResults(data.map((d) => dbToFinancialAsset(d as DbAsset)), q);
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Pays (ex: France, US, CH...)"
          className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
      </div>
      <button
        onClick={handleSearch}
        disabled={loading || !country.trim()}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-secondary text-secondary-foreground font-mono text-xs border border-border hover:border-primary/30 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        SEARCH
      </button>
    </div>
  );
};

export default CountrySearch;
