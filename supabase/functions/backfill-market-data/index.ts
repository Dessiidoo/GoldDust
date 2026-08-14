import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Asset = { id: string; symbol: string; name: string; asset_type: string };

const COINGECKO_IDS: Record<string, string> = {
  "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana",
  "XRP-USD": "ripple", "ADA-USD": "cardano", "DOGE-USD": "dogecoin",
  "AVAX-USD": "avalanche-2", "DOT-USD": "polkadot", "MATIC-USD": "matic-network",
  "LINK-USD": "chainlink", "LTC-USD": "litecoin", "BNB-USD": "binancecoin",
  "UNI-USD": "uniswap", "ATOM-USD": "cosmos", "TRX-USD": "tron",
};

function daysAgo(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function backfillCrypto(supabase: ReturnType<typeof createClient>, assets: Asset[]) {
  let inserted = 0;
  for (const asset of assets) {
    const id = COINGECKO_IDS[asset.symbol];
    if (!id) continue;

    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=90&interval=daily`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`CoinGecko ${asset.symbol}: HTTP ${resp.status}`);
    const data = await resp.json();
    const prices: Array<[number, number]> = data.prices ?? [];
    const volumes: Array<[number, number]> = data.total_volumes ?? [];
    const volumeMap = new Map(volumes.map(([ts, value]) => [ts, value]));

    const rows = prices.map(([ts, price]) => ({
      asset_id: asset.id,
      price,
      volume: volumeMap.get(ts) ?? null,
      change_pct: null,
      high_24h: null,
      low_24h: null,
      open_24h: null,
      market_cap: null,
      recorded_at: new Date(ts).toISOString(),
    }));

    if (rows.length) {
      const { error } = await supabase.from("price_snapshots").upsert(rows, { onConflict: "asset_id,recorded_at" });
      if (error) throw error;
      inserted += rows.length;
    }
  }
  return inserted;
}

async function backfillStocks(supabase: ReturnType<typeof createClient>, assets: Asset[]) {
  const key = Deno.env.get("POLYGON_API_KEY");
  if (!key || assets.length === 0) return { inserted: 0, configured: false };

  let inserted = 0;
  const from = daysAgo(90);
  const to = daysAgo(0);

  for (const asset of assets) {
    const ticker = encodeURIComponent(asset.symbol.replace(/-USD$/, ""));
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Polygon ${asset.symbol}: HTTP ${resp.status}`);
    const data = await resp.json();
    const results = data.results ?? [];
    const rows = results.map((r: any) => ({
      asset_id: asset.id,
      price: Number(r.c),
      volume: r.v == null ? null : Number(r.v),
      change_pct: null,
      high_24h: r.h == null ? null : Number(r.h),
      low_24h: r.l == null ? null : Number(r.l),
      open_24h: r.o == null ? null : Number(r.o),
      market_cap: null,
      recorded_at: new Date(Number(r.t)).toISOString(),
    })).filter((r: any) => Number.isFinite(r.price));

    if (rows.length) {
      const { error } = await supabase.from("price_snapshots").upsert(rows, { onConflict: "asset_id,recorded_at" });
      if (error) throw error;
      inserted += rows.length;
    }
  }
  return { inserted, configured: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: assets, error } = await supabase.from("assets").select("id,symbol,name,asset_type").eq("is_active", true);
    if (error) throw error;

    const all = (assets ?? []) as Asset[];
    const crypto = all.filter(a => a.asset_type === "crypto");
    const stocks = all.filter(a => a.asset_type !== "crypto");

    const cryptoInserted = await backfillCrypto(supabase, crypto);
    const stockResult = await backfillStocks(supabase, stocks);

    return new Response(JSON.stringify({
      success: true,
      message: `Backfilled ${cryptoInserted + stockResult.inserted} historical price observations`,
      crypto_observations: cryptoInserted,
      stock_observations: stockResult.inserted,
      polygon_configured: stockResult.configured,
      history_days: 90,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("backfill-market-data error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
