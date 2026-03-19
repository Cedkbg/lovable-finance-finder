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
  AJ: "ZA",
  XA: "ZA",
  XH: "ZA",
  LONDON: "GB",
  CME: "US",
};

const COUNTRY_ALIASES: Record<string, string> = {
  USA: "United States",
  "UNITED STATES OF AMERICA": "United States",
  "ETATS UNIS": "United States",
  "ÉTATS UNIS": "United States",
  UK: "United Kingdom",
  "ROYAUME UNI": "United Kingdom",
  "ANGLETERRE": "United Kingdom",
  "SOUTH KOREA": "South Korea",
  "COREE DU SUD": "South Korea",
  "CORÉE DU SUD": "South Korea",
  UAE: "United Arab Emirates",
  "EMIRATS ARABES UNIS": "United Arab Emirates",
  "ÉMIRATS ARABES UNIS": "United Arab Emirates",
};

const SECTOR_ALIASES: Record<string, string> = {
  EQTY: "Equity",
  EQUITIES: "Equity",
  "COMMON STOCK": "Equity",
  "PREF SHS": "Preferred Shares",
  ETF: "Exchange Traded Fund",
  ETP: "Exchange Traded Product",
  REIT: "Real Estate Investment Trust",
  ADR: "American Depositary Receipt",
  GDR: "Global Depositary Receipt",
  FX: "Foreign Exchange",
  CRYPTO: "Digital Assets",
  "DIGITAL ASSET": "Digital Assets",
  CRYPTOCURRENCY: "Digital Assets",
  BITCOIN: "Digital Assets",
  FIN: "Finance",
  FINANCIAL: "Finance",
  "FINANCIAL SERVICES": "Finance",
  BANK: "Banking",
  BANKING: "Banking",
  "COMMERCIAL BANK": "Banking",
  "INVESTMENT BANK": "Banking",
  TECH: "Technology",
  "INFO TECH": "Information Technology",
  HC: "Healthcare",
  PHARMA: "Pharmaceuticals",
  BIOTECH: "Biotechnology",
  "OIL & GAS": "Oil and Gas",
  "OIL AND GAS": "Oil and Gas",
  ENERGY: "Energy",
  "RENEWABLE ENERGY": "Renewable Energy",
  MINING: "Mining",
  METALS: "Metals",
  "PRECIOUS METALS": "Metals",
  GOLD: "Metals",
  "FIXED INCOME": "Fixed Income",
  BOND: "Fixed Income",
  BONDS: "Fixed Income",
  CURNCY: "Currency",
  CURRENCY: "Currency",
  DEVISE: "Currency",
  "M MKT": "Money Market",
  CORP: "Corporate Debt",
  "EURO CP": "Commercial Paper",
  "EURO MTN": "Medium-Term Note",
  INSURANCE: "Insurance",
  ASSURANCE: "Insurance",
  COMMODITY: "Commodity",
  COMMODITIES: "Commodity",
  "REAL ESTATE": "Real Estate",
  IMMOBILIER: "Real Estate",
  TELECOM: "Telecommunications",
  TELECOMMUNICATIONS: "Telecommunications",
  RETAIL: "Retail",
  "CONSUMER GOODS": "Consumer Goods",
  AGRICULTURE: "Agriculture",
  AGRI: "Agriculture",
  TRANSPORT: "Transportation",
  LOGISTICS: "Logistics",
  AEROSPACE: "Aerospace and Defense",
  DEFENSE: "Aerospace and Defense",
  MEDIA: "Media",
  ENTERTAINMENT: "Entertainment",
  SOFTWARE: "Software",
  SEMICONDUCTOR: "Semiconductors",
  SEMICONDUCTORS: "Semiconductors",
  CONSTRUCTION: "Construction",
  CHEMICALS: "Chemicals",
  "PRIVATE EQUITY": "Private Equity",
  "VENTURE CAPITAL": "Venture Capital",
  DERIVATIVES: "Derivatives",
  OPTIONS: "Options",
  FUTURES: "Futures",
  WARRANTS: "Warrants",
  "MUTUAL FUND": "Mutual Fund",
  "HEDGE FUND": "Hedge Fund",
  INDEX: "Index",
  INDICE: "Index",
};

export const SECTOR_TAXONOMY = [
  "Equity",
  "Fixed Income",
  "Commodity",
  "Currency",
  "Index",
  "Finance",
  "Banking",
  "Insurance",
  "Asset Management",
  "Technology",
  "Information Technology",
  "Software",
  "Hardware",
  "Semiconductors",
  "Healthcare",
  "Pharmaceuticals",
  "Biotechnology",
  "Medical Devices",
  "Energy",
  "Oil and Gas",
  "Renewable Energy",
  "Utilities",
  "Real Estate",
  "Real Estate Investment Trust",
  "Construction",
  "Consumer Goods",
  "Retail",
  "E-Commerce",
  "Food and Beverage",
  "Luxury",
  "Industrials",
  "Manufacturing",
  "Aerospace and Defense",
  "Transportation",
  "Telecommunications",
  "Media",
  "Entertainment",
  "Materials",
  "Chemicals",
  "Mining",
  "Metals",
  "Agriculture",
  "Forestry",
  "Fishing",
  "Import and Export",
  "Trade",
  "Logistics",
  "Supply Chain",
  "Government",
  "Municipal",
  "Sovereign",
  "Exchange Traded Fund",
  "Exchange Traded Product",
  "Mutual Fund",
  "Hedge Fund",
  "Derivatives",
  "Options",
  "Futures",
  "Warrants",
  "Digital Assets",
  "Private Equity",
  "Venture Capital",
  "Other",
] as const;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const ISO_ALPHA2_REGEX = /^[A-Z]{2}$/;

const normalizeToken = (value: string) =>
  value
    .trim()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

const toLabelCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAnd\b/g, "and");

const safeRegionLabel = (regionCode: string): string | null => {
  const code = regionCode.trim().toUpperCase();
  if (!ISO_ALPHA2_REGEX.test(code)) return null;

  try {
    return regionNames.of(code) || null;
  } catch {
    return null;
  }
};

export function normalizeCountryLabel(
  country?: string | null,
  countryId?: string | null,
  _micCode?: string | null,
): string {
  const rawCountry = (country || "").trim();
  const rawCountryId = (countryId || "").trim().toUpperCase();

  if (rawCountry) {
    const token = normalizeToken(rawCountry);

    if (COUNTRY_ALIASES[token]) {
      return COUNTRY_ALIASES[token];
    }

    const maybeIsoFromCountry = EXCHANGE_TO_ISO[token] || (ISO_ALPHA2_REGEX.test(token) ? token : "");
    const labelFromCountry = maybeIsoFromCountry ? safeRegionLabel(maybeIsoFromCountry) : null;
    if (labelFromCountry) {
      return labelFromCountry;
    }

    if (token.length > 2) {
      return /^[A-Z0-9]{2,6}$/.test(token) ? rawCountry : toLabelCase(rawCountry);
    }
  }

  if (rawCountryId) {
    const iso = EXCHANGE_TO_ISO[rawCountryId] || rawCountryId;
    const labelFromCountryId = safeRegionLabel(iso);
    if (labelFromCountryId) {
      return labelFromCountryId;
    }

    if (rawCountryId.length > 2) {
      return rawCountryId;
    }
  }

  return rawCountry || rawCountryId || "Unknown";
}

export function normalizeSectorLabel(sector?: string | null): string {
  const rawSector = (sector || "").trim();
  if (!rawSector) {
    return "";
  }

  const token = normalizeToken(rawSector);

  if (SECTOR_ALIASES[token]) {
    return SECTOR_ALIASES[token];
  }

  return toLabelCase(rawSector);
}
