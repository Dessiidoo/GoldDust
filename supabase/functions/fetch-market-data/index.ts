import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AssetRow {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
}

interface YahooQuote {
  symbol: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  marketCap?: number;
  regularMarketTime?: number;
}

async function updateSourceStatus(
  supabase: ReturnType<typeof createClient>,
  sourceName: string,
  isLive: boolean,
  assetsReturned: number,
  errorMessage: string | null
) {
  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("data_source_status")
    .select("id")
    .eq("source_name", sourceName)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    source_name: sourceName,
    is_live: isLive,
    last_contacted: now,
    assets_returned: assetsReturned,
    error_message: errorMessage,
    updated_at: now,
  };
  if (isLive) payload.last_success = now;

  if (existing) {
    await supabase.from("data_source_status").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("data_source_status").insert(payload);
  }
}

async function fetchYahooQuotes(symbols: string[]): Promise<{ quotes: Map<string, YahooQuote>; success: boolean; error: string | null }> {
  const results = new Map<string, YahooQuote>();
  if (symbols.length === 0) return { quotes: results, success: true, error: null };

  const query = symbols.join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GoldDust/1.0)",
      },
    });

    if (!resp.ok) {
      return { quotes: results, success: false, error: `Yahoo Finance API returned ${resp.status}` };
    }

    const data = await resp.json();
    if (data.quoteResponse && data.quoteResponse.result) {
      for (const quote of data.quoteResponse.result as YahooQuote[]) {
        if (quote.regularMarketPrice != null) {
          results.set(quote.symbol, quote);
        }
      }
    }

    return { quotes: results, success: results.size > 0, error: results.size === 0 ? "No quotes returned" : null };
  } catch (err) {
    return { quotes: results, success: false, error: String(err) };
  }
}

interface CoinGeckoResponse {
  id: string;
  symbol: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
}

async function fetchCoinGeckoPrices(cryptoIds: Map<string, { assetId: string; symbol: string }>): Promise<{
  quotes: Map<string, { price: number; volume: number; changePct: number; high: number; low: number; marketCap: number; lastUpdated: string }>;
  success: boolean;
  error: string | null;
}> {
  const results = new Map<string, { price: number; volume: number; changePct: number; high: number; low: number; marketCap: number; lastUpdated: string }>();
  if (cryptoIds.size === 0) return { quotes: results, success: true, error: null };

  const ids = Array.from(cryptoIds.keys()).join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(ids)}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;

  try {
    const resp = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!resp.ok) {
      return { quotes: results, success: false, error: `CoinGecko API returned ${resp.status}` };
    }

    const data = await resp.json() as CoinGeckoResponse[];
    for (const coin of data) {
      const mapping = cryptoIds.get(coin.id);
      if (mapping && coin.current_price != null) {
        results.set(mapping.symbol, {
          price: coin.current_price,
          volume: coin.total_volume ?? 0,
          changePct: coin.price_change_percentage_24h ?? 0,
          high: coin.high_24h ?? 0,
          low: coin.low_24h ?? 0,
          marketCap: coin.market_cap ?? 0,
          lastUpdated: coin.last_updated,
        });
      }
    }

    return { quotes: results, success: results.size > 0, error: results.size === 0 ? "No prices returned" : null };
  } catch (err) {
    return { quotes: results, success: false, error: String(err) };
  }
}

const COINGECKO_ID_MAP: Record<string, string> = {
  "BTC-USD": "bitcoin",
  "ETH-USD": "ethereum",
  "SOL-USD": "solana",
  "XRP-USD": "ripple",
  "ADA-USD": "cardano",
  "DOGE-USD": "dogecoin",
  "AVAX-USD": "avalanche-2",
  "DOT-USD": "polkadot",
  "MATIC-USD": "matic-network",
  "LINK-USD": "chainlink",
  "LTC-USD": "litecoin",
  "BNB-USD": "binancecoin",
  "UNI-USD": "uniswap",
  "ATOM-USD": "cosmos",
  "TRX-USD": "tron",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: assets, error: assetError } = await supabase
      .from("assets")
      .select("id, symbol, name, asset_type")
      .eq("is_active", true);

    if (assetError) throw assetError;
    if (!assets || assets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active assets to fetch", snapshots: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cryptoAssets = (assets as AssetRow[]).filter((a) => a.asset_type === "crypto");
    const stockAssets = (assets as AssetRow[]).filter((a) => a.asset_type !== "crypto");

    const snapshots: Array<{
      asset_id: string;
      price: number;
      volume: number | null;
      change_pct: number | null;
      high_24h: number | null;
      low_24h: number | null;
      open_24h: number | null;
      market_cap: number | null;
    }> = [];

    let stockCount = 0;
    let cryptoCount = 0;

    // --- Fetch stock/ETF prices from Yahoo Finance ---
    if (stockAssets.length > 0) {
      const stockSymbols = stockAssets.map((a) => a.symbol);
      const { quotes: stockQuotes, success, error: yahooError } = await fetchYahooQuotes(stockSymbols);

      await updateSourceStatus(supabase, "yahoo_finance", success, stockQuotes.size, success ? null : yahooError);

      for (const asset of stockAssets) {
        const quote = stockQuotes.get(asset.symbol);
        if (!quote || quote.regularMarketPrice == null) {
          console.warn(`No Yahoo quote for ${asset.symbol}`);
          continue;
        }

        snapshots.push({
          asset_id: asset.id,
          price: quote.regularMarketPrice,
          volume: quote.regularMarketVolume ?? null,
          change_pct: quote.regularMarketChangePercent ?? null,
          high_24h: quote.regularMarketDayHigh ?? null,
          low_24h: quote.regularMarketDayLow ?? null,
          open_24h: quote.regularMarketOpen ?? null,
          market_cap: quote.marketCap ?? null,
        });
        stockCount++;
      }
    }

    // --- Fetch crypto prices from CoinGecko ---
    if (cryptoAssets.length > 0) {
      const coingeckoIds = new Map<string, { assetId: string; symbol: string }>();
      const unmappedCrypto: AssetRow[] = [];

      for (const asset of cryptoAssets) {
        const geckoId = COINGECKO_ID_MAP[asset.symbol];
        if (geckoId) {
          coingeckoIds.set(geckoId, { assetId: asset.id, symbol: asset.symbol });
        } else {
          unmappedCrypto.push(asset);
        }
      }

      const { quotes: cryptoQuotes, success, error: geckoError } = await fetchCoinGeckoPrices(coingeckoIds);

      await updateSourceStatus(supabase, "coingecko", success, cryptoQuotes.size, success ? null : geckoError);

      for (const asset of cryptoAssets) {
        const cryptoData = cryptoQuotes.get(asset.symbol);
        if (!cryptoData) {
          console.warn(`No CoinGecko price for ${asset.symbol}`);
          continue;
        }

        snapshots.push({
          asset_id: asset.id,
          price: cryptoData.price,
          volume: cryptoData.volume || null,
          change_pct: cryptoData.changePct,
          high_24h: cryptoData.high || null,
          low_24h: cryptoData.low || null,
          open_24h: null,
          market_cap: cryptoData.marketCap || null,
        });
        cryptoCount++;
      }

      // Fall back to Yahoo Finance for unmapped crypto symbols
      if (unmappedCrypto.length > 0) {
        const yahooCryptoSymbols = unmappedCrypto.map((a) => a.symbol);
        const { quotes: yahooCryptoQuotes, success: yahooCryptoSuccess, error: yahooCryptoError } = await fetchYahooQuotes(yahooCryptoSymbols);

        for (const asset of unmappedCrypto) {
          const quote = yahooCryptoQuotes.get(asset.symbol);
          if (quote && quote.regularMarketPrice != null) {
            snapshots.push({
              asset_id: asset.id,
              price: quote.regularMarketPrice,
              volume: quote.regularMarketVolume ?? null,
              change_pct: quote.regularMarketChangePercent ?? null,
              high_24h: quote.regularMarketDayHigh ?? null,
              low_24h: quote.regularMarketDayLow ?? null,
              open_24h: quote.regularMarketOpen ?? null,
              market_cap: quote.marketCap ?? null,
            });
            cryptoCount++;
          }
        }
      }
    }

    if (snapshots.length > 0) {
      const { error: insertError } = await supabase
        .from("price_snapshots")
        .insert(snapshots);

      if (insertError) {
        console.error("Failed to insert snapshots:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Fetched ${snapshots.length} real price snapshots (${stockCount} from Yahoo Finance, ${cryptoCount} from CoinGecko)`,
        snapshots: snapshots.length,
        stock_count: stockCount,
        crypto_count: cryptoCount,
        sources: {
          yahoo_finance: stockCount,
          coingecko: cryptoCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-market-data error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
