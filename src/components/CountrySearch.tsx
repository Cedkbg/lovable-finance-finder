import { useState } from "react";
import { Globe, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import { getCountryCodes } from "@/lib/country-codes";
import { COUNTRY_ZONES } from "@/lib/country-zones";
import type { FinancialAsset } from "@/lib/mock-data";
import { toast } from "sonner";

interface CountrySearchProps {
  onResults: (assets: FinancialAsset[], country: string) => void;
}

const CountrySearch = ({ onResults }: CountrySearchProps) => {
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [showZones, setShowZones] = useState(false);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);

  const selectCountry = (query: string, label: string) => {
    if (!query) return; // separator
    setCountry(query);
    setShowZones(false);
    setExpandedZone(null);
  };

  const handleSearch = async () => {
    const q = country.trim();
    if (!q) return;

    setLoading(true);
    const codes = getCountryCodes(q);
    const filters: string[] = [
      `country.ilike.%${q}%`,
      `country_id.ilike.%${q}%`,
      `description.ilike.%${q}%`,
    ];
    for (const code of codes) {
      filters.push(`country.eq.${code}`);
      filters.push(`country_id.eq.${code}`);
      filters.push(`mic_code.eq.${code}`);
    }

    const { data, error } = await supabase
      .from("financial_assets")
      .select("*")
      .or(filters.join(","))
      .order("asset_name");

    if (!error && data) {
      onResults(data.map((d) => dbToFinancialAsset(d as DbAsset)), q);
    }
    setLoading(false);
  };

  const handleBatchImport = async () => {
    const q = country.trim();
    if (!q) return;

    const codes = getCountryCodes(q);
    if (codes.length === 0) {
      toast.error("Pays non reconnu. Essayez un code comme US, FR, MP...");
      return;
    }

    setImporting(true);
    setImportProgress(`Recherche OpenFIGI: ${codes.join(", ")}...`);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    try {
      const { data, error } = await supabase.functions.invoke("openfigi-lookup", {
        body: { exchCodes: codes },
      });

      if (error || !data?.assets) {
        toast.error(`Aucun actif trouvé pour "${q}" sur OpenFIGI`);
        setImporting(false);
        setImportProgress("");
        return;
      }

      const assets = data.assets;
      setImportProgress(`${assets.length} actifs trouvés, sauvegarde en cours...`);

      let saved = 0;
      for (let i = 0; i < assets.length; i += 50) {
        const chunk = assets.slice(i, i + 50).map((a: any) => ({
          ...a,
          isin: a.isin || `NOISN-${a.ticker || a.asset_name}-${a.country_id || "XX"}-${i + Math.random().toString(36).slice(2, 6)}`,
          user_id: userId,
        }));

        const { error: upsertErr } = await supabase
          .from("financial_assets")
          .upsert(chunk, { onConflict: "isin", ignoreDuplicates: true });

        if (upsertErr) console.warn("Upsert error:", upsertErr);
        saved += chunk.length;
        setImportProgress(`${saved}/${assets.length} sauvegardés...`);
      }

      setImportProgress("Chargement des résultats...");
      const filters: string[] = [];
      for (const code of codes) {
        filters.push(`country.eq.${code}`);
        filters.push(`country_id.eq.${code}`);
        filters.push(`mic_code.eq.${code}`);
      }

      const { data: dbData } = await supabase
        .from("financial_assets")
        .select("*")
        .or(filters.join(","))
        .order("asset_name");

      if (dbData && dbData.length > 0) {
        const mapped = dbData.map((d) => dbToFinancialAsset(d as DbAsset));
        onResults(mapped, q);
        toast.success(`${mapped.length} actifs importés pour "${q}" (${codes.length} bourses)`);
      } else {
        toast.error(`Aucun actif trouvé pour "${q}"`);
      }

      if (data.hasMore) {
        toast.info("Il y a plus de résultats disponibles. Ajoutez une clé API OpenFIGI pour tout récupérer.");
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("Erreur lors de l'import");
    }

    setImporting(false);
    setImportProgress("");
  };

  return (
    <div className="flex items-center gap-2 relative">
      <div className="relative flex-1">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          onFocus={() => setShowZones(true)}
          placeholder="Pays, zone ou groupe (ex: France, Afrique Émergente...)"
          className="w-full h-9 pl-9 pr-8 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowZones(!showZones)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showZones ? "rotate-180" : ""}`} />
        </button>

        {showZones && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setShowZones(false); setExpandedZone(null); }} />
            <div className="absolute top-full left-0 mt-1 w-full max-h-80 overflow-y-auto z-50 rounded-lg border border-border bg-popover shadow-lg">
              {COUNTRY_ZONES.map((zone) => (
                <div key={zone.zone}>
                  <button
                    type="button"
                    onClick={() => setExpandedZone(expandedZone === zone.zone ? null : zone.zone)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-foreground bg-muted/50 hover:bg-muted transition-colors sticky top-0"
                  >
                    <span>{zone.emoji} {zone.zone}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedZone === zone.zone ? "rotate-180" : ""}`} />
                  </button>
                  {expandedZone === zone.zone && (
                    <div className="py-1">
                      {zone.countries.map((c, i) =>
                        c.query === "" ? (
                          <div key={i} className="px-3 py-1 text-[10px] text-muted-foreground font-mono select-none">
                            {c.label}
                          </div>
                        ) : (
                          <button
                            key={c.query}
                            type="button"
                            onClick={() => selectCountry(c.query, c.label)}
                            className="w-full text-left px-4 py-1.5 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors font-mono"
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
      <button
        onClick={handleSearch}
        disabled={loading || importing || !country.trim()}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-secondary text-secondary-foreground font-mono text-xs border border-border hover:border-primary/30 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
        LOCAL
      </button>
      <button
        onClick={handleBatchImport}
        disabled={importing || loading || !country.trim()}
        className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground font-mono text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
        title="Importer TOUTES les entreprises du pays depuis OpenFIGI (toutes les bourses)"
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        IMPORT ALL
      </button>
      {importing && importProgress && (
        <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
          {importProgress}
        </span>
      )}
    </div>
  );
};

export default CountrySearch;
