import { useState } from 'react';

const HOLD = [3, 5, 10, 15];
const num = (s) => Number(String(s ?? '').replace(/[^\d.]/g, '')) || 0;
const commas = (n) => (n ? Math.round(n).toLocaleString('en-AU') : '');

/** Onboarding (design A, placeholder styling): the investor brief every listing is scored against. */
export default function Setup({ brief, onSave }) {
  const [budget, setBudget] = useState(commas(brief?.budget));
  const [deposit, setDeposit] = useState(commas(brief?.deposit));
  const [minYield, setMinYield] = useState(Number(brief?.minYield) > 0 ? brief.minYield : 4);
  const [hold, setHold] = useState(HOLD.includes(brief?.holdYears) ? brief.holdYears : 10);
  const b = num(budget);
  const d = num(deposit);
  const valid = b > 0 && d > 0 && d < b;
  return (
    <section className="setup min-h-0 flex-1">
      <h2 className="setup-title">Set your brief.</h2>
      <p className="text-muted">Every listing you open gets scored against it. Four inputs, once.</p>
      <div className="setup-row">
        <label>
          Budget
          <input inputMode="numeric" placeholder="e.g. 800,000" value={budget} onChange={(e) => setBudget(e.target.value)} onBlur={() => setBudget(commas(num(budget)))} />
        </label>
        <label>
          Deposit {b && d ? `· ${Math.round((d / b) * 100)}%` : ''}
          <input inputMode="numeric" placeholder="e.g. 160,000" value={deposit} onChange={(e) => setDeposit(e.target.value)} onBlur={() => setDeposit(commas(num(deposit)))} />
        </label>
      </div>
      <label>
        Min gross yield <strong>{Number(minYield).toFixed(1)}%</strong>
        <input type="range" min="3" max="6" step="0.1" value={minYield} onChange={(e) => setMinYield(Number(e.target.value))} />
      </label>
      <div className="setup-label">Hold period</div>
      <div className="segmented">
        {HOLD.map((y) => (
          <button key={y} className={y === hold ? 'on' : ''} onClick={() => setHold(y)}>
            {y === 15 ? '15y+' : `${y}y`}
          </button>
        ))}
      </div>
      <button className="primary" disabled={!valid} onClick={() => onSave({ budget: b, deposit: d, minYield: Number(minYield), holdYears: hold })}>
        Save brief
      </button>
      <p className="setup-foot text-muted">Stored locally · data by Microburbs · not financial advice</p>
    </section>
  );
}
