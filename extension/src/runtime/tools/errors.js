// Typed tool failures + the err() envelope. Port of tools/errors.py.
// A tool failure is something the MODEL recovers from, not a turn failure. Every
// error carries error_code, hint and retryable, and renders to the same envelope as
// a built-in failure — so the model can't tell the two apart.

export function errDict(message, { hint = '', retryable = false, error_code = 'tool_error', ...metadata } = {}) {
  const out = { error: message, hint, retryable, error_code };
  if (Object.keys(metadata).length) out.metadata = metadata;
  return out;
}

export function err(message, opts = {}) {
  return JSON.stringify(errDict(message, opts));
}

export class ToolError extends Error {
  static errorCode = 'tool_error';
  static retryable = false;
  static defaultHint = '';
  /** Did anything reach upstream before this was thrown? null = "may have run" (the unsafe reading). */
  static executed = null;

  constructor(message, { hint, retryable, error_code, executed, ...metadata } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.hint = hint ?? this.constructor.defaultHint;
    this.retryable = retryable ?? this.constructor.retryable;
    this.errorCode = error_code ?? this.constructor.errorCode;
    this.executed = executed ?? this.constructor.executed;
    this.metadata = metadata;
  }

  envelope() {
    return errDict(this.message, { hint: this.hint, retryable: this.retryable, error_code: this.errorCode, ...this.metadata });
  }
}

/** Malformed manifest — raised at LOAD time, never in a live turn. */
export class ManifestError extends ToolError {
  static errorCode = 'manifest_error';
  static executed = false;
}

/** A request to a host outside the tool's effective allowlist. */
export class EgressBlockedError extends ToolError {
  static errorCode = 'egress_blocked';
  static defaultHint = 'this tool may only reach the hosts declared in its manifest';
}

export class SecretUnavailableError extends ToolError {
  static errorCode = 'secret_unavailable';
  static defaultHint = 'the credential for this tool is not configured';
  static executed = false;
}

export class ToolTimeoutError extends ToolError {
  static errorCode = 'tool_timeout';
  static retryable = true;
  static defaultHint = 'the upstream system did not respond in time; try again shortly';
}

/** A declarative request template could not be rendered (never sent). */
export class TemplateError extends ToolError {
  static errorCode = 'template_error';
  static executed = false;
}

/** The upstream API answered with a non-success status. */
export class UpstreamError extends ToolError {
  static errorCode = 'upstream_error';
}

export class InvalidArgumentsError extends ToolError {
  static errorCode = 'invalid_arguments';
  static retryable = true;
  static executed = false;
  static defaultHint = 're-issue the call with arguments matching the tool schema';
}
