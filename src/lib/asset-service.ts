import { supabase } from "@/integrations/supabase/client";
import type { FinancialAsset } from "./mock-data";
import { searchViaEODHD as eodhdSearch } from "@/services/eodhd";


export interface DbAsset {
  id: string;
  asset_name: string;
  isin: string;
  sector: string | null;
  acf: string | null;
  ric: string | null;
  ticker: string | null;
  symbol: string | null;
  country_id: string | null;
  country: string | null;
  mic_code: string | null;
  currency_id: string | null;
  currency: string | null;
  description: string | null;
  source: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function dbToFinancialAsset(db: DbAsset): FinancialAsset {
  return {
    id: db.id,
    assetName: db.asset_name,
    isin: db.isin,
    sector: db.sector || "",
    acf: db.acf || "",
    ric: db.ric || "",
    ticker: db.ticker || "",
    symbol: db.symbol || "",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    countryId: db.country_id || "",
    country: db.country || "",
    micCode: db.mic_code || "",
    currencyId: db.currency_id || "",
    currency: db.currency || "",
    description: db.description || "",
    source: db.source || "",
  };

}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

async function searchInDb(query: string): Promise<FinancialAsset | null> {
  const q = query.trim().toUpperCase();
  
  const { data, error: _error } = await supabase
    .from("financial_assets")
    .select("*")
    .or(`isin.eq.${q},ticker.eq.${q},symbol.eq.${q},ric.ilike.%${q}%`)
    .limit(1)
    .single();

  if (_error || !data) return null;
  return dbToFinancialAsset(data as DbAsset);
}

async function searchViaEODHD(query: string): Promise<FinancialAsset | null> {
  const result = await eodhdSearch(query);
  if (!result) return null;

  await saveToUserDb(result);
  return result;
}

async function searchViaOpenFigi(query: string): Promise<FinancialAsset | null> {
  try {
    const { data, error: _error } = await supabase.functions.invoke("openfigi-lookup", {
      body: { identifiers: [query.trim().toUpperCase()] },
    });

    if (_error || !data?.results?.[0]?.found) return null;

    const asset = data.results[0].asset;
    const userId = await getCurrentUserId();
 
    if (!asset.isin) {
      asset.isin = `NOISIN-${asset.ticker || query.trim().toUpperCase()}-${asset.country_id || 'XX'}`;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("financial_assets")
      .upsert({ ...asset, user_id: userId }, { onConflict: "isin" })
      .select()
      .single();

    if (insertErr) {
      return dbToFinancialAsset({
        ...asset,
        id: crypto.randomUUID(),
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DbAsset);
    }

    return dbToFinancialAsset(inserted as DbAsset);
  } catch (err) {
    return null;
  }
}

async function saveToUserDb(asset: FinancialAsset): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  const { error: _ } = await supabase.from("financial_assets").upsert(
    {
      asset_name: asset.assetName,
      isin: asset.isin,
      sector: asset.sector,
      acf: asset.acf,
      ric: asset.ric,
      ticker: asset.ticker,
      symbol: asset.symbol,
      country_id: asset.countryId,
      country: asset.country,
      mic_code: asset.micCode,
      currency_id: asset.currencyId,
      currency: asset.currency,
      description: asset.description,
      source: asset.source || "eodhd",
      user_id: userId,
    },
    { onConflict: "isin", ignoreDuplicates: true }
  );
}

export async function searchAsset(query: string): Promise<{ asset: FinancialAsset | null; source: string }> {
  const dbResult = await searchInDb(query);
  if (dbResult) return { asset: dbResult, source: "database" };

  const eodhdResult = await searchViaEODHD(query);
  if (eodhdResult) return { asset: eodhdResult, source: "eodhd" };

  const figiResult = await searchViaOpenFigi(query);
  if (figiResult) return { asset: figiResult, source: "openfigi" };

  return { asset: null, source: "not_found" };
}


export async function bulkEnrich(
  identifiers: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ results: Array<{ identifier: string; asset: FinancialAsset | null; source: string }> }> {
  const results: Array<{ identifier: string; asset: FinancialAsset | null; source: string }> = [];
  
  for (let i = 0; i < identifiers.length; i++) {
    const id = identifiers[i].trim();
    if (!id) continue;
    
    const { asset, source } = await searchAsset(id);
    results.push({ identifier: id, asset, source });
    onProgress?.(i + 1, identifiers.length);
  }

  return { results };
}

