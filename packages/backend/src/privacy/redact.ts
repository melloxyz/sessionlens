const REDACTED = '[REDACTED]';

// Object keys whose values are always masked, regardless of content
const SENSITIVE_KEY_RE =
  /^(?:token|key|secret|password|passwd|pass|auth|credential|api_key|apikey|access_token|refresh_token|private_key|client_secret|bearer)$/i;

// [source, flags] pairs — new RegExp created each call to avoid /g lastIndex state
const TEXT_PATTERN_SOURCES: ReadonlyArray<readonly [string, string]> = [
  // Anthropic API keys
  [String.raw`sk-ant-[a-zA-Z0-9_-]{20,}`, 'g'],
  // OpenAI API keys
  [String.raw`sk-[a-zA-Z0-9]{20,}`, 'g'],
  // AWS Access Key IDs
  [String.raw`AKIA[0-9A-Z]{16}`, 'g'],
  // JWT tokens (three base64url segments)
  [String.raw`eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+`, 'g'],
  // GitHub personal/OAuth/server/refresh tokens
  [String.raw`gh[opsr]_[a-zA-Z0-9]{36,}`, 'g'],
  // Slack tokens
  [String.raw`xox[bpoa]-[0-9A-Za-z-]{24,}`, 'g'],
  // Env-style assignments with sensitive var names (e.g. TOKEN=abc123, API_KEY="xyz")
  [
    String.raw`(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_TOKEN|PRIVATE_KEY)\s*=\s*['"]?[^\s'"]{8,}['"]?`,
    'gi',
  ],
];

export function redactText(text: string): string {
  let result = text;
  for (const [src, flags] of TEXT_PATTERN_SOURCES) {
    result = result.replace(new RegExp(src, flags), REDACTED);
  }
  return result;
}

export function redactInput(input: unknown): unknown {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') return redactText(input);
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(redactInput);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY_RE.test(k) ? REDACTED : redactInput(v);
  }
  return out;
}
