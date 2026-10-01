import { SearchEngine } from './types';

export const SEARCH_ENGINES = {
  duckduckgo: {
    id: 'duckduckgo' as SearchEngine,
    name: 'DuckDuckGo (Iframe Friendly)',
    searchUrl: 'https://html.duckduckgo.com/html/?q=%s',
    icon: 'Search'
  },
  google: {
    id: 'google' as SearchEngine,
    name: 'Google Search',
    searchUrl: 'https://www.google.com/search?q=%s',
    icon: 'Chrome'
  },
  wikipedia: {
    id: 'wikipedia' as SearchEngine,
    name: 'Wikipedia Search',
    searchUrl: 'https://en.wikipedia.org/wiki/Special:Search?search=%s',
    icon: 'BookOpen'
  },
  bing: {
    id: 'bing' as SearchEngine,
    name: 'Bing Search',
    searchUrl: 'https://www.bing.com/search?q=%s',
    icon: 'Compass'
  }
};

/**
 * Validates whether the input is a URL or a search query
 */
export function getUrlOrSearch(input: string, engine: SearchEngine): string {
  const trimmed = input.trim();
  if (!trimmed) return 'browser://newtab';

  if (trimmed.startsWith('browser://')) {
    return trimmed;
  }

  // Regexes to identify URLs
  const urlPattern = /^(https?:\/\/)?(www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i;
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/;
  const localhostPattern = /^localhost(:\d+)?(\/.*)?$/i;

  if (urlPattern.test(trimmed) || ipPattern.test(trimmed) || localhostPattern.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return 'https://' + trimmed;
    }
    return trimmed;
  }

  // Handle fallback or direct search
  const config = SEARCH_ENGINES[engine] || SEARCH_ENGINES.duckduckgo;
  return config.searchUrl.replace('%s', encodeURIComponent(trimmed));
}

/**
 * Extracts clean domain name for display
 */
export function extractDomain(url: string): string {
  if (!url) return '';
  if (url.startsWith('browser://')) {
    return url.replace('browser://', 'Browser: ');
  }
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return url;
  }
}

/**
 * Helper to get a favicon URL or fallback letter
 */
export function getFaviconUrl(url: string): string {
  if (!url || url.startsWith('browser://')) return '';
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch (e) {
    return '';
  }
}
