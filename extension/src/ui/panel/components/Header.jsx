export default function Header({ onNew, onClose }) {
  return (
    <header className="flex items-center justify-between border-b border-line py-3 pl-[18px] pr-3.5">
      <div className="flex items-center gap-2 font-semibold">
        <span className="inline-grid h-5 w-5 place-items-center rounded-[5px] bg-ink text-[11px] text-paper">F</span>
        Fine Print <span className="text-muted">dev</span>
      </div>
      <div className="flex gap-1.5">
        <button title="Start a new thread" onClick={onNew}>
          New
        </button>
        <button title="Keys and settings" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings
        </button>
        <button title="Hide" onClick={onClose} className="h-7 w-7 bg-closebg p-0">
          ✕
        </button>
      </div>
    </header>
  );
}
