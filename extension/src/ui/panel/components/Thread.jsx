import { useEffect, useMemo, useRef } from 'react';
import Message from './Message.jsx';
import ToolCall from './ToolCall.jsx';

const META_CLASS = 'self-center font-mono text-[10px] text-muted';
const BUBBLE_CLASS =
  'max-w-[92%] whitespace-pre-wrap rounded-xl px-[11px] py-2 leading-[1.45]';

/**
 * Merge transcript records into render items. The hidden system record (the
 * host-injected first-read instruction) marks the next agent reply as the
 * first read — the same rule the dev panel used.
 */
function deriveItems(messages) {
  const items = [];
  const byCall = new Map(); // tool_response records merge into their request's row
  let afterTrigger = false;
  for (const m of messages) {
    if (m.role === 'system') {
      afterTrigger = true; // hidden host instruction — never rendered
      continue;
    }
    if (m.role === 'user') {
      afterTrigger = false;
      items.push({ key: items.length, kind: 'user', text: m.text });
    } else if (m.role === 'agent') {
      items.push({ key: items.length, kind: 'agent', text: m.text ?? '', read: afterTrigger });
      afterTrigger = false;
    } else if (m.role === 'tool_request') {
      if (m.text) items.push({ key: items.length, kind: 'agentPre', text: m.text });
      for (const c of m.calls ?? []) {
        const item = { key: items.length, kind: 'tool', id: c.id, name: c.name, args: c.args, response: null };
        byCall.set(c.id, item);
        items.push(item);
      }
    } else if (m.role === 'tool_response') {
      const item = byCall.get(m.call_id);
      if (item) item.response = { text: m.text, isError: Boolean(m.is_error) };
    }
  }
  return items;
}

export default function Thread({ messages, liveText, statusLine, eventLines, turnMeta, turnError }) {
  const items = useMemo(() => deriveItems(messages), [messages]);
  const mainRef = useRef(null);
  const scroll = () => {
    const el = mainRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };
  useEffect(() => scroll(), [items.length, liveText, eventLines.length, statusLine, turnMeta, turnError]);

  return (
    <main ref={mainRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      {items.map((it) => (it.kind === 'tool' ? <ToolCall key={it.key} {...it} /> : <Message key={it.key} {...it} />))}
      {statusLine && <div className={META_CLASS}>{statusLine}</div>}
      {eventLines.map((line, i) => (
        <div key={`ev${i}`} className={META_CLASS}>
          {line}
        </div>
      ))}
      {liveText !== null && (
        <div className={`${BUBBLE_CLASS} self-start border border-dashed border-line bg-card`}>{liveText}</div>
      )}
      {turnMeta && <div className={META_CLASS}>{turnMeta}</div>}
      {turnError && (
        <div className={`${BUBBLE_CLASS} self-stretch border border-warn bg-errorbg text-warn-ink`}>{turnError}</div>
      )}
    </main>
  );
}
