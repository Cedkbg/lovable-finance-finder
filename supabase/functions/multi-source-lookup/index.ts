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
    const { source, query, sector, country, limit } = body;

    let results: any[] = [];

    if (source === "coingecko" || sector?.toLowerCase()?.includes("crypto") || sector?.toLowerCase()?.includes("digital")) {
      results = await searchCoinGecko(query, limit || 100);
    } else if (source === "exchangerates" || sector?.toLowerCase()?.includes("devis") || sector?.toLowerCase()?.includes("currency") || sector?.toLowerCase()?.includes("forex")) {
      results = await searchExchangeRates(country);
    } else if (source === "all" || !source) {
      // Search all free sources in parallel
      const [crypto, forex] = await Promise.all([
        searchCoinGecko(query, Math.min(limit || 50, 100)).catch(() => []),
        searchExchangeRates(country).catch(() => []),
      ]);
      results = [...crypto, ...forex];
    }

    return new Response(
      JSON.stringify({ assets: results, total: results.length, source: source || "multi" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Multi-source error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── CoinGecko (free, no key) ───────────────────────────────
async function searchCoinGecko(query?: string, limit = 50): Promise<any[]> {
  try {
    // If query provided, search; otherwise list top coins
    let coins: any[] = [];

    if (query && query.trim().length > 0) {
      const searchResp = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
      );
      if (!searchResp.ok) {
        console.warn("CoinGecko search failed:", searchResp.status);
        return [];
      }
      const searchData = await searchResp.json();
      coins = (searchData.coins || []).slice(0, limit);
    } else {
      const listResp = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${Math.min(limit, 250)}&page=1&sparkline=false`
      );
      if (!listResp.ok) {
        console.warn("CoinGecko markets failed:", listResp.status);
        return [];
      }
      coins = await listResp.json();
    }

    return coins.map((coin: any) => ({
      asset_name: coin.name || coin.id || "Unknown Crypto",
      isin: "", // Crypto has no ISIN
      sector: "Digital Assets",
      acf: "",
      ric: "",
      ticker: (coin.symbol || coin.id || "").toUpperCase(),
      symbol: (coin.symbol || "").toUpperCase(),
      country_id: "",
      country: "Global",
      mic_code: "",
      currency_id: "USD",
      currency: "USD",
      description: `Crypto | ${coin.name || coin.id} | CoinGecko${coin.market_cap_rank ? ` | Rank #${coin.market_cap_rank}` : ""}`,
      source: "coingecko",
    }));
  } catch (err) {
    console.error("CoinGecko error:", err);
    return [];
  }
}

// ─── Exchange Rates API (free, no key) ──────────────────────
async function searchExchangeRates(country?: string): Promise<any[]> {
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!resp.ok) {
      console.warn("Exchange rates API failed:", resp.status);
      return [];
    }
    const data = await resp.json();
    const rates = data.rates || {};

    // Map currency codes to country names
    const CURRENCY_COUNTRIES: Record<string, string> = {
      EUR: "European Union", USD: "United States", GBP: "United Kingdom",
      JPY: "Japan", CHF: "Switzerland", CAD: "Canada", AUD: "Australia",
      CNY: "China", HKD: "Hong Kong", SGD: "Singapore", KRW: "South Korea",
      INR: "India", BRL: "Brazil", ZAR: "South Africa", MXN: "Mexico",
      TRY: "Turkey", RUB: "Russia", PLN: "Poland", SEK: "Sweden",
      NOK: "Norway", DKK: "Denmark", NZD: "New Zealand", THB: "Thailand",
      MYR: "Malaysia", IDR: "Indonesia", PHP: "Philippines", CZK: "Czech Republic",
      HUF: "Hungary", ILS: "Israel", CLP: "Chile", COP: "Colombia",
      PEN: "Peru", ARS: "Argentina", EGP: "Egypt", NGN: "Nigeria",
      KES: "Kenya", GHS: "Ghana", MAD: "Morocco", TND: "Tunisia",
      DZD: "Algeria", XOF: "UEMOA", XAF: "CEMAC", CDF: "Congo-Kinshasa",
      BWP: "Botswana", MUR: "Mauritius", ETB: "Ethiopia", TZS: "Tanzania",
      UGX: "Uganda", RWF: "Rwanda", AOA: "Angola", MZN: "Mozambique",
      SAR: "Saudi Arabia", AED: "United Arab Emirates", QAR: "Qatar",
      KWD: "Kuwait", BHD: "Bahrain", OMR: "Oman", JOD: "Jordan",
      TWD: "Taiwan", VND: "Vietnam", PKR: "Pakistan", BDT: "Bangladesh",
      LKR: "Sri Lanka", MMK: "Myanmar",
    };

    const CURRENCY_ISO: Record<string, string> = {
      EUR: "EU", USD: "US", GBP: "GB", JPY: "JP", CHF: "CH", CAD: "CA",
      AUD: "AU", CNY: "CN", HKD: "HK", SGD: "SG", KRW: "KR", INR: "IN",
      BRL: "BR", ZAR: "ZA", MXN: "MX", TRY: "TR", RUB: "RU", PLN: "PL",
      SEK: "SE", NOK: "NO", DKK: "DK", NZD: "NZ", THB: "TH", MYR: "MY",
      IDR: "ID", PHP: "PH", CZK: "CZ", HUF: "HU", ILS: "IL", CLP: "CL",
      COP: "CO", PEN: "PE", ARS: "AR", EGP: "EG", NGN: "NG", KES: "KE",
      GHS: "GH", MAD: "MA", TND: "TN", DZD: "DZ", XOF: "BF", XAF: "CM",
      CDF: "CD", BWP: "BW", MUR: "MU", ETB: "ET", TZS: "TZ", UGX: "UG",
      RWF: "RW", AOA: "AO", MZN: "MZ", SAR: "SA", AED: "AE", QAR: "QA",
      KWD: "KW", BHD: "BH", OMR: "OM", JOD: "JO", TWD: "TW", VND: "VN",
      PKR: "PK", BDT: "BD", LKR: "LK", MMK: "MM",
    };

    let entries = Object.entries(rates);

    // Filter by country if specified
    if (country) {
      const countryLower = country.toLowerCase();
      entries = entries.filter(([code]) => {
        const cn = (CURRENCY_COUNTRIES[code] || "").toLowerCase();
        return cn.includes(countryLower) || code.toLowerCase().includes(countryLower);
      });
    }

    return entries.map(([code, rate]) => ({
      asset_name: `${code}/USD`,
      isin: "",
      sector: "Currency",
      acf: "",
      ric: `${code}=X`,
      ticker: code,
      symbol: code,
      country_id: CURRENCY_ISO[code] || "",
      country: CURRENCY_COUNTRIES[code] || "Global",
      mic_code: "",
      currency_id: code,
      currency: code,
      description: `Currency | ${code}/USD | Rate: ${rate} | ExchangeRatesAPI`,
      source: "exchangerates",
    }));
  } catch (err) {
    console.error("Exchange rates error:", err);
    return [];
  }
}
