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
  FIN: "Finance",
  TECH: "Technology",
  "INFO TECH": "Information Technology",
  HC: "Healthcare",
  PHARMA: "Pharmaceuticals",
  "OIL & GAS": "Oil and Gas",
  "OIL AND GAS": "Oil and Gas",
  "FIXED INCOME": "Fixed Income",
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

    const maybeIsoFromCountry = EXCHANGE_TO_ISO[token] || (token.length === 2 ? token : "");
    if (maybeIsoFromCountry) {
      const label = regionNames.of(maybeIsoFromCountry);
      if (label) {
        return label;
      }
    }

    if (token.length > 2) {
      return toLabelCase(rawCountry);
    }
  }

  if (rawCountryId) {
    const iso = EXCHANGE_TO_ISO[rawCountryId] || rawCountryId;
    const label = regionNames.of(iso);
    if (label) {
      return label;
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
