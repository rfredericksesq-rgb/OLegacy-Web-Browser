import React, { useState, useEffect } from 'react';
import { Terminal, Code, Info, Shield, Server, FileCode, Search, Copy, Check, HardDrive } from 'lucide-react';

interface DevToolsProps {
  url: string;
  onClose: () => void;
}

type DevTab = 'elements' | 'headers' | 'console' | 'storage';

interface SourceData {
  url: string;
  status: number;
  headers: Record<string, string>;
  html: string;
}

export default function DevTools({ url, onClose }: DevToolsProps) {
  const [activeTab, setActiveTab] = useState<DevTab>('elements');
  const [sourceData, setSourceData] = useState<SourceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlFilter, setHtmlFilter] = useState('');
  const [copied, setCopied] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'info' | 'warn' | 'error' | 'success'; text: string; time: string }[]>([]);

  // Fetch live source data on URL changes
  useEffect(() => {
    if (!url || url.startsWith('browser://')) {
      setSourceData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Generate simulated console logs for the tab load
    const now = () => new Date().toLocaleTimeString([], { hour12: false });
    const initialLogs = [
      { type: 'info' as const, text: `GET ${url} [Pending]`, time: now() },
      { type: 'success' as const, text: `Connecting through Web Browser Proxy node`, time: now() },
      { type: 'info' as const, text: `User-Agent: Mozilla/5.0 WebBrowserSimulator/1.0`, time: now() }
    ];
    setConsoleLogs(initialLogs);

    fetch(`/api/source?url=${encodeURIComponent(url)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return res.json();
      })
      .then((data: SourceData) => {
        setSourceData(data);
        setConsoleLogs(prev => [
          ...prev,
          { type: 'success' as const, text: `HTTP ${data.status} OK - Resource fetched successfully`, time: now() },
          { type: 'info' as const, text: `Detected content type: ${data.headers['content-type'] || 'text/html'}`, time: now() },
          { type: 'info' as const, text: `Injected navigation listener & <base href="${data.url}">`, time: now() }
        ]);
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to fetch page source.');
        setConsoleLogs(prev => [
          ...prev,
          { type: 'error' as const, text: `Failed to load source: ${err.message || 'Unknown network error'}`, time: now() }
        ]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [url]);

  const copyToClipboard = () => {
    if (!sourceData) return;
    navigator.clipboard.writeText(sourceData.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredHtml = () => {
    if (!sourceData) return '';
    if (!htmlFilter) return sourceData.html;
    
    // Quick filtering by lines
    const lines = sourceData.html.split('\n');
    return lines
      .filter(line => line.toLowerCase().includes(htmlFilter.toLowerCase()))
      .join('\n');
  };

  return (
    <div id="devtools-panel" className="w-[450px] border-l border-slate-800 bg-slate-900 flex flex-col h-full text-slate-300 font-mono text-xs select-text">
      {/* DevTools Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-yellow-500" />
          <span className="font-semibold text-white tracking-wider uppercase text-[10px]">
            Developer Tools
          </span>
          <span className="text-[10px] text-slate-500 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 truncate max-w-[150px]">
            {url.startsWith('browser://') ? 'Internal page' : new URL(url).hostname}
          </span>
        </div>
        <button
          id="close-devtools"
          onClick={onClose}
          className="text-slate-500 hover:text-white px-2 py-0.5 rounded hover:bg-slate-850"
        >
          ✕
        </button>
      </div>

      {/* DevTools Tabs */}
      <div className="flex bg-slate-950 border-b border-slate-800 px-2 gap-1">
        {(['elements', 'headers', 'console', 'storage'] as DevTab[]).map(tab => (
          <button
            id={`devtools-tab-${tab}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 border-b-2 font-sans font-medium text-[11px] capitalize transition-all ${
              activeTab === tab 
                ? 'border-blue-500 text-white bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* DevTools Body */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950/40">
        {url.startsWith('browser://') ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Shield size={24} className="mb-2 text-blue-500/50" />
            <p className="font-sans">DevTools are only available for live proxy URLs.</p>
            <p className="font-sans text-[10px] mt-1">This is an internal browser settings page.</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mb-3" />
            <span className="animate-pulse">Loading inspection tree...</span>
          </div>
        ) : error ? (
          <div className="flex-1 p-4 text-red-400 overflow-y-auto">
            <p className="font-semibold mb-2">Error connecting debugger:</p>
            <pre className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-[11px] break-all white-space-pre-wrap">
              {error}
            </pre>
            <p className="font-sans text-xs text-slate-500 mt-3">
              The target website might have blocked our proxy scrape, or contains frame restrictions preventing detailed tree-analysis.
            </p>
          </div>
        ) : (
          <>
            {/* ELEMENTS TAB */}
            {activeTab === 'elements' && sourceData && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1">
                    <Search size={12} className="text-slate-500" />
                    <input
                      id="devtools-elements-search"
                      type="text"
                      placeholder="Filter lines (e.g. <div, class=)..."
                      value={htmlFilter}
                      onChange={(e) => setHtmlFilter(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-full text-[11px]"
                    />
                  </div>
                  <button
                    id="devtools-elements-copy"
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white rounded px-2.5 py-1 text-[10px] transition-colors font-sans"
                    title="Copy full HTML source"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex-1 p-3 overflow-auto whitespace-pre font-mono text-[11px] text-emerald-400 bg-slate-950">
                  {filteredHtml() || 'No matched elements found.'}
                </div>
              </div>
            )}

            {/* HEADERS TAB */}
            {activeTab === 'headers' && sourceData && (
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div>
                  <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Info size={12} className="text-blue-400" /> General Info
                  </h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div><span className="text-slate-500">Request URL:</span> <span className="text-white select-all break-all">{url}</span></div>
                    <div><span className="text-slate-500">Request Method:</span> <span className="text-yellow-500">GET</span></div>
                    <div><span className="text-slate-500">Status Code:</span> <span className={sourceData.status >= 400 ? "text-red-400 font-semibold" : "text-green-400 font-semibold"}>{sourceData.status} {sourceData.status === 200 ? 'OK' : ''}</span></div>
                    <div><span className="text-slate-500">Remote Address:</span> <span className="text-slate-300">Proxy Gateway (Edge Node)</span></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Server size={12} className="text-purple-400" /> Response Headers
                  </h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 divide-y divide-slate-800/50">
                    {Object.entries(sourceData.headers).map(([key, value]) => (
                      <div key={key} className="py-1.5 flex flex-col sm:flex-row sm:items-start gap-1 justify-between">
                        <span className="text-slate-400 font-medium select-all">{key}:</span>
                        <span className="text-white select-all break-all text-right">{value}</span>
                      </div>
                    ))}
                    {Object.keys(sourceData.headers).length === 0 && (
                      <div className="text-slate-500 py-1 text-center">No headers returned.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONSOLE TAB */}
            {activeTab === 'console' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                <div className="flex-1 p-3 overflow-y-auto space-y-2 select-text">
                  {consoleLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-[11px] leading-relaxed">
                      <span className="text-slate-600 shrink-0">{log.time}</span>
                      <span className={`break-all ${
                        log.type === 'error' ? 'text-red-400 bg-red-950/20 px-1 rounded' :
                        log.type === 'warn' ? 'text-yellow-400 bg-yellow-950/20 px-1 rounded' :
                        log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'
                      }`}>
                        {log.type === 'error' ? '🚫 [Error] ' :
                         log.type === 'warn' ? '⚠️ [Warn] ' :
                         log.type === 'success' ? '✅ [System] ' : 'ℹ️ [Info] '}
                        {log.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STORAGE TAB */}
            {activeTab === 'storage' && (
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div>
                  <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <HardDrive size={12} className="text-blue-400" /> Simulated Cookies
                  </h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
                    <table className="w-full text-[11px] text-left">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800 pb-1">
                          <th className="font-medium pb-1.5">Name</th>
                          <th className="font-medium pb-1.5">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/30">
                        <tr>
                          <td className="py-2 text-white font-medium">_ga</td>
                          <td className="py-2 text-slate-400 select-all break-all">GA1.1.2014819.17180</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-white font-medium">browser_session</td>
                          <td className="py-2 text-slate-400 select-all break-all">6bc8ae3d9fe2406ea9</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-white font-medium">visitor_id</td>
                          <td className="py-2 text-slate-400 select-all break-all">f1a26b2b-426b-4e89</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileCode size={12} className="text-emerald-400" /> Local Storage State
                  </h3>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
                    <div>
                      <span className="text-slate-500">search_engine_default:</span>{' '}
                      <span className="text-emerald-400">"duckduckgo"</span>
                    </div>
                    <div>
                      <span className="text-slate-500">history_length:</span>{' '}
                      <span className="text-blue-400">
                        {localStorage.getItem('browser_history') 
                          ? JSON.parse(localStorage.getItem('browser_history')!).length 
                          : 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">bookmarks_saved:</span>{' '}
                      <span className="text-blue-400">
                        {localStorage.getItem('browser_bookmarks') 
                          ? JSON.parse(localStorage.getItem('browser_bookmarks')!).length 
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
