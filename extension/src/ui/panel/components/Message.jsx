const BASE = 'whitespace-pre-wrap rounded-xl px-[11px] py-2 leading-[1.45] max-w-[92%]';

/** One chat bubble. Kind mirrors the transcript record roles that render. */
export default function Message({ kind, text, read }) {
  if (kind === 'user') {
    return <div className={`${BASE} self-end rounded-br bg-ink text-paper`}>{text}</div>;
  }
  if (kind === 'agentPre') {
    // the agent's preamble before its tool calls
    return <div className={`${BASE} self-start border border-line bg-card italic text-muted`}>{text}</div>;
  }
  if (kind === 'agent') {
    // first read: plain-text estimates + warnings, full width
    return read ? (
      <div className="w-full self-stretch whitespace-pre-wrap rounded-[14px] border border-line bg-card px-4 py-3.5 text-[13px] leading-[1.55]">
        {text}
      </div>
    ) : (
      <div className={`${BASE} self-start border border-line bg-card`}>{text}</div>
    );
  }
  // error
  return <div className={`${BASE} self-stretch border border-warn bg-errorbg text-warn-ink`}>{text}</div>;
}
