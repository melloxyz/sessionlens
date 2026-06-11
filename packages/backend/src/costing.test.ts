import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionCost } from './costing.js';
import type { RawSession, SessionDataQuality } from './adapters/types.js';

function makeSession(overrides: Partial<RawSession>): RawSession {
  return {
    sessionId: 'test-session',
    provider: 'anthropic',
    cli: 'claude',
    projectPath: null,
    model: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationMs: null,
    totalCostUsd: null,
    sourceConfidence: 'HIGH',
    messages: [],
    usageEvents: [],
    ...overrides,
  };
}

function dataQuality(cost: SessionDataQuality['cost']): SessionDataQuality {
  return {
    messages: 'real',
    tokens: cost === 'unknown' ? 'unavailable' : 'real',
    cost,
    tools: 'unavailable',
    files: 'unavailable',
    model: 'unknown',
    projectPath: 'real',
  };
}

test('resolveSessionCost: adapter-declared estimated cost → costSource estimated', () => {
  const raw = makeSession({
    cli: 'claude',
    provider: 'anthropic',
    totalCostUsd: 0.005,
    dataQuality: dataQuality('estimated'),
  });
  const result = resolveSessionCost(raw);
  assert.equal(result.costSource, 'estimated');
  assert.equal(result.totalCostUsd, 0.005);
});

test('resolveSessionCost: adapter-declared actual cost → costSource actual', () => {
  const raw = makeSession({
    cli: 'opencode',
    provider: 'opencode',
    totalCostUsd: 0.012,
    dataQuality: dataQuality('actual'),
  });
  const result = resolveSessionCost(raw);
  assert.equal(result.costSource, 'actual');
  assert.equal(result.totalCostUsd, 0.012);
});

test('resolveSessionCost: no cost and no tokens → costSource unknown', () => {
  const raw = makeSession({
    cli: 'commandcode',
    provider: 'anthropic',
    totalCostUsd: null,
    dataQuality: dataQuality('unknown'),
  });
  const result = resolveSessionCost(raw);
  assert.equal(result.costSource, 'unknown');
  assert.equal(result.totalCostUsd, null);
});

test('resolveSessionCost: no dataQuality and cost present → costSource actual (backward-compat)', () => {
  const raw = makeSession({
    totalCostUsd: 0.003,
    dataQuality: undefined,
  });
  const result = resolveSessionCost(raw);
  assert.equal(result.costSource, 'actual');
  assert.equal(result.totalCostUsd, 0.003);
});

test('resolveSessionCost: estimated cost from codex is not labeled actual', () => {
  const raw = makeSession({
    cli: 'codex',
    provider: 'openai',
    model: 'gpt-5.4',
    totalCostUsd: 0.0082,
    dataQuality: dataQuality('estimated'),
  });
  const result = resolveSessionCost(raw);
  assert.equal(result.costSource, 'estimated');
  assert.notEqual(result.costSource, 'actual');
});

test('resolveSessionCost: codex null totalCostUsd with no usage data → unknown, never actual', () => {
  // After T2.4 the Codex adapter sets totalCostUsd: null; sessions with no token data
  // should fall through to 'unknown', not be incorrectly promoted to 'actual'.
  const raw = makeSession({
    cli: 'codex',
    provider: 'openai',
    model: 'gpt-5.4',
    totalCostUsd: null,
    usageEvents: [],
    modelUsage: undefined,
    dataQuality: dataQuality('estimated'),
  });
  const result = resolveSessionCost(raw);
  assert.notEqual(result.costSource, 'actual');
  assert.equal(result.costSource, 'unknown');
  assert.equal(result.totalCostUsd, null);
});
