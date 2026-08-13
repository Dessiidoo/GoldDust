import { Flame, RefreshCw, Brain, Wifi, WifiOff, Globe, MessageCircle, Eye } from 'lucide-react';
import type { Asset, TrendSignal, TrendSourceStatus } from './lib/types';

export default function TrendsView({
  trendSignals,
  trendSources,
  assets,
  onFetchTrends,
  onAnalyze,
  actionLoading,
}: {
  trendSignals: TrendSignal[];
  trendSources: TrendSourceStatus[];
  assets: Asset[];
  onFetchTrends: () => void;
  onAnalyze: () => void;
  actionLoading: boolean;
}) {
  const matched = trendSignals.filter((s) => s.matched_asset_id);
  const bullish = trendSignals.filter((s) => s.sentiment === 'bullish').length;
  const bearish = trendSignals.filter((s) => s.sentiment === 'bearish').length;

  const sourceIcon = (source: string) => {
    if (source === 'reddit') return MessageCircle;
    if (source === 'wikipedia') return Eye;
    return Globe;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Trends & Social Intelligence
          </h2>
          <p className="text-sm text-slate-400">Alternative market signals from search, social, crypto trends, and attention data</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onFetchTrends}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
            Fetch Trends
          </button>
          <button
            onClick={onAnalyze}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white disabled:opacity-50"
          >
            <Brain className="w-4 h-4" />
            Analyze Signals
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-500 uppercase">Trend Signals</div><div className="text-xl font-bold text-white mt-1">{trendSignals.length}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-500 uppercase">Matched Assets</div><div className="text-xl font-bold text-white mt-1">{matched.length}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-500 uppercase">Bullish</div><div className="text-xl font-bold text-emerald-400 mt-1">{bullish}</div></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"><div className="text-xs text-slate-500 uppercase">Bearish</div><div className="text-xl font-bold text-red-400 mt-1">{bearish}</div></div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Data Sources</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {trendSources.length === 0 ? (
            <p className="text-sm text-slate-500">No trend source status recorded yet. Fetch trends to initialize them.</p>
          ) : trendSources.map((src) => {
            const Icon = sourceIcon(src.source_name);
            return (
              <div key={src.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                <div className="flex items-center gap-2">
                  {src.is_live ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{src.source_name.replace(/_/g, ' ')}</span>
                </div>
                <span className={`text-xs ${src.is_live ? 'text-emerald-400' : 'text-red-400'}`}>
                  {src.is_live ? `${src.signals_returned} signals` : 'offline'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-white">Recent Trend Signals</h3>
        </div>
        {trendSignals.length === 0 ? (
          <div className="p-10 text-center">
            <Flame className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400">No trend signals yet</p>
            <p className="text-sm text-slate-500 mt-1">Tap Fetch Trends to collect fresh alternative data.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {trendSignals.slice(0, 100).map((signal) => {
              const asset = assets.find((a) => a.id === signal.matched_asset_id);
              const Icon = sourceIcon(signal.source);
              return (
                <div key={signal.id} className="p-4 hover:bg-slate-800/30">
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs uppercase text-slate-500">{signal.source.replace(/_/g, ' ')}</span>
                        {asset && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">{asset.symbol}</span>}
                        {signal.sentiment && <span className={`text-xs px-2 py-0.5 rounded ${signal.sentiment === 'bullish' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{signal.sentiment}</span>}
                      </div>
                      <p className="text-sm text-slate-200 mt-1">{signal.title}</p>
                      {signal.body && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{signal.body}</p>}
                    </div>
                    {signal.score != null && <span className="text-xs text-slate-500">{signal.score.toLocaleString()}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
