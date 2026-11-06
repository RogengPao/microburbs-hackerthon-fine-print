// Provider-transport errors + the error envelope + retry classification.
// Port of loop.error_envelope / loop.error_info. Python classified
// requests.HTTPError / ConnectionError; fetch has no such types, so adapters
// throw HttpError (non-2xx) and ConnectionError (network failure / timeout).

/** A provider answered with a non-success status. */
export class HttpError extends Error {
  constructor(status, body = null, message = `HTTP ${status}`) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

/** The request never got a response (DNS, dropped connection, abort/timeout). */
export class ConnectionError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'ConnectionError';
    this.cause = cause;
  }
}

/**
 * The standardised self-healing tool-error envelope. Key order matters: records
 * must stay byte-identical across hosts.
 */
export function errorEnvelope(message, { hint = '', retryable = false, error_code = 'tool_error' } = {}) {
  return JSON.stringify({ error: message, hint, retryable, error_code });
}

/**
 * Structured execution-error object {code, message, retryable, metadata}.
 * `retryable` is also the loop's retry classification: HTTP 429/5xx and dropped
 * connections retry; other 4xx and unknown errors never do.
 */
export function errorInfo(e) {
  if (e instanceof HttpError) {
    const status = e.status;
    return {
      code: status ? `http_${status}` : 'http_error',
      message: e.message,
      retryable: Boolean(status && (status === 429 || status >= 500)),
      metadata: { status, body: e.body === null ? null : String(e.body).slice(0, 300) },
    };
  }
  if (e instanceof ConnectionError) {
    return { code: 'connection_error', message: e.message, retryable: true };
  }
  return { code: e?.name ?? 'Error', message: String(e?.message ?? e), retryable: false };
}
