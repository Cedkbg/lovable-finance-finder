import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Mode 1: Search by exchange code (country batch import)
    if (body.exchCode) {
      return await handleExchangeSearch(body.exchCode, body.start || 0);
    }

    // Mode 2: Search ALL exchanges for a country (multi-exchange)
    if (body.exchCodes && Array.isArray(body.exchCodes)) {
      return await handleMultiExchangeSearch(body.exchCodes);
    }

    // Mode 3: Text search (sector/country deep lookup)
    if (body.searchQuery && typeof body.searchQuery === "string") {
      return await handleTextSearch(body.searchQuery, body.limit);
    }

    // Mode 4: Standard identifier mapping (multi-strategy)
    const { identifiers } = body;
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return new Response(
        JSON.stringify({ error: "identifiers array, exchCode, exchCodes, or searchQuery required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const results = [];
    for (const identifier of identifiers) {
      const id = identifier.trim().toUpperCase();
      const result = await searchWithMultipleStrategies(id);
      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Detect identifier type
function detectIdType(id: string): string[] {
  const strategies: string[] = [];
  if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(id)) strategies.push("ID_ISIN");
  if (/^[A-Z0-9]{9}$/.test(id) && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(id)) strategies.push("ID_CUSIP");
  if (/^[A-Z0-9]{7}$/.test(id)) strategies.push("ID_SEDOL");
  if (/^BBG[A-Z0-9]{9}$/.test(id)) {
    strategies.push("ID_BB_GLOBAL");
    strategies.push("COMPOSITE_ID_BB_GLOBAL");
  }
  strategies.push("TICKER");
  return strategies;
}

async function searchWithMultipleStrategies(id: string): Promise<any> {
  const strategies = detectIdType(id);

  for (const idType of strategies) {
    try {
      const mappingJob = [{ idType, idValue: id }];

      if (idType === "TICKER") {
        const result = await callOpenFigiMapping(mappingJob);
        if (result && result[0]?.data?.length > 0) {
          const bestMatch = pickBestResult(result[0].data, id);
          return {
            identifier: id,
            found: true,
            asset: figiToAsset(bestMatch, id, false),
            allMatches: result[0].data.length,
          };
        }
      } else {
        const result = await callOpenFigiMapping(mappingJob);
        if (result && result[0]?.data?.length > 0) {
          const bestMatch = pickBestResult(result[0].data, id);
          return {
            identifier: id,
            found: true,
            asset: figiToAsset(bestMatch, id, idType === "ID_ISIN"),
            allMatches: result[0].data.length,
          };
        }
      }
    } catch (err) {
      console.warn(`Strategy ${idType} failed for ${id}:`, err);
    }
  }

  try {
    const searchResult = await callOpenFigiSearch(id);
    if (searchResult?.data?.length > 0) {
      const bestMatch = pickBestResult(searchResult.data, id);
      return {
        identifier: id,
        found: true,
        asset: figiToAsset(bestMatch, id, false),
        allMatches: searchResult.data.length,
        source: "search",
      };
    }
  } catch (err) {
    console.warn(`Search fallback failed for ${id}:`, err);
  }

  return { identifier: id, found: false };
}

function getOpenFigiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = Deno.env.get("OPENFIGI_API_KEY");
  if (apiKey) {
    headers["X-OPENFIGI-APIKEY"] = apiKey;
  }
  return headers;
}

function hasApiKey(): boolean {
  return !!Deno.env.get("OPENFIGI_API_KEY");
}

async function callOpenFigiMapping(jobs: any[]): Promise<any> {
  const response = await fetch("https://api.openfigi.com/v3/mapping", {
    method: "POST",
    headers: getOpenFigiHeaders(),
    body: JSON.stringify(jobs),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenFIGI mapping error:", response.status, errText);
    return null;
  }

  return await response.json();
}

async function callOpenFigiSearch(query: string, exchCode?: string, start?: number): Promise<any> {
  const searchBody: any = { query };
  if (exchCode) searchBody.exchCode = exchCode;
  if (start !== undefined) searchBody.start = String(start);

  const response = await fetch("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: getOpenFigiHeaders(),
    body: JSON.stringify(searchBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenFIGI search error:", response.status, errText);
    return null;
  }

  return await response.json();
}

function pickBestResult(data: any[], identifier: string): any {
  const scored = data.map((item) => {
    let score = 0;
    if (item.securityType === "Common Stock" || item.marketSector === "Equity") score += 10;
    if (item.securityType === "ETP" || item.securityType === "ETF") score += 5;
    if (item.name) score += 3;
    if (item.ticker) score += 2;
    if (item.exchCode) score += 1;
    if (item.securityCurrency) score += 1;
    if (item.micCode) score += 1;
    const majorExchanges = ["UN", "UW", "UQ", "US", "LN", "FP", "PA", "GR", "JT", "HK"];
    if (majorExchanges.includes(item.exchCode)) score += 5;
    if (item.ticker?.toUpperCase() === identifier.toUpperCase()) score += 8;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
}

const EXCHANGE_TO_COUNTRY: Record<string, string> = {
  UN: "United States",
  UW: "United States",
  UQ: "United States",
  US: "United States",
  UA: "United States",
  LN: "United Kingdom",
  GB: "United Kingdom",
  FP: "France",
  PA: "France",
  GR: "Germany",
  GY: "Germany",
  GF: "Germany",
  JT: "Japan",
  JP: "Japan",
  HK: "Hong Kong",
  SS: "China",
  SZ: "China",
  CT: "Canada",
  CA: "Canada",
  CN: "Canada",
  AT: "Australia",
  AU: "Australia",
  IM: "Italy",
  IT: "Italy",
  SM: "Spain",
  MC: "Spain",
  NA: "Netherlands",
  NL: "Netherlands",
  BB: "Belgium",
  BE: "Belgium",
  SW: "Switzerland",
  SE: "Switzerland",
  VX: "Switzerland",
  SP: "Singapore",
  SG: "Singapore",
  IB: "India",
  IN: "India",
  IS: "India",
  MP: "Mauritius",
  MU: "Mauritius",
  SJ: "South Africa",
  ZA: "South Africa",
  BZ: "Brazil",
  BR: "Brazil",
  KS: "South Korea",
  KR: "South Korea",
  TT: "Taiwan",
  TW: "Taiwan",
  MM: "Mexico",
  MX: "Mexico",
};

const EXCHANGE_TO_ISO: Record<string, string> = {
  UN: "US",
  UW: "US",
  UQ: "US",
  US: "US",
  UA: "US",
  LN: "GB",
  GB: "GB",
  FP: "FR",
  PA: "FR",
  GR: "DE",
  GY: "DE",
  GF: "DE",
  JT: "JP",
  JP: "JP",
  HK: "HK",
  SS: "CN",
  SZ: "CN",
  CT: "CA",
  CA: "CA",
  CN: "CA",
  AT: "AU",
  AU: "AU",
  IM: "IT",
  IT: "IT",
  SM: "ES",
  MC: "ES",
  NA: "NL",
  NL: "NL",
  BB: "BE",
  BE: "BE",
  SW: "CH",
  SE: "CH",
  VX: "CH",
  SP: "SG",
  SG: "SG",
  IB: "IN",
  IN: "IN",
  IS: "IN",
  MP: "MU",
  MU: "MU",
  SJ: "ZA",
  ZA: "ZA",
  BZ: "BR",
  BR: "BR",
  KS: "KR",
  KR: "KR",
  TT: "TW",
  TW: "TW",
  MM: "MX",
  MX: "MX",
};

// Exchange code to MIC code mapping for when OpenFIGI doesn't return micCode
const EXCHANGE_TO_MIC: Record<string, string> = {
  UN: "XNYS",
  UW: "XNAS",
  UQ: "XNAS",
  US: "XNYS",
  UA: "ARCX",
  LN: "XLON",
  GB: "XLON",
  FP: "XPAR",
  PA: "XPAR",
  GR: "XFRA",
  GY: "XFRA",
  GF: "XFRA",
  JT: "XTKS",
  JP: "XTKS",
  HK: "XHKG",
  SS: "XSHG",
  SZ: "XSHE",
  CT: "XTSE",
  CA: "XTSE",
  CN: "XTSE",
  AT: "XASX",
  AU: "XASX",
  IM: "XMIL",
  IT: "XMIL",
  SM: "XMAD",
  MC: "XMAD",
  NA: "XAMS",
  NL: "XAMS",
  BB: "XBRU",
  BE: "XBRU",
  SW: "XSWX",
  SE: "XSWX",
  VX: "XSWX",
  SP: "XSES",
  SG: "XSES",
  IB: "XBOM",
  IN: "XNSE",
  IS: "XNSE",
  MP: "XMAU",
  MU: "XMAU",
  SJ: "XJSE",
  ZA: "XJSE",
  BZ: "BVMF",
  BR: "BVMF",
  KS: "XKRX",
  KR: "XKRX",
  TT: "XTAI",
  TW: "XTAI",
  MM: "XMEX",
  MX: "XMEX",
};

function figiToAsset(figi: any, identifier: string, isIsin: boolean) {
  const exchCode = figi.exchCode || "";
  const ticker = figi.ticker || "";
  const ric = ticker && exchCode ? `${ticker}.${exchCode}` : ticker || "";
  const country = EXCHANGE_TO_COUNTRY[exchCode] || exchCode;
  const countryId = EXCHANGE_TO_ISO[exchCode] || exchCode;
  const isin = isIsin ? identifier : "";
  // Ensure MIC code is always populated
  const micCode = figi.micCode || EXCHANGE_TO_MIC[exchCode] || "";

  const parts = [figi.name || "Unknown"];
  if (figi.securityType) parts.push(figi.securityType);
  if (figi.marketSector) parts.push(figi.marketSector);
  if (exchCode) parts.push(exchCode);
  const description = parts.join(" | ");

  return {
    asset_name: figi.name || "Unknown",
    isin: isin,
    sector: figi.marketSector || figi.securityType2 || figi.securityType || "",
    acf: figi.compositeFIGI || figi.figi || "",
    ric: ric,
    ticker: ticker,
    symbol: ticker,
    country_id: countryId,
    country: country,
    mic_code: micCode,
    currency_id: figi.securityCurrency || "",
    currency: figi.securityCurrency || "",
    description: description,
    source: "openfigi",
  };
}

// Handle free text search (country + sector enrichment)
async function handleTextSearch(searchQuery: string, limitRaw?: number) {
  const query = searchQuery.trim();
  if (!query) {
    return new Response(JSON.stringify({ assets: [], total: 0, hasMore: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const limit = Math.max(50, Math.min(Number(limitRaw) || 200, hasApiKey() ? 1500 : 300));
  const maxPages = Math.max(1, Math.ceil(limit / 100));
  const delay = hasApiKey() ? 100 : 350;

  const allAssets: any[] = [];
  const seenFigis = new Set<string>();
  let currentStart = 0;

  for (let page = 0; page < maxPages; page++) {
    console.log(`Text-search: query="${query}", start=${currentStart}`);

    const data = await callOpenFigiSearch(query, undefined, currentStart);
    const items = data?.data || [];

    if (items.length === 0) break;

    for (const figi of items) {
      const key = figi.figi || figi.compositeFIGI || `${figi.ticker}-${figi.exchCode}-${figi.name}`;
      if (!seenFigis.has(key)) {
        seenFigis.add(key);
        allAssets.push(figiToAsset(figi, "", false));
      }
      if (allAssets.length >= limit) break;
    }

    if (allAssets.length >= limit) break;

    currentStart += items.length;
    if (items.length < 100) break;
    await new Promise((r) => setTimeout(r, delay));
  }

  return new Response(
    JSON.stringify({
      assets: allAssets,
      total: allAssets.length,
      hasMore: allAssets.length >= limit,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Handle single exchange search with deep pagination
async function handleExchangeSearch(exchCode: string, start: number) {
  const allAssets: any[] = [];
  const seenFigis = new Set<string>();
  const MAX_PAGES = hasApiKey() ? 50 : 10;
  let currentStart = start;
  const delay = hasApiKey() ? 100 : 300;

  for (let page = 0; page < MAX_PAGES; page++) {
    console.log(`Searching exchange ${exchCode}, start=${currentStart}, page=${page + 1}/${MAX_PAGES}`);

    const data = await callOpenFigiSearch("", exchCode, currentStart);
    const items = data?.data || [];

    if (items.length === 0) break;

    for (const figi of items) {
      const key = figi.figi || figi.compositeFIGI || `${figi.ticker}-${figi.exchCode}-${figi.name}`;
      if (!seenFigis.has(key)) {
        seenFigis.add(key);
        allAssets.push(figiToAsset(figi, "", false));
      }
    }

    currentStart += items.length;
    if (items.length < 100) break;
    await new Promise((r) => setTimeout(r, delay));
  }

  return new Response(
    JSON.stringify({
      assets: allAssets,
      total: allAssets.length,
      nextStart: currentStart,
      hasMore: allAssets.length >= MAX_PAGES * 100,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

// Handle multi-exchange search (all exchanges for a country)
async function handleMultiExchangeSearch(exchCodes: string[]) {
  const allAssets: any[] = [];
  const seenFigis = new Set<string>();
  const delay = hasApiKey() ? 100 : 350;
  const maxPagesPerExchange = hasApiKey() ? 30 : 5;

  for (const exchCode of exchCodes) {
    let currentStart = 0;

    for (let page = 0; page < maxPagesPerExchange; page++) {
      console.log(`Multi-search: exchange ${exchCode}, start=${currentStart}`);

      const data = await callOpenFigiSearch("", exchCode, currentStart);
      const items = data?.data || [];

      if (items.length === 0) break;

      for (const figi of items) {
        const key = figi.figi || figi.compositeFIGI || `${figi.ticker}-${figi.exchCode}-${figi.name}`;
        if (!seenFigis.has(key)) {
          seenFigis.add(key);
          allAssets.push(figiToAsset(figi, "", false));
        }
      }

      currentStart += items.length;
      if (items.length < 100) break;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return new Response(
    JSON.stringify({
      assets: allAssets,
      total: allAssets.length,
      hasMore: false,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
