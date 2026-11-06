// hivemind-runtime (JS port of v0.3.2) — stateless agent-execution runtime.
//
// The runtime owns the INTRA-turn step loop (runTurn: input in, all steps and tool
// rounds, output out — a pure function over the transcript); the host owns
// INTER-turn flow. The transcript is the only state.

export const VERSION = '0.3.2-js.0';

export { assemble, estimateTokens, PENDING_PLACEHOLDER, TRUNCATION_NOTICE } from './assemble.js';
export { ask, RESULT_TOOL } from './ask.js';
export {
  agentSnapshot,
  assemblyPolicy,
  fingerprint,
  message,
  SCHEMA_VERSION,
  stepResult,
  toolCall,
  toolSchema,
  usage,
} from './contract.js';
export { ConnectionError, errorEnvelope, errorInfo, HttpError } from './errors.js';
export { DEFAULT_RETRY, MAX_MALFORMED_RECOVERIES, MAX_TOOL_STEPS, resumeTurn, runTurn, toolOutcome } from './loop.js';
export { adapterFor, DeepSeekAdapter, MockAdapter, OpenAIDialectAdapter, OpenRouterAdapter } from './providers/index.js';
export { err, tool, ToolRegistry } from './registry.js';
export { IndexedDbTranscript, MemoryTranscript, RecordTranscript } from './stores.js';
export { declarativeTool, parseManifest } from './tools/declarative.js';
export { AllowAllEgressPolicy, AllowlistEgressPolicy, DenyAllEgressPolicy } from './tools/egress.js';
export * from './tools/errors.js';
export { AllowlistHttpClient } from './tools/http.js';
export { ChromeStorageSecretProvider, ResolvedSecrets, StaticSecretProvider } from './tools/secrets.js';
export { validate } from './validate.js';
