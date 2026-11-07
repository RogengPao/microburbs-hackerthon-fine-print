import { useEffect, useRef, useState } from 'react';
import { paintYieldTicks } from '../../setup.js';

const HOLD = [3, 5, 10, 15];
const num = (s) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0;
const commas = (n) => (n ? Math.round(n).toLocaleString('en-AU') : '');

/** Onboarding (design A "Set your brief"): the brief every listing is scored against. */
export default function Setup({ brief, listingHeading, onSave }) {
  const [budget, setBudget] = useState(commas(brief?.budget));
  const [deposit, setDeposit] = useState(commas(brief?.deposit));
  const [minYield, setMinYield] = useState(Number(brief?.minYield) > 0 ? brief.minYield : 4);
  const [hold, setHold] = useState(HOLD.includes(Number(brief?.holdYears)) ? Number(brief.holdYears) : 10);
  const range = useRef(null);
  const ticks = useRef(null);
  const scale = useRef(null);
  useEffect(() => {
    if (range.current) paintYieldTicks(range.current, ticks.current, scale.current);
  }, [minYield]);

  const b = num(budget);
  const d = num(deposit);
  const valid = b > 0 && d > 0 && d < b;
  const save = () => valid && onSave({ budget: b, deposit: d, minYield: Number(minYield), holdYears: hold });

  return (
    <section className="setup" onKeyDown={(e) => e.key === 'Enter' && e.target.tagName === 'INPUT' && save()}>
      <div className="setup-body">
        {listingHeading && (
          <div className="setup-listing stagger">
            <div className="ov-who">
              <div className="ov-address">{listingHeading}</div>
              <div className="ov-id">this listing</div>
            </div>
            <span className="ov-live">signals ready</span>
          </div>
        )}
        <div className="setup-intro stagger">
          <h2 className="setup-title">Set your brief.</h2>
          <p>Every listing you open gets scored against it. Four inputs, once.</p>
        </div>
        <div className="setup-row stagger">
          <label className="field">
            <span className="field-label">Budget</span>
            <span className="input-wrap">
              <span className="cur">$</span>
              <input inputMode="numeric" placeholder="800,000" autoComplete="off" value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={() => setBudget(commas(num(budget)))} />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Deposit</span>
            <span className="input-wrap">
              <span className="cur">$</span>
              <input inputMode="numeric" placeholder="160,000" autoComplete="off" value={deposit} onChange={(e) => setDeposit(e.target.value)} onBlur={() => setDeposit(commas(num(deposit)))} />
              <span className="suffix">{b && d ? `${Math.round((d / b) * 100)}%` : ''}</span>
            </span>
          </label>
        </div>
        <div className="field stagger">
          <div className="field-head">
            <span className="field-label">Min gross yield</span>
            <strong>{Number(minYield).toFixed(1)}%</strong>
          </div>
          <div className="yield-slider">
            <div className="ticks" ref={ticks} aria-hidden="true" />
            <input ref={range} type="range" min="3" max="6" step="0.1" value={minYield} aria-label="Minimum gross yield" onChange={(e) => setMinYield(Number(e.target.value))} />
          </div>
          <div className="yield-scale" ref={scale} aria-hidden="true" />
        </div>
        <div className="field stagger">
          <span className="field-label">Hold period</span>
          <div className="segmented">
            {HOLD.map((y) => (
              <button type="button" key={y} className={y === hold ? 'on' : ''} onClick={() => setHold(y)}>
                {y === 15 ? '15y+' : `${y}y`}
              </button>
            ))}
          </div>
        </div>
        <div className="queued stagger">
          <div className="queued-head">
            <span>What we check for every listing</span>
            <span>Microburbs</span>
          </div>
          <div className="queued-rows">
            <div className="queued-row"><span><b>✓</b> Estimated value</span><span>value · range · confidence</span></div>
            <div className="queued-row"><span><b>✓</b> Agency&apos;s quoting record</span><span>likely sale price</span></div>
            <div className="queued-row"><span><b>✓</b> Rentals nearby</span><span>rent · yield · weekly cost</span></div>
            <div className="queued-row"><span><b>✓</b> New homes in the pipeline</span><span>how many · when they land</span></div>
            <div className="queued-row"><span>+ more</span><span>vacancy · hazards · sales</span></div>
          </div>
        </div>
      </div>
      <div className="setup-foot-bar">
        <button className="cta" type="button" disabled={!valid} onClick={save}>
          Save my brief <kbd>⏎</kbd>
        </button>
        <p className="setup-foot">Stored on this device · data by Microburbs · not financial advice</p>
      </div>
    </section>
  );
}
