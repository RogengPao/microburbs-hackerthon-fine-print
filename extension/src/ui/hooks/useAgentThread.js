import { useCallback, useRef, useState } from 'react';
import { ask, history } from '../../agent/agent.js';

/**
 * One chat thread over the agent runtime: transcript state, the turn loop with
 * live streaming + tool lines, and the busy flag. The transcript is the only
 * persisted state — after each turn it is re-read from the store.
 */
export function useAgentThread() {
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [liveText, setLiveText] = useState(null); // streaming bubble for the current step
  const [statusLine, setStatusLine] = useState(null); // e.g. "Reading this listing…"
  const [eventLines, setEventLines] = useState([]); // "→ get_listing_brief", "retrying…"
  const [turnMeta, setTurnMeta] = useState(null); // status · steps · tokens · seconds
  const [turnError, setTurnError] = useState(null);
  const busyRef = useRef(false);

  /** Load (or reload) the transcript for a thread. Returns the messages. */
  const load = useCallback(async (threadId) => {
    const msgs = await history(threadId);
    setMessages(msgs);
    setLiveText(null);
    setStatusLine(null);
    setEventLines([]);
    setTurnMeta(null);
    setTurnError(null);
    return msgs;
  }, []);

  /** Run one turn with live streaming + tool lines, then re-render from the transcript. */
  const run = useCallback(
    async (threadId, runner, { status = null } = {}) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setStatusLine(status);
      setEventLines([]);
      setTurnMeta(null);
      setTurnError(null);
      const started = Date.now();
      let live = '';
      let haveLive = false;
      try {
        const result = await runner({
          onDelta: (d) => {
            if (d.type !== 'text') return;
            live += d.text;
            haveLive = true;
            setLiveText(live);
          },
          onEvent: (e) => {
            if (e.event === 'step' && haveLive) {
              live = '';
              haveLive = false;
              setLiveText(null); // the persisted record re-renders below
            } else if (e.event === 'tool') {
              setEventLines((ls) => [...ls, `${e.error ? '✕' : '→'} ${e.name}`]);
            } else if (e.event === 'retry') {
              setEventLines((ls) => [...ls, `retrying (${e.reason})…`]);
            }
          },
        });
        // re-read the transcript: it is the only state
        await load(threadId);
        const u = result.usage;
        setTurnMeta(
          `${result.status} · ${result.steps} steps · ${u.input_tokens + u.output_tokens} tokens${
            u.cost ? ` · $${u.cost.toFixed(4)}` : ''
          } · ${((Date.now() - started) / 1000).toFixed(1)}s`,
        );
        if (result.status === 'failed') setTurnError(`Failed: ${result.failure?.message ?? result.failure_reason}`);
      } catch (e) {
        setLiveText(null);
        setTurnError(String(e?.message ?? e));
      } finally {
        busyRef.current = false;
        setBusy(false);
        setStatusLine(null);
        setEventLines([]);
      }
    },
    [load],
  );

  /** Optimistically append the user's bubble, then run the turn. */
  const send = useCallback(
    (threadId, listing, text) => {
      if (busyRef.current || !text.trim()) return;
      setMessages((ms) => [...ms, { role: 'user', text }]);
      return run(threadId, (handlers) => ask({ threadId, text, listing, ...handlers }));
    },
    [run],
  );

  return { messages, busy, liveText, statusLine, eventLines, turnMeta, turnError, load, run, send };
}
