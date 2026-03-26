import axios from "axios";
import type { FinancialAsset } from "@/lib/mock-data";
import { getApiErrorMessage } from "@/lib/error-utils";

const API_KEY = "69a195198fdc85.31219217";

interface EODHDResult {
  Symbol: string;
  Name: string;
  Country: string;
  Exchange: string;
  Type: string;
  Currency: string;
  Description: string;
}

export const searchViaEODHD = async (query: string): Promise<FinancialAsset | null> => {


  try {
    const response = await axios.get(`https://eodhd.com/api/search/${encodeURIComponent(query)}`, {
      params: {
        api_token: API_KEY,
        limit: 1,
      },
    });

    const results: EODHDResult[] = response.data || [];
    if (!results.length) return null;

    const data = results[0];
    const symbolParts = data.Symbol.split(".");
    const baseSymbol = symbolParts[0];
    const exchange = symbolParts[1] || data.Exchange;

    const asset: FinancialAsset = {
      id: crypto.randomUUID(),
      assetName: data.Name,
      isin: `NOISIN-${baseSymbol.toUpperCase()}-${data.Country.slice(0,2).toUpperCase()}`,
      sector: data.Type || "",
      acf: "",
      ric: data.Symbol,
      ticker: baseSymbol,
      symbol: baseSymbol,
      countryId: data.Country.slice(0,2).toUpperCase(),
      country: data.Country,
      micCode: exchange,
      currencyId: data.Currency,
      currency: data.Currency,
      description: data.Description || "",
      source: "eodhd",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

    };

    return asset;
  } catch (error) {
    const msg = getApiErrorMessage(error, "EODHD");
    console.error(msg);
    return null;
  }
};

