import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createCodexAdapter, _setTestThreadCache } from './codex.js';
import type { ThreadRow } from './codex.js';

const FIXTURE_DIR = join(process.cwd(), 'src', 'adapters', '__fixtures__', 'codex');
const WITH_USAGE_PATH = join(FIXTURE_DIR, 'session-with-usage', 'events.jsonl');
const FALLBACK_PATH = join(FIXTURE_DIR, 'session-fallback', 'events.jsonl');

function makeThread(rolloutPath: string, overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: 'thread-fixture-1',
    rollout_path: rolloutPath,
    created_at: 1704067200,
    updated_at: 1704067260,
    created_at_ms: 1704067200000,
    updated_at_ms: 1704067260000,
    model_provider: 'openai',
    model: 'gpt-5.4',
    cwd: '/home/user/project',
    title: 'Fixture session',
    tokens_used: 0,
    has_user_event: 1,
    archived: 0,
    git_origin_url: null,
    git_branch: null,
    source: 'codex',
    ...overrides,
  };
}

test('Codex adapter: per-event usage tokens aggregate correctly (BUG-06 regression)', async () => {
  const thread = makeThread(WITH_USAGE_PATH, { tokens_used: 150 });
  _setTestThreadCache(new Map([[WITH_USAGE_PATH, thread]]));

  const adapter = createCodexAdapter();
  const sessions = await adapter.parse(WITH_USAGE_PATH, null);
  _setTestThreadCache(null);

  assert.equal(sessions.length, 1);
  const session = sessions[0];

  assert.equal(session.cli, 'codex');
  assert.equal(session.provider, 'openai');
  assert.equal(session.model, 'gpt-5.4');

  // adapter must never pre-estimate cost — engine does that later via pricing DB
  assert.equal(session.totalCostUsd, null, 'Codex adapter must not set totalCostUsd');

  // user message from event_msg + assistant from response_item/message = 2
  assert.equal(session.messages.length, 2);

  // 2 response_item events with usage → 2 per-event usage entries
  assert.equal(
    session.usageEvents.length,
    2,
    'per-event usage: one entry per response_item with usage',
  );

  // modelUsage aggregates all per-event usage: input=50+20, output=30+10, cacheRead=5+0
  assert.ok(Array.isArray(session.modelUsage) && session.modelUsage!.length === 1);
  const mu = session.modelUsage![0];
  assert.equal(mu.inputTokens, 70, 'input = 50 (event2) + 20 (event3)');
  assert.equal(mu.outputTokens, 40, 'output = 30 (event2) + 10 (event3)');
  assert.equal(mu.cacheReadTokens, 5, 'cacheRead = 5 (event2) + 0 (event3)');
  assert.equal(
    mu.totalCostUsd,
    0,
    'adapter sets modelUsage.totalCostUsd=0; engine estimates later',
  );

  // read_file tool event captured
  assert.equal(session.toolEvents?.length, 1);
  assert.equal(session.toolEvents![0].toolName, 'read_file');
});

test('Codex adapter: tokens_used fallback (70/30 split) when no per-event usage', async () => {
  const thread = makeThread(FALLBACK_PATH, { tokens_used: 1000 });
  _setTestThreadCache(new Map([[FALLBACK_PATH, thread]]));

  const adapter = createCodexAdapter();
  const sessions = await adapter.parse(FALLBACK_PATH, null);
  _setTestThreadCache(null);

  assert.equal(sessions.length, 1);
  const session = sessions[0];

  // adapter never pre-estimates cost
  assert.equal(session.totalCostUsd, null);

  // one synthetic usage event from the 70/30 fallback
  assert.equal(session.usageEvents.length, 1, 'one fallback usage entry from tokens_used');
  assert.equal(session.usageEvents[0].inputTokens, 700, '70% of 1000');
  assert.equal(session.usageEvents[0].outputTokens, 300, '30% of 1000');

  // quality flags reflect estimated tokens from tokens_used
  assert.equal(session.dataQuality?.tokens, 'estimated');
  assert.equal(session.dataQuality?.cost, 'estimated');
});

test('Codex adapter: malformed JSON lines are skipped without throwing', async () => {
  // FALLBACK_PATH contains one non-JSON line; parser must skip it silently
  const thread = makeThread(FALLBACK_PATH, { tokens_used: 0 });
  _setTestThreadCache(new Map([[FALLBACK_PATH, thread]]));

  const adapter = createCodexAdapter();
  // must not throw
  const sessions = await adapter.parse(FALLBACK_PATH, null);
  _setTestThreadCache(null);

  // valid events (2 event_msg + 1 function_call) are still processed
  assert.equal(sessions.length, 1);
  const session = sessions[0];
  assert.equal(session.messages.length, 2, 'two valid messages despite malformed line');
  assert.equal(session.toolEvents?.length, 1, 'one tool event captured');
});

test('Codex adapter: file with no matching thread returns empty', async () => {
  // _threadCache is null → falls through to getThreadData → STATE_DB absent → null → []
  _setTestThreadCache(null);
  const adapter = createCodexAdapter();
  const sessions = await adapter.parse(FALLBACK_PATH, null);
  assert.equal(sessions.length, 0, 'no thread → returns empty array');
});

test('Codex adapter: checkpoint skips unchanged files', async () => {
  const { statSync } = await import('node:fs');
  const stat = statSync(WITH_USAGE_PATH);
  const thread = makeThread(WITH_USAGE_PATH);
  _setTestThreadCache(new Map([[WITH_USAGE_PATH, thread]]));

  const adapter = createCodexAdapter();
  const sessions = await adapter.parse(WITH_USAGE_PATH, {
    lastFileMtime: stat.mtimeMs,
    lastFileSize: stat.size,
    lastSessionId: null,
  });
  _setTestThreadCache(null);

  assert.equal(sessions.length, 0, 'unchanged file with matching checkpoint must be skipped');
});
