import { useMemo } from 'react';
import { TOOL_LABELS } from '../../../agent/agent.js';

/** One agent tool call: a collapsible row with the response filled in when it arrives. */
export default function ToolCall({ id, name, args, response }) {
  const shown = useMemo(() => {
    if (!response) return 'running…';
    const raw = response.text ?? '';
    let pretty = raw;
    try {
      pretty = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      /* not JSON */
    }
    return pretty.length > 6000 ? `${pretty.slice(0, 6000)}\n… (${pretty.length} chars)` : pretty;
  }, [response]);

  const isError = Boolean(response?.isError);
  return (
    <details
      data-call={id}
      className={`shrink-0 self-stretch rounded-lg border bg-toolbg font-mono text-[11px] ${isError ? 'border-warn' : 'border-line'}`}
    >
      <summary className="flex cursor-pointer gap-2 p-1.5 px-2">
        {/* people see the label ("Checking rentals nearby"); name + args sit in the body */}
        <span className="flex-1 text-brand">{TOOL_LABELS[name] ?? name}</span>
        <span className={isError ? 'text-warn-ink' : 'text-muted'}>{response ? (isError ? 'error' : 'ok') : '…'}</span>
      </summary>
      <div className="border-t border-line px-2 pt-1.5 text-muted">{`${name} ${JSON.stringify(args ?? {})}`}</div>
      <pre className="m-0 max-h-[260px] overflow-auto whitespace-pre-wrap p-2">{shown}</pre>
    </details>
  );
}
