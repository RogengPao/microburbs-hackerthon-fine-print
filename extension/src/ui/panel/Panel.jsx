import { useEffect } from 'react';
import { firstRead } from '../../agent/agent.js';
import { useListing } from '../hooks/useListing.js';
import { useAgentThread } from '../hooks/useAgentThread.js';
import AskForm from './components/AskForm.jsx';
import Header from './components/Header.jsx';
import ListingBanner from './components/ListingBanner.jsx';
import Starters from './components/Starters.jsx';
import Thread from './components/Thread.jsx';

export default function Panel() {
  const { ready, listing, threadId, newThread } = useListing();
  const thread = useAgentThread();
  const { load, run, send, busy } = thread;

  // Load the thread's transcript whenever it switches; a fresh listing thread
  // gets the hidden first-read turn — the agent talks first.
  useEffect(() => {
    if (!threadId) return;
    let cancelled = false;
    (async () => {
      const msgs = await load(threadId);
      if (cancelled || !listing || msgs.length) return;
      await run(threadId, (handlers) => firstRead({ threadId, listing, ...handlers }), {
        status: 'Reading this listing…',
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [threadId, listing, load, run]);

  // The panel's ✕ asks the host (content script) to close; only reply to our own origin.
  const onClose = () => {
    const parentOrigin = window.location.ancestorOrigins?.[0];
    if (parentOrigin) window.parent.postMessage({ type: 'fineprint:close' }, parentOrigin);
  };

  return (
    <div className="flex h-screen flex-col">
      <Header onNew={newThread} onClose={onClose} />
      <ListingBanner ready={ready} listing={listing} />
      <Thread
        messages={thread.messages}
        liveText={thread.liveText}
        statusLine={thread.statusLine}
        eventLines={thread.eventLines}
        turnMeta={thread.turnMeta}
        turnError={thread.turnError}
      />
      <Starters busy={busy} onPick={(text) => send(threadId, listing, text)} />
      <AskForm busy={busy} onSend={(text) => send(threadId, listing, text)} />
    </div>
  );
}
