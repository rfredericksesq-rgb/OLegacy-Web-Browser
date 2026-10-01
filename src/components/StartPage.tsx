import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Plus, Trash2, Globe, Heart } from 'lucide-react';
import { SearchEngine, Bookmark } from '../types';
import { SEARCH_ENGINES, getUrlOrSearch } from '../utils';

interface StartPageProps {
  onNavigate: (url: string) => void;
  searchEngine: SearchEngine;
  onSearchEngineChange: (engine: SearchEngine) => void;
  bookmarks: Bookmark[];
  onAddBookmark: (title: string, url: string) => void;
  onRemoveBookmark: (id: string) => void;
}

interface SpeedDial {
  id: string;
  title: string;
  url: string;
  icon?: string;
  isCustom?: boolean;
}

const INITIAL_SPEED_DIALS: SpeedDial[] = [
  { id: '1', title: 'Wikipedia', url: 'https://en.wikipedia.org' },
  { id: '2', title: 'Legacy Open Book-club', url: 'http://bkcluby.atwebpages.com/' },
  { id: '3', title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
  { id: '4', title: 'GitHub', url: 'https://github.com' },
  { id: '5', title: 'Reddit', url: 'https://www.reddit.com' },
  { id: '6', title: 'YouTube', url: 'https://www.youtube.com' }
];

export default function StartPage({
  onNavigate,
  searchEngine,
  onSearchEngineChange,
  bookmarks,
  onAddBookmark,
  onRemoveBookmark
}: StartPageProps) {
  const [time, setTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [speedDials, setSpeedDials] = useState<SpeedDial[]>(() => {
    const saved = localStorage.getItem('browser_speed_dials');
    return saved ? JSON.parse(saved) : INITIAL_SPEED_DIALS;
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('browser_speed_dials', JSON.stringify(speedDials));
  }, [speedDials]);

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const resolvedUrl = getUrlOrSearch(searchQuery, searchEngine);
    onNavigate(resolvedUrl);
  };

  const handleAddSpeedDial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    const newItem: SpeedDial = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url: formattedUrl,
      isCustom: true
    };
    setSpeedDials([...speedDials, newItem]);
    setNewTitle('');
    setNewUrl('');
    setShowAddModal(false);
  };

  const handleDeleteSpeedDial = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSpeedDials(speedDials.filter(item => item.id !== id));
  };

  return (
    <div id="start-page" className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-slate-950 text-slate-100 overflow-y-auto select-none min-h-screen">
      {/* Background visual ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Real-time Clock and Greeting */}
      <div className="text-center mb-8 z-10">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-6xl font-sans font-light tracking-tight text-white mb-2"
        >
          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-lg text-slate-400 font-sans tracking-wide"
        >
          {getGreeting()}, Explorer
        </motion.p>
      </div>

      {/* Unified Search Bar */}
      <motion.form 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleSearchSubmit}
        className="w-full max-w-2xl bg-slate-900/80 border border-slate-800 focus-within:border-blue-500/50 rounded-2xl shadow-2xl backdrop-blur-md p-2 flex items-center mb-10 z-10 transition-all duration-300"
      >
        <div className="flex items-center pl-3 pr-2 text-slate-400">
          <Search size={20} />
        </div>
        <input 
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search with ${SEARCH_ENGINES[searchEngine].name} or enter URL...`}
          className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-slate-500 text-base py-2 px-1"
          autoFocus
        />
        <div className="flex gap-1 pr-1">
          <select
            id="engine-selector"
            value={searchEngine}
            onChange={(e) => onSearchEngineChange(e.target.value as SearchEngine)}
            className="bg-slate-800 text-slate-300 hover:text-white border-none rounded-lg text-xs px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
          >
            {Object.values(SEARCH_ENGINES).map(engineOpt => (
              <option key={engineOpt.id} value={engineOpt.id}>
                {engineOpt.name}
              </option>
            ))}
          </select>
          <button
            id="search-button"
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg text-xs px-4 py-1.5 transition-colors"
          >
            Search
          </button>
        </div>
      </motion.form>

      {/* Speed Dial Grid */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full max-w-4xl z-10"
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-6">
          <h2 className="text-sm font-sans font-medium text-slate-400 uppercase tracking-widest">
            Speed Dials / Shortcuts
          </h2>
          <button
            id="add-dial-button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            <Plus size={16} /> Add Shortcut
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {speedDials.map((dial, index) => {
            const domain = dial.url ? new URL(dial.url).hostname : '';
            return (
              <motion.div
                key={dial.id}
                whileHover={{ y: -4, scale: 1.02 }}
                onClick={() => onNavigate(dial.url)}
                className="group relative bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer text-center aspect-square transition-all duration-200"
              >
                {/* Trash button for deletions */}
                <button
                  id={`delete-dial-${dial.id}`}
                  onClick={(e) => handleDeleteSpeedDial(e, dial.id)}
                  className="absolute top-2 right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 rounded hover:bg-slate-800/80 transition-all"
                  title="Remove shortcut"
                >
                  <Trash2 size={13} />
                </button>

                <div className="w-12 h-12 rounded-xl bg-slate-800/80 group-hover:bg-slate-800 flex items-center justify-center text-white mb-3 shadow-md border border-slate-700/50">
                  {dial.url.startsWith('https://') ? (
                    <img 
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                      alt={dial.title}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        // Fallback to globe icon
                        e.currentTarget.style.display = 'none';
                        const p = e.currentTarget.parentElement;
                        if (p) {
                          const iconDiv = document.createElement('div');
                          iconDiv.className = 'text-blue-400';
                          iconDiv.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
                          p.appendChild(iconDiv);
                        }
                      }}
                    />
                  ) : (
                    <Globe size={22} className="text-blue-400" />
                  )}
                </div>

                <span className="text-sm font-sans font-medium text-slate-200 group-hover:text-white truncate w-full px-1">
                  {dial.title}
                </span>
                <span className="text-[10px] text-slate-500 truncate w-full px-2 mt-0.5">
                  {domain}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Bookmarks bar link preview */}
      {bookmarks.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-4xl mt-10 z-10"
        >
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-4">
            <Heart size={14} className="text-red-400" />
            <h2 className="text-sm font-sans font-medium text-slate-400 uppercase tracking-widest">
              My Saved Bookmarks ({bookmarks.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {bookmarks.slice(0, 8).map((bookmark) => (
              <button
                id={`start-bookmark-${bookmark.id}`}
                key={bookmark.id}
                onClick={() => onNavigate(bookmark.url)}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-800 text-slate-300 rounded-lg px-3 py-1.5 text-xs transition-colors"
              >
                <img 
                  src={`https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`} 
                  alt="" 
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <span className="max-w-[120px] truncate">{bookmark.title}</span>
              </button>
            ))}
            {bookmarks.length > 8 && (
              <button
                id="see-all-bookmarks"
                onClick={() => onNavigate('browser://bookmarks')}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium px-2 py-1.5"
              >
                + {bookmarks.length - 8} more
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Add Shortcut Modal */}
      {showAddModal && (
        <div id="add-modal" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-slate-100"
          >
            <h3 className="text-lg font-sans font-semibold mb-4 text-white">
              Add New Shortcut
            </h3>
            <form onSubmit={handleAddSpeedDial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Name / Title
                </label>
                <input
                  id="modal-title-input"
                  type="text"
                  required
                  placeholder="e.g. Wikipedia"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2 text-white focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Address / URL
                </label>
                <input
                  id="modal-url-input"
                  type="text"
                  required
                  placeholder="e.g. en.wikipedia.org"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-4 py-2 text-white focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  id="modal-cancel-button"
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewTitle('');
                    setNewUrl('');
                  }}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl px-4 py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="modal-save-button"
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                >
                  Save Shortcut
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
