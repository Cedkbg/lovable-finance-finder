export interface FinancialAsset {
  id: string;
  assetName: string;
  isin: string;
  sector: string;
  acf: string;
  ric: string;
  ticker: string;
  symbol: string;
  createdAt: string;
  updatedAt: string;
  countryId: string;
  country: string;
  micCode: string;
  currencyId: string;
  currency: string;
  description: string;
  source?: string;
}

// No more static mock data — all data comes from EODHD API in real-time
export const MOCK_DATA: FinancialAsset[] = [];
