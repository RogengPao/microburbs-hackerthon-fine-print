/** Brand · new thread · shortlist · settings · brief chip (opens onboarding) · close — design B header. */
export default function Header({ brief, inSetup, onBrief, onNew, onClose }) {
  const chip = brief?.onboarded ? `$${Math.round(brief.budget / 1000)}K · ≥${brief.minYield}% · ${brief.holdYears}y` : 'brief: not set';
  return (
    <header>
      <div className="brand">
        <span className="mark" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 9.5V2.5h8M2 6h5" fill="none" stroke="#FBFAF6" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </span>
        <span className="brand-name">Fine Print</span>
        {inSetup && <span className="crumb">/ setup</span>}
      </div>
      <div className="actions">
        <button className="icon-btn" title="Start a new chat" aria-label="Start a new chat" onClick={onNew}>
          <svg width="13" height="13" viewBox="0 0 14 14"><path d="M7 2.5v9M2.5 7h9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <button className="icon-btn" title="Your shortlist" aria-label="Your shortlist" onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/shortlist.html') })}>
          <svg width="12" height="12" viewBox="0 0 13 13"><path d="M3 1.5h7v10l-3.5-2.5L3 11.5z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
        <button className="icon-btn" title="Keys and settings" aria-label="Settings" onClick={() => chrome.runtime.openOptionsPage()}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 4h6M10.5 4H12M2 10h1.5M6 10h6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="9.2" cy="4" r="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="4.8" cy="10" r="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>
        </button>
        <button className="chip" title="Edit your investor brief" onClick={onBrief}>{chip}</button>
        <button className="icon-btn" title="Hide" aria-label="Hide" onClick={onClose}>
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        </button>
      </div>
    </header>
  );
}
