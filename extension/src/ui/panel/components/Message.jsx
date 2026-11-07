import { renderMarkdown } from '../../markdown.js';

const BASE = 'whitespace-pre-wrap rounded-xl px-[11px] py-2 leading-[1.45] max-w-[92%]';

/**
 * One chat item. User = dark bubble; agent = Markdown right on the page (no bubble,
 * like ChatGPT/Claude). renderMarkdown escapes ALL HTML first and only emits a fixed
 * set of tags + http(s) links, so the model can't inject markup.
 */
export default function Message({ kind, text }) {
  if (kind === 'user') {
    return <div className={`${BASE} shrink-0 self-end rounded-br bg-ink text-paper`}>{text}</div>;
  }
  if (kind === 'agent' || kind === 'agentPre') {
    return (
      <div
        className={`md shrink-0 self-stretch px-0.5 text-[13.5px] leading-[1.6] ${kind === 'agentPre' ? 'text-muted' : ''}`}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(text ?? '') }}
      />
    );
  }
  // error
  return <div className={`${BASE} shrink-0 self-stretch border border-warn bg-errorbg text-warn-ink`}>{text}</div>;
}
