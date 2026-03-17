import { useState } from "react";
import { Globe, Loader2, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dbToFinancialAsset, type DbAsset } from "@/lib/asset-service";
import { getCountryCodes } from "@/lib/country-codes";
import { exportToExcel } from "@/components/AssetTable";
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

  // Search local DB for country assets
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

  // Import from OpenFIGI by exchange code
  const handleBatchImport = async () => {
    const q = country.trim();
    if (!q) return;

    const codes = getCountryCodes(q);
    if (codes.length === 0) {
      toast.error("Pays non reconnu. Essayez un code comme US, FR, MP...");
      return;
    }

    setImporting(true);
    let totalImported = 0;
    const allAssets: FinancialAsset[] = [];

    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    for (const exchCode of codes) {
      setImportProgress(`Recherche OpenFIGI: ${exchCode}...`);

      try {
        const { data, error } = await supabase.functions.invoke("openfigi-lookup", {
          body: { exchCode, start: 0 },
        });

        if (error || !data?.assets) {
          console.warn(`No results for exchange ${exchCode}:`, error);
          continue;
        }

        const assets = data.assets;
        setImportProgress(`${exchCode}: ${assets.length} actifs trouvés, sauvegarde...`);

        // Batch upsert in chunks of 50
        for (let i = 0; i < assets.length; i += 50) {
          const chunk = assets.slice(i, i + 50).map((a: any) => ({
            ...a,
            user_id: userId,
          }));

          const { error: upsertErr } = await supabase
            .from("financial_assets")
            .upsert(chunk, { onConflict: "isin", ignoreDuplicates: true });

          if (upsertErr) {
            console.warn("Upsert error:", upsertErr);
          }

          totalImported += chunk.length;
          setImportProgress(`${exchCode}: ${Math.min(i + 50, assets.length)}/${assets.length} sauvegardés`);
        }

        // Load back from DB for proper display
        if (data.hasMore) {
          toast.info(`${exchCode}: il y a plus de résultats. Relancez pour la suite.`);
        }
      } catch (err) {
        console.error(`Error importing ${exchCode}:`, err);
      }
    }

    setImportProgress("Chargement des résultats...");

    // Now reload from DB
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
      toast.success(`${mapped.length} actifs importés pour "${q}"`);
    } else {
      toast.error(`Aucun actif trouvé pour "${q}" sur OpenFIGI`);
    }

    setImporting(false);
    setImportProgress("");
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
          placeholder="Pays (ex: France, US, Mauritius...)"
          className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-lg font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
        />
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
        title="Importer toutes les entreprises du pays depuis OpenFIGI"
      >
        {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        IMPORT
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
