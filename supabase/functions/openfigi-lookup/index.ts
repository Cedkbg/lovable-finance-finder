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

    // Mode 2: Standard identifier mapping
    const { identifiers } = body;
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return new Response(JSON.stringify({ error: 'identifiers array or exchCode required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mappingJobs = identifiers.map((id: string) => {
      const isIsin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(id);
      return {
        idType: isIsin ? 'ID_ISIN' : 'TICKER',
        idValue: id,
      };
    });

    const response = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappingJobs),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenFIGI error:', response.status, errText);
      return new Response(JSON.stringify({ error: `OpenFIGI API error: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    
    const results = data.map((item: any, index: number) => {
      if (item.warning || !item.data || item.data.length === 0) {
        return { identifier: identifiers[index], found: false };
      }
      
      const figi = item.data[0];
      return {
        identifier: identifiers[index],
        found: true,
        asset: figiToAsset(figi, identifiers[index], mappingJobs[index].idType === 'ID_ISIN'),
      };
    });

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

function figiToAsset(figi: any, identifier: string, isIsin: boolean) {
  return {
    asset_name: figi.name || 'Unknown',
    isin: isIsin ? identifier : (figi.compositeFIGI || figi.figi || ''),
    sector: figi.securityType2 || figi.securityType || '',
    acf: figi.compositeFIGI || figi.figi || '',
    ric: `${figi.ticker || ''}.${figi.exchCode || ''}`,
    ticker: figi.ticker || '',
    symbol: figi.ticker || '',
    country_id: figi.exchCode || '',
    country: figi.exchCode || '',
    mic_code: figi.micCode || figi.exchCode || '',
    currency_id: figi.securityCurrency || '',
    currency: figi.securityCurrency || '',
    description: `${figi.name || ''} - ${figi.securityType || ''} (${figi.marketSector || ''})`,
    source: 'openfigi',
  };
}

async function handleExchangeSearch(exchCode: string, start: number) {
  // Use OpenFIGI /v3/search to find all securities on an exchange
  const allAssets: any[] = [];
  let currentStart = start;
  const MAX_PAGES = 10; // Max 10 pages (1000 results) per request to avoid timeout
  
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

    // Deduplicate by ticker
    const seen = new Set(allAssets.map(a => a.ticker));
    for (const figi of items) {
      const ticker = figi.ticker || '';
      if (ticker && !seen.has(ticker)) {
        seen.add(ticker);
        allAssets.push(figiToAsset(figi, figi.compositeFIGI || figi.figi || '', false));
      }
    }

    currentStart += items.length;
    
    // If we got fewer than 100, we've reached the end
    if (items.length < 100) break;
    
    // Rate limit: small delay between pages
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
