import { supabase } from "@/integrations/supabase/client";
import { MOCK_DATA, type FinancialAsset } from "./mock-data";

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
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

// CAS 1: Search in database
async function searchInDb(query: string): Promise<FinancialAsset | null> {
  const q = query.trim().toUpperCase();
  
  const { data, error } = await supabase
    .from("financial_assets")
    .select("*")
    .or(`isin.eq.${q},ticker.eq.${q},symbol.eq.${q},ric.ilike.%${q}%`)
    .limit(1)
    .single();

  if (error || !data) return null;
  return dbToFinancialAsset(data as DbAsset);
}

// CAS 2a: Search in mock data fallback
function searchInMockData(query: string): FinancialAsset | null {
  const q = query.trim().toUpperCase();
  return (
    MOCK_DATA.find(
      (a) =>
        a.isin.toUpperCase() === q ||
        a.ticker.toUpperCase() === q ||
        a.symbol.toUpperCase() === q ||
        a.ric.toUpperCase().includes(q)
    ) || null
  );
}

// CAS 2b: Search via OpenFIGI API
async function searchViaOpenFigi(query: string): Promise<FinancialAsset | null> {
  try {
    const { data, error } = await supabase.functions.invoke("openfigi-lookup", {
      body: { identifiers: [query.trim().toUpperCase()] },
    });

    if (error || !data?.results?.[0]?.found) return null;

    const asset = data.results[0].asset;
    const userId = await getCurrentUserId();

    // If no ISIN returned, generate a placeholder to allow DB storage
    if (!asset.isin) {
      asset.isin = `NOISIN-${asset.ticker || query.trim().toUpperCase()}-${asset.country_id || 'XX'}`;
    }

    // Save to DB for future lookups
    const { data: inserted, error: insertErr } = await supabase
      .from("financial_assets")
      .upsert({ ...asset, user_id: userId }, { onConflict: "isin" })
      .select()
      .single();

    if (insertErr) {
      console.warn("Failed to persist OpenFIGI result:", insertErr);
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
    console.error("OpenFIGI lookup failed:", err);
    return null;
  }
}

// Save a found mock asset to user's collection
async function saveToUserDb(asset: FinancialAsset): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  await supabase.from("financial_assets").upsert(
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
      source: "local_dataset",
      user_id: userId,
    },
    { onConflict: "isin", ignoreDuplicates: true }
  );
}

// Main search: DB → Mock → OpenFIGI
export async function searchAsset(query: string): Promise<{ asset: FinancialAsset | null; source: string }> {
  // 1. Database
  const dbResult = await searchInDb(query);
  if (dbResult) return { asset: dbResult, source: "database" };

  // 2. Mock data fallback
  const mockResult = searchInMockData(query);
  if (mockResult) {
    // Try to persist (may fail if ISIN conflict with public data - that's OK)
    await saveToUserDb(mockResult);
    return { asset: mockResult, source: "local_dataset" };
  }

  // 3. OpenFIGI API
  const figiResult = await searchViaOpenFigi(query);
  if (figiResult) return { asset: figiResult, source: "openfigi" };

  return { asset: null, source: "not_found" };
}

// Bulk enrich: array of identifiers
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
