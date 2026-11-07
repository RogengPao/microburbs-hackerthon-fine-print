import Icon from '../../icons.jsx';
import { openPage } from '../../open-page.js';

const k = (n) => `$${Math.round(n / 1000)}K`;

/**
 * Two-row header (layout + icons from Carlos's Figma redesign, in the panel's palette):
 * brand and actions on top; the investor's brief as a strip underneath (click to edit).
 */
export default function Header({ brief, inSetup, onBrief, onNew, onClose }) {
  const criteria = brief?.onboarded && brief.budget ? [`${k(brief.budget)} budget`, `≥${brief.minYield}% yield`, `${brief.holdYears}y hold`] : ['brief: not set'];
  return (
    <header>
      <div className="head-row">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 9.5V2.5h8M2 6h5" fill="none" stroke="#FBFAF6" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          <span className="brand-name">Fine Print</span>
          {inSetup && <span className="crumb">/ setup</span>}
        </div>
        <div className="actions">
          <button className="head-btn" title="Open your shortlist" onClick={() => openPage('src/ui/shortlist.html')}>
            <Icon name="bookmark" size={14} />
            Shortlist
          </button>
          <button className="head-btn" title="Start a new chat" onClick={onNew}>
            New
          </button>
          <button className="icon-btn" title="Keys and settings" aria-label="Settings" onClick={() => openPage('options.html')}>
            <Icon name="settings-2" size={17} />
          </button>
          <button className="icon-btn" title="Hide (F)" aria-label="Hide" onClick={onClose}>
            <Icon name="x" size={17} />
          </button>
        </div>
      </div>
      <div className="head-sub">
        <span className="head-eyebrow">Your brief</span>
        <button className="brief-strip" title="Edit your investor brief" onClick={onBrief}>
          {criteria.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </button>
      </div>
    </header>
  );
}
