import { useEffect, useState } from 'react';
import { loadBrief, loadSettings } from '../../agent/agent.js';

/**
 * The data pipeline for the listing on screen — no LLM: page → address → strict
 * GNAF match → brief (all Microburbs endpoints) → property memory. Drives the
 * instant overview; the agent gets it as context. `version` bumps re-load it
 * (e.g. after the investor brief changes). Also fires window 'fineprint:brief'.
 */
export function useBrief(listing, version = 0) {
  const [state, setState] = useState({ status: 'idle', res: null, investor: null });
  useEffect(() => {
    if (!listing) {
      setState({ status: 'idle', res: null, investor: null });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading' }));
    (async () => {
      const settings = await loadSettings();
      const res = await loadBrief({ listing });
      if (cancelled) return;
      window.finePrint = { brief: res.ok ? res.brief : null, result: res };
      window.dispatchEvent(new CustomEvent('fineprint:brief', { detail: res }));
      setState({ status: res.ok ? 'ok' : 'error', res, investor: settings.brief });
    })();
    return () => {
      cancelled = true;
    };
  }, [listing, version]);
  return state;
}
