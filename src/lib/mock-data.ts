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

// MOCK_DATA supprimé - priorité EODHD réel
export const MOCK_DATA: FinancialAsset[] = [];

