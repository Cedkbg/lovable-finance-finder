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

// Search in database first
async function searchInDb(query: string): Promise<FinancialAsset | null> {
  const q = query.trim().toUpperCase();

  const { data, error } = await supabase
    .from("financial_assets")
    .select("*")
    .or(`isin.eq.${q},ticker.eq.${q},symbol.eq.${q},ric.ilike.%${q}%`)
    .limit(1)
    .single();

  if (error || !data) return null;

  // Check freshness: if older than 24h, mark for refresh
  const asset = dbToFinancialAsset(data as DbAsset);
  const age = Date.now() - new Date(asset.updatedAt).getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (age > ONE_DAY) {
    // Trigger background refresh via EODHD
    refreshFromEodhd(asset.ticker, asset.micCode, data as DbAsset).catch(() => {});
  }

  return asset;
}

// Background refresh from EODHD
async function refreshFromEodhd(ticker: string, exchange: string, existing: DbAsset): Promise<void> {
  if (!ticker) return;
  try {
    const { data, error } = await supabase.functions.invoke("eodhd-lookup", {
      body: { mode: "fundamentals", ticker, exchange: exchange || "US" },
    });
    if (error || !data?.asset) return;

    const updates: Record<string, any> = {};
    const a = data.asset;
    if (a.sector && a.sector !== existing.sector) updates.sector = a.sector;
    if (a.description && a.description !== existing.description) updates.description = a.description;
    if (a.country && a.country !== existing.country) updates.country = a.country;
    if (a.currency && a.currency !== existing.currency) updates.currency = a.currency;

    if (Object.keys(updates).length > 0) {
      await supabase.from("financial_assets").update(updates).eq("id", existing.id);
    }
  } catch {
    // Silent fail for background refresh
  }
}

// Search via EODHD API (replaces OpenFIGI)
async function searchViaEodhd(query: string): Promise<FinancialAsset | null> {
  try {
    // Try search mode first
    const { data, error } = await supabase.functions.invoke("eodhd-lookup", {
      body: { mode: "search", query: query.trim(), limit: 5 },
    });

    if (error || !data?.assets?.length) return null;

    const best = data.assets[0];
    const userId = await getCurrentUserId();

    // Generate ISIN placeholder if missing
    if (!best.isin) {
      best.isin = `NOISIN-${best.ticker || query.trim().toUpperCase()}-${best.country_id || "XX"}`;
    }

    // Save to DB
    const { data: inserted, error: insertErr } = await supabase
      .from("financial_assets")
      .upsert({ ...best, user_id: userId }, { onConflict: "isin" })
      .select()
      .single();

    if (insertErr) {
      console.warn("Failed to persist EODHD result:", insertErr);
      return dbToFinancialAsset({
        ...best,
        id: crypto.randomUUID(),
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DbAsset);
    }

    return dbToFinancialAsset(inserted as DbAsset);
  } catch (err) {
    console.error("EODHD lookup failed:", err);
    return null;
  }
}

// Main search: DB → EODHD → CoinGecko (crypto) → Exchange Rates (forex)
export async function searchAsset(query: string): Promise<{ asset: FinancialAsset | null; source: string }> {
  // 1. Database
  const dbResult = await searchInDb(query);
  if (dbResult) return { asset: dbResult, source: "database" };

  // 2. EODHD API (real-time)
  const eodhdResult = await searchViaEodhd(query);
  if (eodhdResult) return { asset: eodhdResult, source: "eodhd" };

  // 3. CoinGecko for crypto
  try {
    const { data, error } = await supabase.functions.invoke("multi-source-lookup", {
      body: { source: "coingecko", query: query.trim(), limit: 1 },
    });
    if (!error && data?.assets?.length) {
      const asset = data.assets[0];
      const userId = await getCurrentUserId();
      if (!asset.isin) asset.isin = `CRYPTO-${asset.ticker || query.trim().toUpperCase()}`;
      const { data: inserted } = await supabase
        .from("financial_assets")
        .upsert({ ...asset, user_id: userId }, { onConflict: "isin" })
        .select()
        .single();
      if (inserted) return { asset: dbToFinancialAsset(inserted as DbAsset), source: "coingecko" };
    }
  } catch {}

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
