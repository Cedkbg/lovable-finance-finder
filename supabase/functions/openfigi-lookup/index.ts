import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Mode 1: Search by exchange code (country batch import)
    if (body.exchCode) {
      return await handleExchangeSearch(body.exchCode, body.start || 0);
    }

    // Mode 2: Standard identifier mapping (multi-strategy)
    const { identifiers } = body;
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return new Response(JSON.stringify({ error: 'identifiers array or exchCode required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];

    for (const identifier of identifiers) {
      const id = identifier.trim().toUpperCase();
      const result = await searchWithMultipleStrategies(id);
      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Detect identifier type
function detectIdType(id: string): string[] {
  const strategies: string[] = [];
  
  // ISIN: 2 letters + 9 alphanumeric + 1 check digit
  if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(id)) {
    strategies.push('ID_ISIN');
  }
  // CUSIP: 9 alphanumeric characters
  if (/^[A-Z0-9]{9}$/.test(id) && !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(id)) {
    strategies.push('ID_CUSIP');
  }
  // SEDOL: 7 alphanumeric characters
  if (/^[A-Z0-9]{7}$/.test(id)) {
    strategies.push('ID_SEDOL');
  }
  // FIGI: BBG + 9 alphanumeric
  if (/^BBG[A-Z0-9]{9}$/.test(id)) {
    strategies.push('ID_BB_GLOBAL');
    strategies.push('COMPOSITE_ID_BB_GLOBAL');
  }
  // Default: try as ticker
  strategies.push('TICKER');
  
  return strategies;
}

async function searchWithMultipleStrategies(id: string): Promise<any> {
  const strategies = detectIdType(id);
  
  for (const idType of strategies) {
    try {
      const mappingJob = [{ idType, idValue: id }];
      
      // For tickers, also try with common exchange codes to get more results
      if (idType === 'TICKER') {
        // First try without exchange filter (gets composite/global result)
        const result = await callOpenFigiMapping(mappingJob);
        if (result && result[0]?.data?.length > 0) {
          // Pick the best result from all matches
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
            asset: figiToAsset(bestMatch, id, idType === 'ID_ISIN'),
            allMatches: result[0].data.length,
          };
        }
      }
    } catch (err) {
      console.warn(`Strategy ${idType} failed for ${id}:`, err);
    }
  }

  // Last resort: try the /v3/search endpoint for fuzzy matching
  try {
    const searchResult = await callOpenFigiSearch(id);
    if (searchResult?.data?.length > 0) {
      const bestMatch = pickBestResult(searchResult.data, id);
      return {
        identifier: id,
        found: true,
        asset: figiToAsset(bestMatch, id, false),
        allMatches: searchResult.data.length,
        source: 'search',
      };
    }
  } catch (err) {
    console.warn(`Search fallback failed for ${id}:`, err);
  }

  return { identifier: id, found: false };
}

function getOpenFigiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = Deno.env.get('OPENFIGI_API_KEY');
  if (apiKey) {
    headers['X-OPENFIGI-APIKEY'] = apiKey;
    console.log('Using OpenFIGI API key (200 req/min)');
  } else {
    console.log('No OpenFIGI API key (6 req/min limit)');
  }
  return headers;
}

async function callOpenFigiMapping(jobs: any[]): Promise<any> {
  const response = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: getOpenFigiHeaders(),
    body: JSON.stringify(jobs),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('OpenFIGI mapping error:', response.status, errText);
    return null;
  }

  return await response.json();
}

async function callOpenFigiSearch(query: string): Promise<any> {
  const response = await fetch('https://api.openfigi.com/v3/search', {
    method: 'POST',
    headers: getOpenFigiHeaders(),
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('OpenFIGI search error:', response.status, errText);
    return null;
  }

  return await response.json();
}

// Pick the best result from multiple OpenFIGI matches
function pickBestResult(data: any[], identifier: string): any {
  // Prioritize: Common Stock > ETF > other types
  // Also prefer results with more complete data
  const scored = data.map(item => {
    let score = 0;
    
    // Prefer equity/common stock
    if (item.securityType === 'Common Stock' || item.marketSector === 'Equity') score += 10;
    if (item.securityType === 'ETP' || item.securityType === 'ETF') score += 5;
    
    // Prefer items with complete data
    if (item.name) score += 3;
    if (item.ticker) score += 2;
    if (item.exchCode) score += 1;
    if (item.securityCurrency) score += 1;
    if (item.micCode) score += 1;
    
    // Prefer major exchanges
    const majorExchanges = ['UN', 'UW', 'UQ', 'US', 'LN', 'FP', 'PA', 'GR', 'JT', 'HK'];
    if (majorExchanges.includes(item.exchCode)) score += 5;
    
    // Exact ticker match gets a bonus
    if (item.ticker?.toUpperCase() === identifier.toUpperCase()) score += 8;

    return { item, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
}

// Map exchange codes to country names
const EXCHANGE_TO_COUNTRY: Record<string, string> = {
  'UN': 'United States', 'UW': 'United States', 'UQ': 'United States', 'US': 'United States', 'UA': 'United States',
  'LN': 'United Kingdom', 'GB': 'United Kingdom',
  'FP': 'France', 'PA': 'France',
  'GR': 'Germany', 'GY': 'Germany', 'GF': 'Germany',
  'JT': 'Japan', 'JP': 'Japan',
  'HK': 'Hong Kong',
  'SS': 'China', 'SZ': 'China',
  'CT': 'Canada', 'CA': 'Canada', 'CN': 'Canada',
  'AT': 'Australia', 'AU': 'Australia',
  'IM': 'Italy', 'IT': 'Italy',
  'SM': 'Spain', 'MC': 'Spain',
  'NA': 'Netherlands', 'NL': 'Netherlands',
  'BB': 'Belgium', 'BE': 'Belgium',
  'SW': 'Switzerland', 'SE': 'Switzerland', 'VX': 'Switzerland',
  'SP': 'Singapore', 'SG': 'Singapore',
  'IB': 'India', 'IN': 'India', 'IS': 'India',
  'MP': 'Mauritius', 'MU': 'Mauritius',
  'SJ': 'South Africa', 'ZA': 'South Africa',
  'BZ': 'Brazil', 'BR': 'Brazil',
  'KS': 'South Korea', 'KR': 'South Korea',
  'TT': 'Taiwan', 'TW': 'Taiwan',
  'MM': 'Mexico', 'MX': 'Mexico',
};

// Map exchange codes to ISO country codes
const EXCHANGE_TO_ISO: Record<string, string> = {
  'UN': 'US', 'UW': 'US', 'UQ': 'US', 'US': 'US', 'UA': 'US',
  'LN': 'GB', 'GB': 'GB',
  'FP': 'FR', 'PA': 'FR',
  'GR': 'DE', 'GY': 'DE', 'GF': 'DE',
  'JT': 'JP', 'JP': 'JP',
  'HK': 'HK',
  'SS': 'CN', 'SZ': 'CN',
  'CT': 'CA', 'CA': 'CA', 'CN': 'CA',
  'AT': 'AU', 'AU': 'AU',
  'IM': 'IT', 'IT': 'IT',
  'SM': 'ES', 'MC': 'ES',
  'NA': 'NL', 'NL': 'NL',
  'BB': 'BE', 'BE': 'BE',
  'SW': 'CH', 'SE': 'CH', 'VX': 'CH',
  'SP': 'SG', 'SG': 'SG',
  'IB': 'IN', 'IN': 'IN', 'IS': 'IN',
  'MP': 'MU', 'MU': 'MU',
  'SJ': 'ZA', 'ZA': 'ZA',
  'BZ': 'BR', 'BR': 'BR',
  'KS': 'KR', 'KR': 'KR',
  'TT': 'TW', 'TW': 'TW',
  'MM': 'MX', 'MX': 'MX',
};

function figiToAsset(figi: any, identifier: string, isIsin: boolean) {
  const exchCode = figi.exchCode || '';
  const ticker = figi.ticker || '';
  
  // Build proper RIC: TICKER.EXCHANGE_CODE
  const ric = ticker && exchCode ? `${ticker}.${exchCode}` : (ticker || '');
  
  // Proper country resolution
  const country = EXCHANGE_TO_COUNTRY[exchCode] || exchCode;
  const countryId = EXCHANGE_TO_ISO[exchCode] || exchCode;
  
  // For ISIN searches, use the identifier as ISIN. Otherwise leave empty (we don't have it)
  const isin = isIsin ? identifier : '';
  
  // Build a meaningful description
  const parts = [figi.name || 'Unknown'];
  if (figi.securityType) parts.push(figi.securityType);
  if (figi.marketSector) parts.push(figi.marketSector);
  if (exchCode) parts.push(exchCode);
  const description = parts.join(' | ');

  return {
    asset_name: figi.name || 'Unknown',
    isin: isin,
    sector: figi.marketSector || figi.securityType2 || figi.securityType || '',
    acf: figi.compositeFIGI || figi.figi || '',
    ric: ric,
    ticker: ticker,
    symbol: ticker,
    country_id: countryId,
    country: country,
    mic_code: figi.micCode || '',
    currency_id: figi.securityCurrency || '',
    currency: figi.securityCurrency || '',
    description: description,
    source: 'openfigi',
  };
}

async function handleExchangeSearch(exchCode: string, start: number) {
  const allAssets: any[] = [];
  let currentStart = start;
  const MAX_PAGES = 10;
  
  for (let page = 0; page < MAX_PAGES; page++) {
    const searchBody = {
      query: exchCode,
      exchCode: exchCode,
      start: String(currentStart),
    };

    console.log(`Searching OpenFIGI exchange ${exchCode}, start=${currentStart}`);

    const response = await fetch('https://api.openfigi.com/v3/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenFIGI search error:', response.status, errText);
      break;
    }

    const data = await response.json();
    const items = data.data || [];
    
    if (items.length === 0) break;

    const seen = new Set(allAssets.map(a => a.ticker));
    for (const figi of items) {
      const ticker = figi.ticker || '';
      if (ticker && !seen.has(ticker)) {
        seen.add(ticker);
        allAssets.push(figiToAsset(figi, '', false));
      }
    }

    currentStart += items.length;
    if (items.length < 100) break;
    await new Promise(r => setTimeout(r, 250));
  }

  return new Response(JSON.stringify({
    assets: allAssets,
    total: allAssets.length,
    nextStart: currentStart,
    hasMore: allAssets.length >= MAX_PAGES * 100,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
