const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EODHD_BASE = "https://eodhd.com/api";

// Country → Exchange code mapping for EODHD
const COUNTRY_EXCHANGE_MAP: Record<string, string[]> = {
  // Africa
  "Morocco": ["BC"], "Maroc": ["BC"],
  "Nigeria": ["XNSA"], "Nigéria": ["XNSA"],
  "Egypt": ["EGX"], "Égypte": ["EGX"],
  "South Africa": ["JSE"], "Afrique du Sud": ["JSE"],
  "Kenya": ["NSE"], 
  "Tunisia": ["TN"], "Tunisie": ["TN"],
  "Ghana": ["GSE"],
  "Botswana": ["BSE"],
  "Mauritius": ["SEM"], "Maurice": ["SEM"],
  "Tanzania": ["DSE"], "Tanzanie": ["DSE"],
  "Uganda": ["USE"], "Ouganda": ["USE"],
  "Zimbabwe": ["ZSE"],
  "Zambia": ["LuSE"], "Zambie": ["LuSE"],
  "Namibia": ["NSX"], "Namibie": ["NSX"],
  "Rwanda": ["RSE"],
  "Côte d'Ivoire": ["BRVM"], "Ivory Coast": ["BRVM"],
  // Americas
  "United States": ["US", "NYSE", "NASDAQ"], "États-Unis": ["US"],
  "Canada": ["TO", "V"],
  "Brazil": ["SA"], "Brésil": ["SA"],
  "Mexico": ["MX"], "Mexique": ["MX"],
  "Argentina": ["BA"], "Argentine": ["BA"],
  "Chile": ["SN"], "Chili": ["SN"],
  "Colombia": ["CL"], "Colombie": ["CL"],
  "Peru": ["LM"], "Pérou": ["LM"],
  // Europe
  "France": ["PA"],
  "Germany": ["XETRA", "BE"], "Allemagne": ["XETRA"],
  "United Kingdom": ["LSE"], "Royaume-Uni": ["LSE"],
  "Switzerland": ["SW"], "Suisse": ["SW"],
  "Netherlands": ["AS"], "Pays-Bas": ["AS"],
  "Spain": ["MC"], "Espagne": ["MC"],
  "Italy": ["MI"], "Italie": ["MI"],
  "Belgium": ["BR"], "Belgique": ["BR"],
  "Portugal": ["LS"],
  "Austria": ["VI"], "Autriche": ["VI"],
  "Sweden": ["ST"], "Suède": ["ST"],
  "Norway": ["OL"], "Norvège": ["OL"],
  "Denmark": ["CO"], "Danemark": ["CO"],
  "Finland": ["HE"], "Finlande": ["HE"],
  "Ireland": ["IR"], "Irlande": ["IR"],
  "Poland": ["WAR"], "Pologne": ["WAR"],
  "Greece": ["AT"], "Grèce": ["AT"],
  "Turkey": ["IS"], "Turquie": ["IS"],
  "Russia": ["MCX"], "Russie": ["MCX"],
  // Asia
  "Japan": ["TSE"], "Japon": ["TSE"],
  "China": ["SHG", "SHE"], "Chine": ["SHG", "SHE"],
  "Hong Kong": ["HK"],
  "India": ["NSE", "BSE"], "Inde": ["NSE", "BSE"],
  "South Korea": ["KO"], "Corée du Sud": ["KO"],
  "Taiwan": ["TW"], "Taïwan": ["TW"],
  "Singapore": ["SGX"], "Singapour": ["SGX"],
  "Indonesia": ["JK"], "Indonésie": ["JK"],
  "Malaysia": ["KLSE"], "Malaisie": ["KLSE"],
  "Thailand": ["BK"], "Thaïlande": ["BK"],
  "Philippines": ["PSE"],
  "Vietnam": ["VN"],
  "Pakistan": ["KAR"],
  "Bangladesh": ["DH"],
  "Sri Lanka": ["CSE"],
  // Oceania
  "Australia": ["AU"], "Australie": ["AU"],
  "New Zealand": ["NZ"], "Nouvelle-Zélande": ["NZ"],
  // Middle East
  "Saudi Arabia": ["SR"], "Arabie Saoudite": ["SR"],
  "UAE": ["ADX"], "Émirats": ["ADX"],
  "Israel": ["TA"], "Israël": ["TA"],
  "Qatar": ["QA"],
  "Kuwait": ["KW"], "Koweït": ["KW"],
};

function getExchangeCodes(country: string): string[] {
  const upper = country.trim();
  // Direct match
  if (COUNTRY_EXCHANGE_MAP[upper]) return COUNTRY_EXCHANGE_MAP[upper];
  // Case-insensitive
  for (const [key, val] of Object.entries(COUNTRY_EXCHANGE_MAP)) {
    if (key.toUpperCase() === upper.toUpperCase()) return val;
  }
  // If it looks like an exchange code already (2-5 chars), use it
  if (upper.length >= 2 && upper.length <= 5) return [upper];
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("EODHD_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { mode, country, query, ticker, exchange, limit = 100 } = body;

    // MODE 1: Exchange symbol list (by country)
    if (mode === "exchange-list" && (country || exchange)) {
      const exchanges = exchange ? [exchange] : getExchangeCodes(country);
      if (exchanges.length === 0) {
        return new Response(JSON.stringify({ assets: [], message: `No exchange found for "${country}"` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allAssets: any[] = [];
      for (const exch of exchanges) {
        const url = `${EODHD_BASE}/exchange-symbol-list/${exch}?api_token=${apiKey}&fmt=json`;
        const resp = await fetch(url);
        if (!resp.ok) {
          console.warn(`EODHD exchange-symbol-list ${exch}: ${resp.status}`);
          continue;
        }
        const data = await resp.json();
        if (!Array.isArray(data)) continue;

        const limited = data.slice(0, limit);
        for (const item of limited) {
          allAssets.push({
            asset_name: item.Name || item.Code || "Unknown",
            isin: item.Isin || "",
            ticker: item.Code || "",
            symbol: item.Code || "",
            ric: `${item.Code}.${exch}`,
            acf: "",
            sector: item.Type || "Equity",
            country_id: item.Country || "",
            country: item.Country || country || "",
            mic_code: item.Exchange || exch,
            currency_id: item.Currency || "",
            currency: item.Currency || "",
            description: `${item.Name || ""} - ${item.Exchange || exch}`,
            source: "eodhd",
          });
        }
      }

      return new Response(JSON.stringify({ assets: allAssets, count: allAssets.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODE 2: Search query (text search)
    if (mode === "search" && query) {
      const url = `${EODHD_BASE}/search/${encodeURIComponent(query)}?api_token=${apiKey}&limit=${limit}&fmt=json`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return new Response(JSON.stringify({ assets: [], error: `EODHD search failed: ${resp.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      if (!Array.isArray(data)) {
        return new Response(JSON.stringify({ assets: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assets = data.map((item: any) => ({
        asset_name: item.Name || item.Code || "Unknown",
        isin: item.ISIN || "",
        ticker: item.Code || "",
        symbol: item.Code || "",
        ric: `${item.Code}.${item.Exchange || ""}`,
        acf: "",
        sector: item.Type || "Equity",
        country_id: item.Country || "",
        country: item.Country || "",
        mic_code: item.Exchange || "",
        currency_id: item.Currency || "",
        currency: item.Currency || "",
        description: `${item.Name || ""} - ${item.Exchange || ""}`,
        source: "eodhd",
      }));

      return new Response(JSON.stringify({ assets, count: assets.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODE 3: Real-time quote for a specific ticker
    if (mode === "realtime" && ticker) {
      const exch = exchange || "US";
      const url = `${EODHD_BASE}/real-time/${encodeURIComponent(ticker)}.${exch}?api_token=${apiKey}&fmt=json`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return new Response(JSON.stringify({ asset: null, error: `Ticker not found: ${resp.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();
      return new Response(JSON.stringify({ asset: data, source: "eodhd" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODE 4: Fundamentals
    if (mode === "fundamentals" && ticker) {
      const exch = exchange || "US";
      const url = `${EODHD_BASE}/fundamentals/${encodeURIComponent(ticker)}.${exch}?api_token=${apiKey}&fmt=json`;
      const resp = await fetch(url);
      if (!resp.ok) {
        return new Response(JSON.stringify({ data: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await resp.json();

      const asset = {
        asset_name: data.General?.Name || ticker,
        isin: data.General?.ISIN || "",
        ticker: data.General?.Code || ticker,
        symbol: data.General?.Code || ticker,
        ric: `${data.General?.Code || ticker}.${exch}`,
        acf: "",
        sector: data.General?.Sector || data.General?.Industry || "Equity",
        country_id: data.General?.CountryISO || "",
        country: data.General?.Country || "",
        mic_code: data.General?.Exchange || exch,
        currency_id: data.General?.CurrencyCode || "",
        currency: data.General?.CurrencyName || data.General?.CurrencyCode || "",
        description: data.General?.Description || `${data.General?.Name || ticker}`,
        source: "eodhd",
      };

      return new Response(JSON.stringify({ asset, source: "eodhd" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode. Use: exchange-list, search, realtime, fundamentals" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("EODHD lookup error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
