import { useCallback, useEffect, useRef, useState } from 'react';
import { readTab } from '../../agent/page-context.js';

// Same shape the dev panel used: a listing only when the active tab URL is a
// property page on realestate.com.au or domain.com.au.
const LISTING_URL = /realestate\.com\.au\/property-|domain\.com\.au\/[^/?#]+-\d{7,}\/?(?:[?#]|$)/;

/** The tab this panel lives in — the background reads it off the message sender. */
async function currentTab() {
  const tab = await chrome.runtime.sendMessage({ type: 'fineprint:whoami' }).catch(() => null);
  if (tab) return tab;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active;
}

/**
 * Detect the listing once on mount and resolve the thread for it (one thread
 * per listing URL, remembered in chrome.storage.local under `threads`).
 */
export function useListing() {
  const [state, setState] = useState({ ready: false, listing: null, threadId: null });
  const listingRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tab = await currentTab();
      const isListing = tab?.url && LISTING_URL.test(tab.url);
      const listing = isListing ? { url: tab.url, title: tab.title, page: await readTab(tab.id) } : null;
      const { threads = {} } = await chrome.storage.local.get('threads');
      const key = listing?.url ?? 'scratch';
      const threadId = threads[key] ?? `${key}#${Date.now()}`;
      threads[key] = threadId;
      await chrome.storage.local.set({ threads });
      if (cancelled) return;
      listingRef.current = listing;
      setState({ ready: true, listing, threadId });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Start a fresh thread for the current listing (or the scratchpad). */
  const newThread = useCallback(async () => {
    const { threads = {} } = await chrome.storage.local.get('threads');
    const key = listingRef.current?.url ?? 'scratch';
    const threadId = `${key}#${Date.now()}`;
    threads[key] = threadId;
    await chrome.storage.local.set({ threads });
    setState((s) => ({ ...s, threadId }));
  }, []);

  return { ...state, newThread };
}
