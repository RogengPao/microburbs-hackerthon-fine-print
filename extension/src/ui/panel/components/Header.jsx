/** Brief chip (opens onboarding), Shortlist (opens the dashboard tab), New, Settings, close. */
export default function Header({ brief, onBrief, onNew, onClose }) {
  const chip = brief?.onboarded ? `$${Math.round(brief.budget / 1000)}K · ≥${brief.minYield}% · ${brief.holdYears}y` : 'brief: not set';
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line py-3 pl-[18px] pr-3.5">
      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold">
        <span className="inline-grid h-5 w-5 place-items-center rounded-[5px] bg-ink text-[11px] text-paper">F</span>
        Fine Print
      </div>
      <div className="flex min-w-0 gap-1 whitespace-nowrap [&>button]:px-2">
        <button title="Edit your investor brief" onClick={onBrief} className="bg-closebg font-mono text-[10.5px]">
          {chip}
        </button>
        <button title="Open your shortlist" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/shortlist.html') })}>
          Shortlist
        </button>
        <button title="Start a new thread" onClick={onNew}>
          New
        </button>
        <button title="Keys and settings" onClick={() => chrome.runtime.openOptionsPage()}>
          ⚙
        </button>
        <button title="Hide" onClick={onClose} className="h-7 w-7 bg-closebg p-0">
          ✕
        </button>
      </div>
    </header>
  );
}
