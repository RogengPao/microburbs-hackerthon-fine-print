import { TOOL_LABELS } from '../../../agent/agent.js';

/**
 * One agent tool call, as people see it: "✓ Checking rentals nearby". Raw arguments and
 * results are debug data — not shown (Settings → Export data has the full transcript).
 */
export default function ToolCall({ id, name, response }) {
  const label = TOOL_LABELS[name] ?? name;
  const state = !response ? '…' : response.isError ? '✕' : '✓';
  return (
    <div data-call={id} className={`shrink-0 self-start font-mono text-[10.5px] ${response?.isError ? 'text-warn-ink' : 'text-muted'}`}>
      {state} {label}
    </div>
  );
}
