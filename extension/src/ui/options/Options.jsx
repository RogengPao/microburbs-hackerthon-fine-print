import { useEffect, useState } from 'react';
import { loadSettings } from '../../agent/agent.js';

const KEY_FIELDS = ['deepseek', 'openrouter', 'microburbs'];
const BRIEF_FIELDS = ['budget', 'deposit', 'minYield', 'holdYears'];
const LABEL_CLASS = 'my-2 flex flex-col gap-1 text-muted';

const initialForm = { provider: '', model: '', mbSource: '', brief: {}, keys: {} };

export default function Options() {
  const [form, setForm] = useState(initialForm);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      const { secrets = {} } = await chrome.storage.local.get('secrets');
      setForm({
        provider: s.provider,
        model: s.model,
        mbSource: s.mbSource,
        brief: Object.fromEntries(BRIEF_FIELDS.map((k) => [k, s.brief[k] ?? ''])),
        keys: Object.fromEntries(KEY_FIELDS.map((k) => [k, secrets[k] ?? ''])),
      });
    })();
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setBrief = (key, value) => setForm((f) => ({ ...f, brief: { ...f.brief, [key]: value } }));
  const setKey = (key, value) => setForm((f) => ({ ...f, keys: { ...f.keys, [key]: value } }));

  // Same nudge as before: switch the example model when the provider flips.
  const onProvider = (provider) => {
    setForm((f) => {
      let model = f.model;
      if (provider === 'openrouter' && model === 'deepseek-chat') model = 'deepseek/deepseek-chat';
      if (provider === 'deepseek' && model.includes('/')) model = 'deepseek-chat';
      return { ...f, provider, model };
    });
  };

  const save = async () => {
    // empty keys are dropped — clearing a field forgets the key
    const secrets = Object.fromEntries(KEY_FIELDS.map((k) => [k, form.keys[k].trim()]).filter(([, v]) => v));
    const settings = {
      provider: form.provider,
      model: form.model.trim(),
      mbSource: form.mbSource,
      brief: Object.fromEntries(BRIEF_FIELDS.map((k) => [k, Number(form.brief[k])])),
    };
    await chrome.storage.local.set({ settings, secrets });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mx-auto my-8 max-w-[560px] px-4">
      <h1 className="mb-2 text-[26px] font-bold">Fine Print settings</h1>
      <p className="text-muted">Stored in this browser only (chrome.storage.local). Never committed.</p>

      <fieldset className="mb-4 rounded-xl border border-line bg-card px-3.5 py-3">
        <legend className="px-1 font-semibold">LLM</legend>
        <label className={LABEL_CLASS}>
          Provider
          <select value={form.provider} onChange={(e) => onProvider(e.target.value)}>
            <option value="deepseek">DeepSeek</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Model
          <input
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="deepseek-chat  ·  or e.g. deepseek/deepseek-chat on OpenRouter"
          />
        </label>
        <label className={LABEL_CLASS}>
          DeepSeek API key
          <input type="password" autoComplete="off" value={form.keys.deepseek ?? ''} onChange={(e) => setKey('deepseek', e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          OpenRouter API key
          <input type="password" autoComplete="off" value={form.keys.openrouter ?? ''} onChange={(e) => setKey('openrouter', e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="mb-4 rounded-xl border border-line bg-card px-3.5 py-3">
        <legend className="px-1 font-semibold">Microburbs</legend>
        <label className={LABEL_CLASS}>
          Source
          <select value={form.mbSource} onChange={(e) => set('mbSource', e.target.value)}>
            <option value="proxy">Demo proxy (uses your Chrome session — visit microburbs-api-demos.vercel.app first)</option>
            <option value="api">Hackathon API (team key)</option>
          </select>
        </label>
        <label className={LABEL_CLASS}>
          Team key
          <input type="password" autoComplete="off" value={form.keys.microburbs ?? ''} onChange={(e) => setKey('microburbs', e.target.value)} />
        </label>
      </fieldset>

      <fieldset className="mb-4 rounded-xl border border-line bg-card px-3.5 py-3">
        <legend className="px-1 font-semibold">Investor brief</legend>
        <label className={LABEL_CLASS}>
          Budget ($)
          <input type="number" value={form.brief.budget ?? ''} onChange={(e) => setBrief('budget', e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Deposit ($)
          <input type="number" value={form.brief.deposit ?? ''} onChange={(e) => setBrief('deposit', e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Minimum gross yield (%)
          <input type="number" step="0.1" value={form.brief.minYield ?? ''} onChange={(e) => setBrief('minYield', e.target.value)} />
        </label>
        <label className={LABEL_CLASS}>
          Hold (years)
          <input type="number" value={form.brief.holdYears ?? ''} onChange={(e) => setBrief('holdYears', e.target.value)} />
        </label>
      </fieldset>

      <button onClick={save}>Save</button> <span className="text-muted">{saved ? 'Saved.' : ''}</span>
    </div>
  );
}
