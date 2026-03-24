import axios from "axios";

const API_KEY = import.meta.env.VITE_EODHD_API_KEY || "demo";

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export const fetchStockPrice = async (symbol: string): Promise<PriceData> => {
  if (!API_KEY || API_KEY === "demo") {
    console.warn("Utilisez une vraie clé EODHD API dans .env");
    throw new Error("Clé API manquante");
  }

  try {
    const res = await axios.get(
      `https://eodhd.com/api/real-time/${symbol}.json?api_token=${API_KEY}&fmt=json`
    );
    const data = res.data as any;
    if (!data || typeof data !== 'object') {
      throw new Error(`Données invalides pour ${symbol}`);
    }
    return {
      price: parseFloat(data.close || data.price || '0') || 0,
      change: parseFloat(data.change || '0') || 0,
      changePercent: parseFloat(data.change_percent || '0') || 0,
      timestamp: data.timestamp || Date.now(),
    };
  } catch (error) {
    console.error(`Erreur fetch ${symbol}:`, error);
    throw error;
  }
};

