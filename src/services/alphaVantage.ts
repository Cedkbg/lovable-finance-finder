import axios from "axios";
import { getApiErrorMessage } from "@/lib/error-utils";
// import type { LivePrice } from "@/hooks/useLivePrice";

const API_KEY = "demo"; // Clé démo AlphaVantage (limite 5 req/min)


export const getLivePrice = async (symbol: string) => {
  try {
    const response = await axios.get(
      `https://www.alphavantage.co/query`,
      {
        params: {
          function: "GLOBAL_QUOTE",
          symbol,
          apikey: API_KEY,
        },
      }
    );

    const quote = response.data["Global Quote"];
    if (!quote) {
      throw new Error("No quote data");
    }

    const priceStr = quote["05. price"];
    const changeStr = quote["09. change"];
    const changePctStr = quote["10. change percent"];

    const price = parseFloat(priceStr);
    const change = parseFloat(changeStr.replace(/[^\d.-]/g, ""));
    const changePercent = parseFloat(changePctStr.replace(/[^\d.-]/g, ""));

    return {
      price,
      change,
      changePercent,
      timestamp: Date.now(),
    };
  } catch (error) {
    const msg = getApiErrorMessage(error, "AlphaVantage");
    console.error(msg);
    return null;
  }
};
