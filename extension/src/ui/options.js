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
