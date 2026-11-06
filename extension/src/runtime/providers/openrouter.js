// OpenRouter adapter — multi-provider gateway. Port of providers/openrouter.py.
//  - model is REQUIRED and namespaced ("deepseek/deepseek-chat") — no silent default
//  - cost comes from the wire: {usage: {include: true}} is always sent
//  - cache reads under prompt_tokens_details.cached_tokens; writes not reported
//  - reasoning via {reasoning: {...}}; contract effort "max" maps to "high"; explicit
//    enabled/disabled always sent
//  - streaming keepalive comments (": OPENROUTER PROCESSING") fail the data: filter
//  - attribution headers are constructor args, never message content

import { usage as newUsage } from '../contract.js';
import { OpenAIDialectAdapter } from './openai-dialect.js';

export class OpenRouterAdapter extends OpenAIDialectAdapter {
  static API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  static REASONING_FIELD = 'reasoning';
  static STREAM_OPTIONS = null; // usage.include already covers streaming usage
  static EXTRA_BODY = { usage: { include: true } };

  constructor({ appUrl = null, appTitle = null, providerRouting = null, ...rest } = {}) {
    super(rest);
    this.appUrl = appUrl;
    this.appTitle = appTitle;
    this.providerRouting = providerRouting; // sent as body.provider when set
  }

  headers() {
    const h = super.headers();
    if (this.appUrl) h['HTTP-Referer'] = this.appUrl;
    if (this.appTitle) h['X-Title'] = this.appTitle;
    return h;
  }

  resolveModel(params) {
    if (!params.model) throw new Error('OpenRouter requires an explicit namespaced model id (e.g. "deepseek/deepseek-chat") in params.model');
    return params.model;
  }

  generationParams(body, params) {
    if (this.providerRouting) body.provider = this.providerRouting;
    if (params.thinking) {
      if (params.reasoning_effort) body.reasoning = { effort: params.reasoning_effort === 'max' ? 'high' : params.reasoning_effort };
      else body.reasoning = { enabled: true };
    } else {
      body.reasoning = { enabled: false };
      this.samplingPassthrough(body, params);
    }
  }

  parseUsage(u) {
    const usage = newUsage({
      input_tokens: u.prompt_tokens ?? 0,
      output_tokens: u.completion_tokens ?? 0,
      cache_read_tokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    });
    if (u.cost !== undefined && u.cost !== null) usage.cost = u.cost;
    return usage;
  }
}
