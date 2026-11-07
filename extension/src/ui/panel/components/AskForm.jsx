import { useEffect, useRef, useState } from 'react';

/** The composer: grows with the text (up to 120 px), Enter sends, Shift+Enter is a new line. */
export default function AskForm({ busy, onSend }) {
  const [value, setValue] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(120, t.scrollHeight)}px`;
  }, [value]);

  const submit = (e) => {
    e.preventDefault();
    if (busy || !value.trim()) return;
    onSend(value);
    setValue('');
  };

  return (
    <form id="ask" onSubmit={submit}>
      <textarea
        id="input"
        ref={ref}
        rows={1}
        placeholder="Ask anything about this listing…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) submit(e);
        }}
      />
      <button type="submit" id="send" aria-label="Send" disabled={busy || !value.trim()}>
        <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12V2M3 6l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}
