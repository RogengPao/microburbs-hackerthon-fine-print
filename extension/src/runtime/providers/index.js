// Provider adapters, resolved by name. Port of providers/__init__.py.
//   adapterFor(agent, {apiKey})                  // provider from the snapshot
//   adapterFor('openrouter', {apiKey, appTitle})
// Browser difference: there is no environment, so real providers take `apiKey`
// explicitly (the host reads it from chrome.storage.local). Anthropic is not ported
// (EXPERIMENTAL/untested upstream).

import { DeepSeekAdapter } from './deepseek.js';
import { MockAdapter } from './mock.js';
import { OpenAIDialectAdapter } from './openai-dialect.js';
import { OpenRouterAdapter } from './openrouter.js';

export const FACTORIES = {
  deepseek: DeepSeekAdapter,
  openrouter: OpenRouterAdapter,
  mock: MockAdapter,
};

export function adapterFor(source, opts = {}) {
  const provider = typeof source === 'string' ? source : source.provider;
  const Adapter = FACTORIES[provider];
  if (!Adapter) throw new Error(`unknown provider ${JSON.stringify(provider)} — known: ${Object.keys(FACTORIES).sort().join(', ')}`);
  return new Adapter(opts);
}

export { DeepSeekAdapter, MockAdapter, OpenAIDialectAdapter, OpenRouterAdapter };
