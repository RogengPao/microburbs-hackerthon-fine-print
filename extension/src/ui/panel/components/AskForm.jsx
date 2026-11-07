import { useState } from 'react';

export default function AskForm({ busy, onSend }) {
  const [value, setValue] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (busy || !value.trim()) return;
    onSend(value);
    setValue('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-end gap-2 border-t border-line bg-card px-3 py-2.5">
      <textarea
        rows={2}
        placeholder="Ask anything about this listing…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        className="flex-1 resize-none border-none bg-transparent outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="h-8 w-8 rounded-full border-none bg-ink p-0 text-paper disabled:opacity-40"
      >
        ↑
      </button>
    </form>
  );
}
