// DeepSeek adapter — the reference adapter. Port of providers/deepseek.py.
// Only DeepSeek's quirks live here; wire machinery is OpenAIDialectAdapter.
//  - thinking DEFAULTS TO ENABLED on deepseek-v4-pro, so the explicit state is
//    always sent: {thinking: {type: enabled|disabled}} (+ reasoning_effort)
//  - reasoning_content must be replayed during tool-call turns (400 without it)
//  - temperature/top_p/penalties are ignored in thinking mode (omitted for honesty)
//  - cost from a local pricing table; unknown model => cost null, never invented

import { usage as newUsage } from '../contract.js';
import { OpenAIDialectAdapter } from './openai-dialect.js';

// USD per 1M tokens
export const PRICING = {
  'deepseek-chat': { input: 0.27, cache_hit: 0.07, output: 1.1 },
};

export class DeepSeekAdapter extends OpenAIDialectAdapter {
  static API_URL = 'https://api.deepseek.com/chat/completions';
  static DEFAULT_MODEL = 'deepseek-chat';
  static REASONING_FIELD = 'reasoning_content';

  generationParams(body, params) {
    const thinking = Boolean(params.thinking);
    body.thinking = { type: thinking ? 'enabled' : 'disabled' };
    if (thinking) {
      if (params.reasoning_effort) body.reasoning_effort = params.reasoning_effort;
    } else {
      this.samplingPassthrough(body, params);
    }
  }

  parseUsage(u, model) {
    const input = u.prompt_tokens ?? 0;
    const output = u.completion_tokens ?? 0;
    const hit = u.prompt_cache_hit_tokens ?? 0;
    const usage = newUsage({
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: hit,
      cache_write_tokens: u.prompt_cache_miss_tokens ?? 0,
    });
    const rates = PRICING[model ?? ''];
    if (rates) usage.cost = ((input - hit) * rates.input + hit * rates.cache_hit + output * rates.output) / 1e6;
    return usage;
  }
}
