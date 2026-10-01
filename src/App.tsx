import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Home, 
  Lock, 
  Shield, 
  Star, 
  Code, 
  Clock, 
  Download, 
  Heart, 
  Plus, 
  X, 
  ExternalLink, 
  Trash2, 
  Globe, 
  FileText, 
  Check, 
  Search, 
  Sparkles,
  Info,
  Smartphone,
  Copy,
  CheckCheck,
  FileJson,
  Zap
} from 'lucide-react';
import { Tab, Bookmark, HistoryItem, DownloadItem, SearchEngine } from './types';
import { getUrlOrSearch, extractDomain, getFaviconUrl } from './utils';
import StartPage from './components/StartPage';
import DevTools from './components/DevTools';

const DEFAULT_SPEED_DIALS = [
  { title: 'Wikipedia', url: 'https://en.wikipedia.org' },
  { title: 'Legacy Open Book-club', url: 'http://bkcluby.atwebpages.com/' },
  { title: 'GitHub', url: 'https://github.com' },
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com' }
];

export default function App() {
  // Tabs State
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('browser_tabs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [{
      id: 'tab-initial',
      title: 'New Tab',
      url: 'browser://newtab',
      history: ['browser://newtab'],
      historyIndex: 0,
      loading: false
    }];
  });
  
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return tabs[0]?.id || 'tab-initial';
  });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // Address Bar Editing State
  const [addressInput, setAddressInput] = useState(activeTab?.url || '');

  // Reload trigger
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Settings & Drawers
  const [searchEngine, setSearchEngine] = useState<SearchEngine>(() => {
    return (localStorage.getItem('browser_default_search') as SearchEngine) || 'duckduckgo';
  });
  const [showDevTools, setShowDevTools] = useState(false);
  const [showSSLPopup, setShowSSLPopup] = useState(false);
  const [showDownloadsDrawer, setShowDownloadsDrawer] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Listen for native PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Persistent Collections
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('browser_bookmarks');
    return saved ? JSON.parse(saved) : [
      { id: 'b1', title: 'Wikipedia, the free encyclopedia', url: 'https://en.wikipedia.org', addedAt: Date.now() },
      { id: 'b2', title: 'Legacy Open Book-club', url: 'http://bkcluby.atwebpages.com/', addedAt: Date.now() - 3600000 }
    ];
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('browser_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    const saved = localStorage.getItem('browser_downloads');
    return saved ? JSON.parse(saved) : [];
  });

  // Filters
  const [historyFilter, setHistoryFilter] = useState('');
  const [bookmarkFilter, setBookmarkFilter] = useState('');

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('browser_tabs', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('browser_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('browser_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('browser_downloads', JSON.stringify(downloads));
  }, [downloads]);

  useEffect(() => {
    localStorage.setItem('browser_default_search', searchEngine);
  }, [searchEngine]);

  // Sync address input when active tab changes
  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url === 'browser://newtab' ? '' : activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  // Listen for navigation messages from the proxy iframe
  useEffect(() => {
    const handleProxyMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE') {
        const targetUrl = event.data.url;
        handleNavigate(targetUrl);
      } else if (event.data && event.data.type === 'RELOAD') {
        triggerReload();
      } else if (event.data && event.data.type === 'ALERT') {
        alert(`[Page Alert] ${event.data.message}`);
      }
    };

    window.addEventListener('message', handleProxyMessage);
    return () => window.removeEventListener('message', handleProxyMessage);
  }, [activeTabId, tabs]);

  // Navigation handlers
  const handleNavigate = (urlInput: string) => {
    if (!urlInput.trim()) return;
    
    const resolvedUrl = getUrlOrSearch(urlInput, searchEngine);
    
    // Update active tab state
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        const nextHistory = tab.history.slice(0, tab.historyIndex + 1);
        nextHistory.push(resolvedUrl);
        
        let title = extractDomain(resolvedUrl);
        if (resolvedUrl === 'browser://newtab') title = 'New Tab';
        else if (resolvedUrl === 'browser://history') title = 'History';
        else if (resolvedUrl === 'browser://bookmarks') title = 'Bookmarks';
        else if (resolvedUrl === 'browser://downloads') title = 'Downloads';

        return {
          ...tab,
          url: resolvedUrl,
          title: title,
          history: nextHistory,
          historyIndex: nextHistory.length - 1,
          loading: !resolvedUrl.startsWith('browser://')
        };
      }
      return tab;
    }));

    // Record history
    if (!resolvedUrl.startsWith('browser://')) {
      const isDuplicate = history.length > 0 && history[0].url === resolvedUrl;
      if (!isDuplicate) {
        const newHistoryItem: HistoryItem = {
          id: Date.now().toString(),
          title: extractDomain(resolvedUrl),
          url: resolvedUrl,
          visitedAt: Date.now()
        };
        setHistory(prev => [newHistoryItem, ...prev]);
      }
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNavigate(addressInput);
  };

  // Nav actions
  const goBack = () => {
    if (activeTab && activeTab.historyIndex > 0) {
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTabId) {
          const nextIdx = tab.historyIndex - 1;
          const prevUrl = tab.history[nextIdx];
          return {
            ...tab,
            url: prevUrl,
            title: prevUrl.startsWith('browser://') ? prevUrl.replace('browser://', 'Browser: ') : extractDomain(prevUrl),
            historyIndex: nextIdx,
            loading: !prevUrl.startsWith('browser://')
          };
        }
        return tab;
      }));
    }
  };

  const goForward = () => {
    if (activeTab && activeTab.historyIndex < activeTab.history.length - 1) {
      setTabs(prev => prev.map(tab => {
        if (tab.id === activeTabId) {
          const nextIdx = tab.historyIndex + 1;
          const nextUrl = tab.history[nextIdx];
          return {
            ...tab,
            url: nextUrl,
            title: nextUrl.startsWith('browser://') ? nextUrl.replace('browser://', 'Browser: ') : extractDomain(nextUrl),
            historyIndex: nextIdx,
            loading: !nextUrl.startsWith('browser://')
          };
        }
        return tab;
      }));
    }
  };

  const goHome = () => {
    handleNavigate('browser://newtab');
  };

  const triggerReload = () => {
    setReloadTrigger(prev => prev + 1);
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, loading: !tab.url.startsWith('browser://') };
      }
      return tab;
    }));
  };

  // Tab management
  const addNewTab = (url = 'browser://newtab') => {
    const newId = `tab-${Date.now()}`;
    const newTabObj: Tab = {
      id: newId,
      title: url === 'browser://newtab' ? 'New Tab' : extractDomain(url),
      url: url,
      history: [url],
      historyIndex: 0,
      loading: !url.startsWith('browser://')
    };
    setTabs([...tabs, newTabObj]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, idToClose: string) => {
    e.stopPropagation();
    if (tabs.length === 1) {
      // Don't close the last tab, instead reset it to home
      setTabs([{
        id: 'tab-initial',
        title: 'New Tab',
        url: 'browser://newtab',
        history: ['browser://newtab'],
        historyIndex: 0,
        loading: false
      }]);
      setActiveTabId('tab-initial');
      return;
    }

    const indexToClose = tabs.findIndex(t => t.id === idToClose);
    const updatedTabs = tabs.filter(t => t.id !== idToClose);
    setTabs(updatedTabs);

    if (activeTabId === idToClose) {
      // Pick another tab to make active
      const nextActiveIndex = Math.max(0, indexToClose - 1);
      setActiveTabId(updatedTabs[nextActiveIndex].id);
    }
  };

  // Bookmarking
  const isCurrentlyBookmarked = bookmarks.some(b => b.url === activeTab?.url);

  const toggleBookmark = () => {
    if (!activeTab || activeTab.url.startsWith('browser://')) return;
    
    if (isCurrentlyBookmarked) {
      setBookmarks(bookmarks.filter(b => b.url !== activeTab.url));
    } else {
      const newBookmark: Bookmark = {
        id: Date.now().toString(),
        title: activeTab.title || extractDomain(activeTab.url),
        url: activeTab.url,
        addedAt: Date.now()
      };
      setBookmarks([...bookmarks, newBookmark]);
    }
  };

  // Mock download simulation
  const simulateDownload = (filename: string, url: string, size: string) => {
    const downloadId = Date.now().toString();
    const newDownload: DownloadItem = {
      id: downloadId,
      filename,
      url,
      size,
      progress: 0,
      status: 'downloading',
      addedAt: Date.now()
    };
    setDownloads(prev => [newDownload, ...prev]);
    setShowDownloadsDrawer(true);

    let progressVal = 0;
    const interval = setInterval(() => {
      progressVal += Math.floor(Math.random() * 15) + 5;
      if (progressVal >= 100) {
        progressVal = 100;
        clearInterval(interval);
        setDownloads(prev => prev.map(dl => 
          dl.id === downloadId ? { ...dl, progress: 100, status: 'completed' } : dl
        ));
      } else {
        setDownloads(prev => prev.map(dl => 
          dl.id === downloadId ? { ...dl, progress: progressVal } : dl
        ));
      }
    }, 400);
  };

  // Trigger loading complete callback from iframe
  const handleIframeLoad = () => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, loading: false };
      }
      return tab;
    }));
  };

  return (
    <div id="browser-app" className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 select-none overflow-hidden antialiased">
      
      {/* Top Application Header / Tab Bar */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800/80 px-4 pt-2 pb-0 gap-3">
        {/* Mock window controls for premium desktop OS feel */}
        <div className="flex gap-1.5 shrink-0 pr-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-600/40" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-600/40" />
          <span className="w-3 h-3 rounded-full bg-green-500/80 border border-green-600/40" />
        </div>

        {/* Browser Tabs Area */}
        <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none pt-0.5 max-w-[85%]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const favicon = getFaviconUrl(tab.url);
            
            return (
              <div
                id={`tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group relative flex items-center h-9 px-3.5 rounded-t-xl text-xs cursor-pointer select-none border-t border-x transition-all duration-200 shrink-0 min-w-[120px] max-w-[180px] ${
                  isActive 
                    ? 'bg-slate-950 border-slate-800 text-white font-medium shadow-sm' 
                    : 'bg-slate-900/40 border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-850/50'
                }`}
              >
                {/* Tab Favicon or Fallback */}
                {tab.url.startsWith('browser://') ? (
                  <Shield size={13} className="text-blue-400 mr-2 shrink-0" />
                ) : favicon ? (
                  <img 
                    src={favicon} 
                    alt="" 
                    className="w-3.5 h-3.5 mr-2 object-contain shrink-0 rounded-sm"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <Globe size={13} className="text-slate-500 mr-2 shrink-0" />
                )}

                {/* Tab Title */}
                <span className="truncate pr-4 mr-1">
                  {tab.title || 'Loading...'}
                </span>

                {/* Close Tab Button */}
                <button
                  id={`close-tab-btn-${tab.id}`}
                  onClick={(e) => closeTab(e, tab.id)}
                  className={`absolute right-1.5 top-2.5 p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-800 shrink-0 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  } transition-all`}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Tab Button */}
        <button
          id="add-new-tab-btn"
          onClick={() => addNewTab()}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Open new tab"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Main Toolbar */}
      <div className="flex items-center bg-slate-950 border-b border-slate-800/80 px-4 py-2 gap-3 z-20 shrink-0">
        
        {/* Navigation Arrows */}
        <div className="flex gap-1.5">
          <button
            id="nav-back-btn"
            onClick={goBack}
            disabled={!activeTab || activeTab.historyIndex === 0}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            title="Go back"
          >
            <ArrowLeft size={15} />
          </button>
          <button
            id="nav-forward-btn"
            onClick={goForward}
            disabled={!activeTab || activeTab.historyIndex === activeTab.history.length - 1}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            title="Go forward"
          >
            <ArrowRight size={15} />
          </button>
          <button
            id="nav-reload-btn"
            onClick={triggerReload}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Reload this page"
          >
            <RotateCw size={15} className={activeTab?.loading ? 'animate-spin' : ''} />
          </button>
          <button
            id="nav-home-btn"
            onClick={goHome}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Open start page"
          >
            <Home size={15} />
          </button>
        </div>

        {/* SSL Status Indicator */}
        <div className="relative">
          <button
            id="ssl-indicator"
            onClick={() => setShowSSLPopup(!showSSLPopup)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
              activeTab?.url.startsWith('browser://')
                ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                : activeTab?.url.startsWith('https://')
                ? 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400 hover:bg-emerald-950/40'
                : 'bg-yellow-950/20 border-yellow-900/30 text-yellow-400 hover:bg-yellow-950/40'
            }`}
          >
            {activeTab?.url.startsWith('browser://') ? (
              <Shield size={13} />
            ) : (
              <Lock size={13} />
            )}
            <span className="hidden md:inline">
              {activeTab?.url.startsWith('browser://') ? 'Internal' : activeTab?.url.startsWith('https://') ? 'Secure' : 'Unsecure'}
            </span>
          </button>

          {/* SSL Certificate/Security Popup */}
          {showSSLPopup && (
            <div id="ssl-modal" className="absolute top-10 left-0 bg-slate-900 border border-slate-800 shadow-2xl rounded-xl p-4 w-64 text-xs z-50 text-slate-300">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-white">Connection details</span>
                <button onClick={() => setShowSSLPopup(false)} className="text-slate-500 hover:text-white">✕</button>
              </div>
              {activeTab?.url.startsWith('browser://') ? (
                <p className="leading-relaxed">This is a secure system internal page. No network requests are sent outside this environment.</p>
              ) : activeTab?.url.startsWith('https://') ? (
                <div className="space-y-2 leading-relaxed">
                  <p className="text-emerald-400 font-medium">✓ Connection is Encrypted</p>
                  <p>Your connection to <span className="text-white font-semibold font-mono">{extractDomain(activeTab.url)}</span> is encrypted via SSL/TLS certificates routed securely through our high-performance HTTP proxy.</p>
                </div>
              ) : (
                <div className="space-y-2 leading-relaxed">
                  <p className="text-yellow-400 font-medium">⚠️ Connection Unencrypted</p>
                  <p>This site does not secure data with HTTPS. Avoid entering passwords, tokens, or credit cards.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Address Bar Input Form */}
        <form onSubmit={handleAddressSubmit} className="flex-1 relative flex items-center">
          <input
            id="url-bar"
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Type search queries (DuckDuckGo format) or a URL..."
            className="w-full bg-slate-900 hover:bg-slate-850 focus:bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-all pr-8"
          />
          {/* Bookmark Toggler Star Icon inside Input */}
          {!activeTab?.url.startsWith('browser://') && (
            <button
              id="bookmark-star-btn"
              type="button"
              onClick={toggleBookmark}
              className={`absolute right-2.5 p-1 rounded-md transition-colors hover:bg-slate-800 ${
                isCurrentlyBookmarked ? 'text-yellow-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={isCurrentlyBookmarked ? "Remove bookmark" : "Bookmark this page"}
            >
              <Star size={13} fill={isCurrentlyBookmarked ? "currentColor" : "none"} />
            </button>
          )}
        </form>

        {/* Utilities: Downloads, History, Bookmarks, DevTools */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            id="downloads-btn"
            onClick={() => setShowDownloadsDrawer(!showDownloadsDrawer)}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer relative ${
              showDownloadsDrawer ? 'bg-slate-900 text-white' : ''
            }`}
            title="Download Manager"
          >
            <Download size={15} />
            {downloads.some(d => d.status === 'downloading') && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
          <button
            id="history-btn"
            onClick={() => handleNavigate('browser://history')}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer ${
              activeTab?.url === 'browser://history' ? 'bg-slate-900 text-white' : ''
            }`}
            title="Browsing History"
          >
            <Clock size={15} />
          </button>
          <button
            id="bookmarks-btn"
            onClick={() => handleNavigate('browser://bookmarks')}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer ${
              activeTab?.url === 'browser://bookmarks' ? 'bg-slate-900 text-white' : ''
            }`}
            title="Bookmarks list"
          >
            <Heart size={15} />
          </button>
          <button
            id="devtools-btn"
            onClick={() => setShowDevTools(!showDevTools)}
            className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer ${
              showDevTools ? 'bg-slate-900 text-white' : ''
            }`}
            title="Inspect page code"
          >
            <Code size={15} />
          </button>

          {/* APK & PWA Generator Button */}
          <button
            id="apk-pwa-btn"
            onClick={() => setShowApkModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all cursor-pointer ml-1"
            title="Android APK & PWA Setup"
          >
            <Smartphone size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">APK & PWA</span>
          </button>
        </div>
      </div>

      {/* Bookmarks Quick Bar */}
      {bookmarks.length > 0 && (
        <div className="flex items-center bg-slate-950 border-b border-slate-900 px-4 py-1 gap-2 text-xs text-slate-400 z-10 shrink-0">
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider select-none shrink-0 pr-1">Bookmarks:</span>
          <div className="flex gap-1 overflow-x-auto scrollbar-none py-0.5">
            {bookmarks.map(b => (
              <button
                id={`quick-bookmark-${b.id}`}
                key={b.id}
                onClick={() => handleNavigate(b.url)}
                className="flex items-center gap-1.5 bg-slate-900/60 hover:bg-slate-900 hover:text-white border border-slate-800 px-2 py-0.5 rounded-md text-slate-300 transition-all select-none cursor-pointer shrink-0"
              >
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${new URL(b.url).hostname}&sz=32`} 
                  alt="" 
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="max-w-[120px] truncate">{b.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Progress / Loading Bar */}
      {activeTab?.loading && (
        <div className="w-full h-0.5 bg-slate-900 overflow-hidden shrink-0">
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: '90%' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="h-full bg-blue-500" 
          />
        </div>
      )}

      {/* Browser Viewport Area */}
      <div className="flex-1 flex overflow-hidden bg-slate-950 relative">
        
        {/* VIEWPORT CONTROLLER */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          
          {/* 1. START PAGE */}
          {activeTab?.url === 'browser://newtab' && (
            <StartPage 
              onNavigate={handleNavigate}
              searchEngine={searchEngine}
              onSearchEngineChange={setSearchEngine}
              bookmarks={bookmarks}
              onAddBookmark={(title, url) => {
                setBookmarks([...bookmarks, { id: Date.now().toString(), title, url, addedAt: Date.now() }]);
              }}
              onRemoveBookmark={(id) => {
                setBookmarks(bookmarks.filter(b => b.id !== id));
              }}
            />
          )}

          {/* 2. HISTORY PAGE */}
          {activeTab?.url === 'browser://history' && (
            <div id="history-view" className="flex-1 bg-slate-950 p-6 md:p-12 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-8">
                  <div>
                    <h1 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
                      <Clock className="text-blue-500" /> Browsing History
                    </h1>
                    <p className="text-slate-400 text-xs font-sans mt-1">View, inspect, and remove past websites visited.</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                      <Search size={14} className="text-slate-500 mr-2" />
                      <input 
                        id="history-search"
                        type="text" 
                        placeholder="Search history..." 
                        value={historyFilter}
                        onChange={(e) => setHistoryFilter(e.target.value)}
                        className="bg-transparent border-none text-white focus:outline-none w-44"
                      />
                    </div>
                    {history.length > 0 && (
                      <button
                        id="clear-history"
                        onClick={() => {
                          if (confirm("Clear all browsing history?")) setHistory([]);
                        }}
                        className="bg-red-950/40 hover:bg-red-900 border border-red-900/40 text-red-400 text-xs font-sans px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Clear History
                      </button>
                    )}
                  </div>
                </div>

                {/* History Items List */}
                <div className="space-y-2">
                  {history
                    .filter(item => item.url.toLowerCase().includes(historyFilter.toLowerCase()) || item.title.toLowerCase().includes(historyFilter.toLowerCase()))
                    .map((item) => (
                      <div 
                        key={item.id} 
                        className="group flex items-center justify-between bg-slate-900/40 hover:bg-slate-900/90 border border-slate-800/60 hover:border-slate-700 p-3 rounded-xl transition-all"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {new Date(item.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <img 
                            src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`} 
                            alt="" 
                            className="w-4 h-4 object-contain shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <button
                            id={`history-item-nav-${item.id}`}
                            onClick={() => handleNavigate(item.url)}
                            className="text-slate-200 hover:text-white font-medium text-xs text-left truncate hover:underline cursor-pointer"
                          >
                            {item.title}
                          </button>
                          <span className="text-[10px] text-slate-500 font-mono truncate hidden md:inline select-all">
                            {item.url}
                          </span>
                        </div>
                        <button
                          id={`history-item-delete-${item.id}`}
                          onClick={() => setHistory(history.filter(h => h.id !== item.id))}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                  {history.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Clock size={28} className="mx-auto mb-2 text-slate-600" />
                      <p className="font-sans">No browsing history found.</p>
                      <p className="font-sans text-xs text-slate-600 mt-1">Live website visits via the address bar will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. BOOKMARKS PAGE */}
          {activeTab?.url === 'browser://bookmarks' && (
            <div id="bookmarks-view" className="flex-1 bg-slate-950 p-6 md:p-12 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-8">
                  <div>
                    <h1 className="text-2xl font-sans font-bold text-white flex items-center gap-2">
                      <Heart className="text-red-400" /> Bookmarks Manager
                    </h1>
                    <p className="text-slate-400 text-xs font-sans mt-1">Organize, revisit, or remove your saved addresses.</p>
                  </div>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                    <Search size={14} className="text-slate-500 mr-2" />
                    <input 
                      id="bookmark-search"
                      type="text" 
                      placeholder="Search bookmarks..." 
                      value={bookmarkFilter}
                      onChange={(e) => setBookmarkFilter(e.target.value)}
                      className="bg-transparent border-none text-white focus:outline-none w-44"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bookmarks
                    .filter(b => b.url.toLowerCase().includes(bookmarkFilter.toLowerCase()) || b.title.toLowerCase().includes(bookmarkFilter.toLowerCase()))
                    .map((item) => (
                      <div 
                        key={item.id} 
                        className="group relative flex flex-col justify-between bg-slate-900/40 hover:bg-slate-900/90 border border-slate-800/60 hover:border-slate-700 p-4 rounded-xl transition-all"
                      >
                        <div className="flex items-start gap-3 overflow-hidden mb-4 pr-6">
                          <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0">
                            <img 
                              src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`} 
                              alt="" 
                              className="w-4 h-4 object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                          <div className="overflow-hidden">
                            <button
                              id={`bookmark-item-nav-${item.id}`}
                              onClick={() => handleNavigate(item.url)}
                              className="text-slate-200 hover:text-white font-medium text-xs hover:underline text-left truncate w-full cursor-pointer block"
                            >
                              {item.title}
                            </button>
                            <span className="text-[10px] text-slate-500 font-mono block truncate mt-1 select-all">
                              {item.url}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-800/50 pt-2 text-[10px] text-slate-500 font-mono">
                          <span>Added: {new Date(item.addedAt).toLocaleDateString()}</span>
                          <div className="flex gap-2">
                            <button
                              id={`bookmark-item-del-${item.id}`}
                              onClick={() => setBookmarks(bookmarks.filter(b => b.id !== item.id))}
                              className="text-slate-500 hover:text-red-400 font-sans cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                  {bookmarks.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-slate-500">
                      <Heart size={28} className="mx-auto mb-2 text-slate-600" />
                      <p className="font-sans">No bookmarks saved yet.</p>
                      <p className="font-sans text-xs text-slate-600 mt-1">Tap the star in the navigation toolbar on any live webpage to save it.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. LIVE IFRAME RENDERING STAGE */}
          {!activeTab?.url.startsWith('browser://') && (
            <div className="flex-1 relative w-full h-full bg-white">
              {/* Fallback mock alert if iframe loading fails or blocks */}
              <iframe
                id="viewport-frame"
                key={activeTab.id + '-' + reloadTrigger}
                src={`/api/proxy?url=${encodeURIComponent(activeTab.url)}`}
                className="w-full h-full border-none bg-white"
                onLoad={handleIframeLoad}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          )}

        </div>

        {/* SIMULATED DEVTOOLS PANEL */}
        {showDevTools && (
          <DevTools 
            url={activeTab?.url || ''} 
            onClose={() => setShowDevTools(false)} 
          />
        )}

        {/* DOWNLOADS DRAWER PANEL */}
        {showDownloadsDrawer && (
          <div id="downloads-drawer" className="absolute top-0 right-0 w-80 h-full border-l border-slate-800 bg-slate-900 shadow-2xl z-30 flex flex-col font-sans">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Download size={14} className="text-blue-400" />
                <span className="font-semibold text-white tracking-wide text-xs">Download History</span>
              </div>
              <button 
                id="close-downloads-drawer"
                onClick={() => setShowDownloadsDrawer(false)} 
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {downloads.map((item) => (
                <div key={item.id} className="bg-slate-950/50 border border-slate-800/80 p-3 rounded-xl space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="overflow-hidden">
                      <p className="text-xs text-white font-medium truncate">{item.filename}</p>
                      <span className="text-[9px] text-slate-500 truncate block font-mono">{item.url}</span>
                    </div>
                    <button
                      id={`dl-trash-${item.id}`}
                      onClick={() => setDownloads(downloads.filter(d => d.id !== item.id))}
                      className="text-slate-500 hover:text-red-400 p-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                    <span>{item.size}</span>
                    <span>•</span>
                    <span className={`capitalize ${
                      item.status === 'completed' ? 'text-emerald-400' :
                      item.status === 'failed' ? 'text-red-400' : 'text-blue-400'
                    }`}>{item.status}</span>
                  </div>

                  {item.status === 'downloading' && (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                        <span>{item.progress}%</span>
                        <span>Estimating...</span>
                      </div>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="flex gap-2 pt-1 border-t border-slate-800/40">
                      <button
                        id={`dl-open-${item.id}`}
                        onClick={() => alert(`Simulated open action for: ${item.filename}`)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        Open File
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {downloads.length === 0 && (
                <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                  <Download size={22} className="text-slate-600 mb-1.5" />
                  <p className="text-xs font-medium">No active or past downloads.</p>
                  <button
                    id="trigger-sim-dl"
                    onClick={() => simulateDownload('web_browser_release_v1.0.zip', 'https://browser-core.io/releases/v1.0', '14.8 MB')}
                    className="mt-3 text-xs text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                  >
                    Simulate a mock download
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* APK & PWA Packaging & Performance Modal */}
        {showApkModal && (
          <div
            id="apk-modal-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setShowApkModal(false)}
          >
            <div
              id="apk-modal-card"
              className="bg-slate-900 border border-slate-750 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-xl">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Package as Android APK & PWA</h3>
                    <p className="text-xs text-slate-400">Generate your APK or install directly to Android</p>
                  </div>
                </div>
                <button
                  id="close-apk-modal"
                  onClick={() => setShowApkModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 text-xs">
                {/* Performance Speed Banner */}
                <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-emerald-950/30 border border-blue-800/40 rounded-xl p-3.5 flex items-start gap-3">
                  <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
                    <Zap size={16} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-blue-200 flex items-center gap-2">
                      <span>High-Performance Engine Active</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">Fast Proxy</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Equipped with in-memory response caching, GZIP HTTP compression, HTTP Keep-Alive sockets, and 8s fast abort for responsive multi-tab browsing.
                    </p>
                  </div>
                </div>

                {/* Direct Solution for PWABuilder */}
                <div className="border border-emerald-500/30 bg-emerald-950/15 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-emerald-300 flex items-center gap-2">
                      <span>1. Generate APK with PWABuilder</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">Recommended</span>
                    </h4>
                  </div>
                  
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Why did PWABuilder say <em>"Did not find a Web Manifest"</em>? Google AI Studio's dev preview URLs have a security cookie wall that prevents external automated crawlers from scanning the URL directly.
                  </p>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] text-slate-400">
                      <strong>How to bypass in 15 seconds:</strong><br />
                      1. In PWABuilder, click <strong className="text-emerald-400">"Use our Manifest Editor"</strong> (or go to Manifest Editor).<br />
                      2. Click <strong>"Copy Manifest JSON"</strong> below and paste it into the editor.<br />
                      3. Click <strong>Package for Android</strong> &rarr; <strong>Generate APK</strong>!
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        id="copy-manifest-btn"
                        onClick={() => {
                          const manifestObj = {
                            name: "OLegacy Web Browser",
                            short_name: "OLegacy",
                            description: "A fully functional web browser simulator with multi-tab browsing, search engine integration, bookmarks, and a server-side proxy to load live websites.",
                            start_url: "/",
                            id: "/",
                            scope: "/",
                            display: "standalone",
                            background_color: "#0f172a",
                            theme_color: "#1e293b",
                            icons: [
                              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                              { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
                              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                              { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
                            ]
                          };
                          navigator.clipboard.writeText(JSON.stringify(manifestObj, null, 2));
                          setCopiedManifest(true);
                          setTimeout(() => setCopiedManifest(false), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors cursor-pointer"
                      >
                        {copiedManifest ? <CheckCheck size={13} /> : <Copy size={13} />}
                        <span>{copiedManifest ? 'Manifest JSON Copied!' : 'Copy Manifest JSON'}</span>
                      </button>

                      <a
                        href="/manifest.json"
                        download="manifest.json"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
                      >
                        <FileJson size={13} />
                        <span>Download manifest.json</span>
                      </a>

                      <a
                        href="/icon-512.png"
                        download="icon-512.png"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs transition-colors cursor-pointer"
                      >
                        <Download size={13} />
                        <span>Download 512px Icon</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Direct Android Device Installation */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-2.5">
                  <h4 className="text-xs font-semibold text-slate-200">2. Direct Android Device Install (Instant)</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    You can install the browser directly onto your phone without compiling an APK file. It runs in standalone fullscreen with its own app launcher icon.
                  </p>
                  {deferredPrompt ? (
                    <button
                      onClick={async () => {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                          setDeferredPrompt(null);
                          setShowApkModal(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Install App on this Device</span>
                    </button>
                  ) : (
                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-[11px] text-slate-400">
                      On Chrome for Android: Tap the menu <strong className="text-slate-200">(⋮)</strong> in the top right &rarr; tap <strong className="text-emerald-400">Install app</strong> or <strong className="text-emerald-400">Add to Home screen</strong>.
                    </div>
                  )}
                </div>

                {/* GitHub Actions APK build */}
                <div className="border border-slate-800 bg-slate-950/60 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-200">3. GitHub Actions Auto-APK</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    The repository includes <code className="text-blue-400 font-mono">.github/workflows/build-apk.yml</code> and <code className="text-blue-400 font-mono">capacitor.config.json</code>. When you export this repository to GitHub, the workflow automatically builds your APK on every commit!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
