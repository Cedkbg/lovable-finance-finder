import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifiers } = await req.json();
    
    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      return new Response(JSON.stringify({ error: 'identifiers array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // OpenFIGI API - free tier (no API key, 5 req/min, 100 identifiers/req)
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
    
    // Transform OpenFIGI response into our asset format
    const results = data.map((item: any, index: number) => {
      if (item.warning || !item.data || item.data.length === 0) {
        return { identifier: identifiers[index], found: false };
      }
      
      const figi = item.data[0];
      return {
        identifier: identifiers[index],
        found: true,
        asset: {
          asset_name: figi.name || 'Unknown',
          isin: mappingJobs[index].idType === 'ID_ISIN' ? identifiers[index] : (figi.compositeFIGI || ''),
          sector: figi.securityType2 || figi.securityType || '',
          acf: figi.compositeFIGI || '',
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
        },
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
