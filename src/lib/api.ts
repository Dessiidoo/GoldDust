import type { Asset, Portfolio, Holding, Signal, Trade, AlertSettings, AlertHistoryItem, PriceSnapshot, DataSourceStatus, TrendSignal, TrendSourceStatus } from './types';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  if (!resp.ok) throw new Error(`GoldDust API failed (${resp.status}): ${await resp.text()}`);
  return resp.json();
}

export async function fetchMarketData(): Promise<{ snapshots: number; message: string }> { return api('/api/market-data', { method: 'POST' }); }
export async function analyzeMarket(assetId?: string): Promise<{ signals: number; message: string }> { return api('/api/analyze-market', { method: 'POST', body: JSON.stringify(assetId ? { asset_id: assetId } : {}) }); }
export async function runSimulation(dryRun: boolean = false): Promise<any> { return api('/api/run-simulation', { method: 'POST', body: JSON.stringify({ dry_run: dryRun }) }); }
export async function sendAlerts(): Promise<{ sent: number; message: string }> { return api('/api/send-alerts', { method: 'POST' }); }
export async function getAssets(): Promise<Asset[]> { return api('/api/assets'); }
export async function addAsset(symbol: string, name: string, assetType: string, sector?: string): Promise<Asset> { return api('/api/assets', { method: 'POST', body: JSON.stringify({ symbol: symbol.toUpperCase(), name, asset_type: assetType, sector }) }); }
export async function removeAsset(id: string): Promise<void> { await api(`/api/assets/${id}`, { method: 'DELETE' }); }
export async function getPortfolio(): Promise<Portfolio | null> { return api('/api/portfolio'); }
export async function updatePortfolioStartingBalance(balance: number): Promise<void> { await api('/api/portfolio', { method: 'PUT', body: JSON.stringify({ starting_balance: balance }) }); }
export async function getHoldings(): Promise<Holding[]> { return api('/api/holdings'); }
export async function getLatestPrices(assetIds: string[]): Promise<Map<string, PriceSnapshot>> { const rows: PriceSnapshot[] = await api('/api/prices/latest?asset_ids=' + encodeURIComponent(assetIds.join(','))); return new Map(rows.map(row => [row.asset_id, row])); }
export async function getLatestSignals(assetIds: string[]): Promise<Map<string, Signal>> { const rows: Signal[] = await api('/api/signals/latest?asset_ids=' + encodeURIComponent(assetIds.join(','))); return new Map(rows.map(row => [row.asset_id, row])); }
export async function getRecentSignals(limit: number = 20): Promise<Signal[]> { return api(`/api/signals?limit=${limit}`); }
export async function getRecentTrades(limit: number = 30): Promise<Trade[]> { return api(`/api/trades?limit=${limit}`); }
export async function getAlertSettings(): Promise<AlertSettings | null> { return api('/api/alerts/settings'); }
export async function updateAlertSettings(settings: Partial<AlertSettings>): Promise<void> { await api('/api/alerts/settings', { method: 'PUT', body: JSON.stringify(settings) }); }
export async function getAlertHistory(limit: number = 20): Promise<AlertHistoryItem[]> { return api(`/api/alerts/history?limit=${limit}`); }
export async function getPriceHistory(assetId: string, limit: number = 50): Promise<PriceSnapshot[]> { return api(`/api/prices/history/${assetId}?limit=${limit}`); }
export async function getDataSourceStatus(): Promise<DataSourceStatus[]> { return api('/api/data-sources'); }
export async function fetchTrendData(): Promise<{ signals: number; message: string }> { return api('/api/trends/fetch', { method: 'POST' }); }
export async function getTrendSignals(limit: number = 100): Promise<TrendSignal[]> { return api(`/api/trends?limit=${limit}`); }
export async function getTrendSourceStatus(): Promise<TrendSourceStatus[]> { return api('/api/trends/sources'); }
