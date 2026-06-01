import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createCommandCodeAdapter } from './commandcode.js';
import { countToolCalls } from '../ingestion/session-quality.js';

const fixturePath = join(
  process.cwd(),
  'src',
  'adapters',
  '__fixtures__',
  'commandcode',
  'c-users-user-desktop-demo',
  'session-51-tools.jsonl',
);

test('CommandCode parser captures tool and file events even without token usage', async () => {
  const adapter = createCommandCodeAdapter();
  const sessions = await adapter.parse(fixturePath, null);

  assert.equal(sessions.length, 1);

  const session = sessions[0];
  assert.equal(session.sessionId, 'fixture-session-51');
  assert.equal(session.sourcePath, fixturePath);
  assert.equal(session.totalCostUsd, null);
  assert.equal(session.sourceConfidence, 'HIGH');
  assert.equal(session.dataQuality?.tokens, 'unavailable');
  assert.equal(session.dataQuality?.cost, 'unknown');
  assert.equal(session.dataQuality?.tools, 'real');
  assert.equal(session.dataQuality?.files, 'heuristic');
  assert.equal(session.toolEvents?.length, 51);
  assert.equal(countToolCalls(session), 51);

  const fileOps = new Set((session.fileEvents ?? []).map((event) => event.operation));
  assert.ok(fileOps.has('read'));
  assert.ok(fileOps.has('write'));
  assert.ok(fileOps.has('edit'));
  assert.ok(fileOps.has('shell_possible'));

  const checkpointEvents = (session.fileEvents ?? []).filter(
    (event) => event.toolName === 'checkpoint',
  );
  assert.equal(checkpointEvents.length, 2);
});
