export interface Tab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  favicon?: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  addedAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  size: string;
  progress: number; // 0 to 100
  status: 'downloading' | 'completed' | 'failed';
  addedAt: number;
}

export type SearchEngine = 'google' | 'duckduckgo' | 'wikipedia' | 'bing';

export interface SearchEngineConfig {
  id: SearchEngine;
  name: string;
  searchUrl: string;
  icon: string;
}
