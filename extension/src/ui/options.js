import { loadSettings } from '../agent/agent.js';

const $ = (id) => document.getElementById(id);
const KEYS = ['deepseek', 'openrouter', 'microburbs'];

async function load() {
  const s = await loadSettings();
  const { secrets = {} } = await chrome.storage.local.get('secrets');
  $('provider').value = s.provider;
  $('model').value = s.model;
  $('mbSource').value = s.mbSource;
  for (const k of ['budget', 'deposit', 'minYield', 'holdYears']) $(k).value = s.brief[k];
  for (const k of KEYS) $(`key-${k}`).value = secrets[k] ?? '';
}

$('provider').addEventListener('change', () => {
  if ($('provider').value === 'openrouter' && $('model').value === 'deepseek-chat') $('model').value = 'deepseek/deepseek-chat';
  if ($('provider').value === 'deepseek' && $('model').value.includes('/')) $('model').value = 'deepseek-chat';
});

$('save').addEventListener('click', async () => {
  const secrets = Object.fromEntries(KEYS.map((k) => [k, $(`key-${k}`).value.trim()]).filter(([, v]) => v));
  const settings = {
    provider: $('provider').value,
    model: $('model').value.trim(),
    mbSource: $('mbSource').value,
    brief: Object.fromEntries(['budget', 'deposit', 'minYield', 'holdYears'].map((k) => [k, Number($(k).value)])),
  };
  await chrome.storage.local.set({ settings, secrets });
  $('saved').textContent = 'Saved.';
  setTimeout(() => ($('saved').textContent = ''), 1500);
});

load();

// ---------------------------------------------------------------- debug export
/** Every store in the extension's IndexedDB, read generically (whatever version it's at). */
function dumpIndexedDb(name = 'fine-print') {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = async () => {
      const db = req.result;
      const out = { name, version: db.version, stores: {} };
      for (const store of db.objectStoreNames) {
        out.stores[store] = await new Promise((res, rej) => {
          const r = db.transaction(store).objectStore(store).getAll();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      db.close();
      resolve(out);
    };
  });
}

$('export').addEventListener('click', async () => {
  $('exported').textContent = 'Exporting…';
  try {
    const { secrets, ...storage } = await chrome.storage.local.get(null); // never export API keys
    const data = {
      exported_at: new Date().toISOString(),
      extension_version: chrome.runtime.getManifest().version,
      secrets_present: Object.keys(secrets ?? {}).filter((k) => secrets[k]),
      chrome_storage_local: storage,
      indexeddb: await dumpIndexedDb(),
    };
    const json = JSON.stringify(data, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `fine-print-export-${data.exported_at.slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    const counts = Object.entries(data.indexeddb.stores).map(([k, v]) => `${k}: ${v.length}`).join(', ');
    $('exported').textContent = `Downloaded (${Math.round(json.length / 1024)} KB · ${counts})`;
  } catch (e) {
    $('exported').textContent = `Export failed: ${e.message}`;
  }
});
