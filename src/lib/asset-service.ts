import { supabase } from "@/integrations/supabase/client";
import { normalizeCountryLabel, normalizeSectorLabel } from "@/lib/asset-labels";
import type { FinancialAsset } from "./mock-data";

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
    sector: normalizeSectorLabel(db.sector),
    acf: db.acf || "",
    ric: db.ric || "",
    ticker: db.ticker || "",
    symbol: db.symbol || "",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    countryId: (db.country_id || "").toUpperCase(),
    country: normalizeCountryLabel(db.country, db.country_id, db.mic_code),
    micCode: db.mic_code || "",
    currencyId: (db.currency_id || "").toUpperCase(),
    currency: db.currency || "",
    description: db.description || "",
    source: db.source || "",
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

// Search in database — return ALL matching results
async function searchInDb(query: string): Promise<FinancialAsset[]> {
  const q = query.trim().toUpperCase();

  const { data, error } = await supabase
    .from("financial_assets")
    .select("*")
    .or(`isin.eq.${q},ticker.eq.${q},symbol.eq.${q},ric.ilike.%${q}%,asset_name.ilike.%${q}%`)
    .limit(50);

  if (error || !data || data.length === 0) return [];

  return (data as DbAsset[]).map(dbToFinancialAsset);
}

// Search via EODHD API — return ALL results
async function searchViaEodhd(query: string): Promise<FinancialAsset[]> {
  try {
    const { data, error } = await supabase.functions.invoke("eodhd-lookup", {
      body: { mode: "search", query: query.trim(), limit: 50 },
    });

    if (error || !data?.assets?.length) return [];

    const userId = await getCurrentUserId();
    const results: FinancialAsset[] = [];

    for (const item of data.assets) {
      // Generate ISIN placeholder if missing
      if (!item.isin) {
        item.isin = `NOISIN-${item.ticker || query.trim().toUpperCase()}-${item.country_id || "XX"}-${item.mic_code || "XX"}`;
      }

      // Save to DB
      const { data: inserted, error: insertErr } = await supabase
        .from("financial_assets")
        .upsert({ ...item, user_id: userId }, { onConflict: "isin" })
        .select()
        .single();

      if (insertErr) {
        results.push(dbToFinancialAsset({
          ...item,
          id: crypto.randomUUID(),
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as DbAsset));
      } else {
        results.push(dbToFinancialAsset(inserted as DbAsset));
      }
    }

    return results;
  } catch (err) {
    console.error("EODHD lookup failed:", err);
    return [];
  }
}

// Main search: EODHD (live) → CoinGecko — always real-time, never local-only
export async function searchAsset(query: string): Promise<{ assets: FinancialAsset[]; source: string }> {
  // 1. EODHD API (always live / real-time first)
  const eodhdResults = await searchViaEodhd(query);
  if (eodhdResults.length > 0) return { assets: eodhdResults, source: "eodhd" };

  // 2. Fallback: database (only if EODHD is unavailable)
  const dbResults = await searchInDb(query);
  if (dbResults.length > 0) return { assets: dbResults, source: "database (fallback)" };

  // 3. CoinGecko for crypto
  try {
    const { data, error } = await supabase.functions.invoke("multi-source-lookup", {
      body: { source: "coingecko", query: query.trim(), limit: 10 },
    });
    if (!error && data?.assets?.length) {
      const userId = await getCurrentUserId();
      const results: FinancialAsset[] = [];
      for (const asset of data.assets) {
        if (!asset.isin) asset.isin = `CRYPTO-${asset.ticker || query.trim().toUpperCase()}-${asset.symbol || "XX"}`;
        const { data: inserted } = await supabase
          .from("financial_assets")
          .upsert({ ...asset, user_id: userId }, { onConflict: "isin" })
          .select()
          .single();
        if (inserted) results.push(dbToFinancialAsset(inserted as DbAsset));
      }
      if (results.length > 0) return { assets: results, source: "coingecko" };
    }
  } catch {}

  return { assets: [], source: "not_found" };
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

    const { assets, source } = await searchAsset(id);
    results.push({ identifier: id, asset: assets[0] || null, source });
    onProgress?.(i + 1, identifiers.length);
  }

  return { results };
}
