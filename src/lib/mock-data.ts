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

export const MOCK_DATA: FinancialAsset[] = [
  {
    id: "1",
    assetName: "Apple Inc.",
    isin: "US0378331005",
    sector: "Technology",
    acf: "AAPL.OQ",
    ric: "AAPL.OQ",
    ticker: "AAPL",
    symbol: "AAPL",
    createdAt: "2024-01-15T08:30:00Z",
    updatedAt: "2025-03-17T14:22:00Z",
    countryId: "US",
    country: "United States",
    micCode: "XNAS",
    currencyId: "USD",
    currency: "US Dollar",
    description: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
  },
  {
    id: "2",
    assetName: "TotalEnergies SE",
    isin: "FR0000120271",
    sector: "Energy",
    acf: "TOTF.PA",
    ric: "TOTF.PA",
    ticker: "TTE",
    symbol: "TTE",
    createdAt: "2024-02-10T09:00:00Z",
    updatedAt: "2025-03-16T16:45:00Z",
    countryId: "FR",
    country: "France",
    micCode: "XPAR",
    currencyId: "EUR",
    currency: "Euro",
    description: "TotalEnergies SE is a multi-energy company producing and marketing fuels, natural gas, and electricity.",
  },
  {
    id: "3",
    assetName: "Samsung Electronics Co Ltd",
    isin: "KR7005930003",
    sector: "Technology",
    acf: "005930.KS",
    ric: "005930.KS",
    ticker: "005930",
    symbol: "SSNLF",
    createdAt: "2024-03-05T07:15:00Z",
    updatedAt: "2025-03-15T10:30:00Z",
    countryId: "KR",
    country: "South Korea",
    micCode: "XKRX",
    currencyId: "KRW",
    currency: "Korean Won",
    description: "Samsung Electronics manufactures consumer electronics, IT & mobile communications, and device solutions.",
  },
  {
    id: "4",
    assetName: "LVMH Moët Hennessy",
    isin: "FR0000121014",
    sector: "Consumer Discretionary",
    acf: "LVMH.PA",
    ric: "LVMH.PA",
    ticker: "MC",
    symbol: "LVMHF",
    createdAt: "2024-01-20T10:00:00Z",
    updatedAt: "2025-03-17T11:00:00Z",
    countryId: "FR",
    country: "France",
    micCode: "XPAR",
    currencyId: "EUR",
    currency: "Euro",
    description: "LVMH Moët Hennessy Louis Vuitton SE engages in fashion, leather goods, wines, spirits, perfumes, cosmetics, watches, and jewelry.",
  },
  {
    id: "5",
    assetName: "Nestlé SA",
    isin: "CH0038863350",
    sector: "Consumer Staples",
    acf: "NESN.SW",
    ric: "NESN.SW",
    ticker: "NESN",
    symbol: "NSRGY",
    createdAt: "2024-04-12T06:30:00Z",
    updatedAt: "2025-03-14T09:15:00Z",
    countryId: "CH",
    country: "Switzerland",
    micCode: "XSWX",
    currencyId: "CHF",
    currency: "Swiss Franc",
    description: "Nestlé SA operates as a food and beverage company worldwide.",
  },
];
