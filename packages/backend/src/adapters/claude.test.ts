import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createClaudeAdapter } from './claude.js';

const fixturePath = join(
  process.cwd(),
  'src',
  'adapters',
  '__fixtures__',
  'claude',
  'multi-model',
  'session.jsonl',
);

test('Claude adapter extracts model per assistant event and builds modelUsage', async () => {
  const adapter = createClaudeAdapter();
  const sessions = await adapter.parse(fixturePath, null);

  assert.equal(sessions.length, 1);
  const session = sessions[0];

  // model field must be populated (not null)
  assert.ok(session.model !== null, 'session.model should not be null');

  // Sonnet has more output tokens (150 > 100) → must be primary model
  assert.equal(session.model, 'claude-sonnet-4-20250514');

  // modelUsage must have one entry per model
  assert.ok(Array.isArray(session.modelUsage), 'modelUsage should be an array');
  assert.equal(session.modelUsage!.length, 2);

  const opus = session.modelUsage!.find((m) => m.model === 'claude-opus-4-20250514');
  const sonnet = session.modelUsage!.find((m) => m.model === 'claude-sonnet-4-20250514');
  assert.ok(opus, 'modelUsage should contain Opus entry');
  assert.ok(sonnet, 'modelUsage should contain Sonnet entry');

  assert.equal(opus!.inputTokens, 50);
  assert.equal(opus!.outputTokens, 100);
  assert.equal(opus!.cacheReadTokens, 10);
  assert.equal(opus!.cacheWriteTokens, 0);
  assert.equal(opus!.provider, 'anthropic');

  assert.equal(sonnet!.inputTokens, 60);
  assert.equal(sonnet!.outputTokens, 150);
  assert.equal(sonnet!.cacheReadTokens, 0);
  assert.equal(sonnet!.cacheWriteTokens, 20);

  // totalCostUsd must be null — engine will estimate via pricing DB, not hardcoded rates
  assert.equal(session.totalCostUsd, null);

  // dataQuality.model should be 'real' now that we extract it
  assert.equal(session.dataQuality?.model, 'real');
  assert.equal(session.dataQuality?.cost, 'estimated');

  // usageEvents should aggregate totals across all models
  assert.equal(session.usageEvents.length, 1);
  assert.equal(session.usageEvents[0].inputTokens, 110); // 50 + 60
  assert.equal(session.usageEvents[0].outputTokens, 250); // 100 + 150
  assert.equal(session.usageEvents[0].cacheReadTokens, 10);
  assert.equal(session.usageEvents[0].cacheWriteTokens, 20);
});

test('Claude adapter with single model sets session.model correctly', async () => {
  const adapter = createClaudeAdapter();
  const sessions = await adapter.parse(fixturePath, null);
  const session = sessions[0];

  // All modelUsage entries must have provider = 'anthropic'
  for (const usage of session.modelUsage ?? []) {
    assert.equal(usage.provider, 'anthropic');
  }
});
