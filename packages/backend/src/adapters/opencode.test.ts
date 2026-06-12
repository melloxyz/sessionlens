import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpencodeAdapter, _setTestDb } from './opencode.js';

const SCHEMA = `
  CREATE TABLE session (
    id TEXT PRIMARY KEY,
    directory TEXT,
    model TEXT,
    cost REAL DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    tokens_reasoning INTEGER DEFAULT 0,
    tokens_cache_read INTEGER DEFAULT 0,
    tokens_cache_write INTEGER DEFAULT 0,
    summary_files INTEGER DEFAULT 0,
    summary_diffs TEXT,
    time_created INTEGER NOT NULL,
    time_updated INTEGER NOT NULL
  );
  CREATE TABLE message (
    id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE part (
    message_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    time_created INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`;

async function createTestDb(): Promise<import('sql.js').Database> {
  const mod = await import('sql.js');
  const SQL = await mod.default();
  const db = new SQL.Database();
  db.run(SCHEMA);
  return db;
}

function sessionRow(
  id: string,
  cost: number,
  tokensInput = 0,
  tokensOutput = 0,
): (string | number | null)[] {
  return [
    id,
    '/test/project',
    null,
    cost,
    tokensInput,
    tokensOutput,
    0,
    0,
    0,
    0,
    null,
    1700000000000,
    1700001000000,
  ];
}

function msgData(role: string, cost: number, inputTokens = 0, outputTokens = 0): string {
  return JSON.stringify({
    role,
    cost,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  });
}

test('OpenCode adapter: session.cost > 0 prevents message cost double-counting (BUG-02)', async () => {
  const db = await createTestDb();

  // session.cost = 0.05; messages each cost 0.025 → sum = 0.05
  // Before BUG-02 fix: total would be 0.05 + 0.05 = 0.10 (doubled)
  // After fix: total = session.cost = 0.05
  db.run(
    `INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sessionRow('bug02-session', 0.05, 100, 50),
  );
  db.run(`INSERT INTO message VALUES (?,?,?,?)`, [
    'msg-1',
    'bug02-session',
    1700000100000,
    msgData('user', 0.025, 50, 0),
  ]);
  db.run(`INSERT INTO message VALUES (?,?,?,?)`, [
    'msg-2',
    'bug02-session',
    1700000200000,
    msgData('assistant', 0.025, 0, 50),
  ]);

  _setTestDb(db);
  const adapter = createOpencodeAdapter();
  const sessions = await adapter.parse('bug02-session', null);
  _setTestDb(null);
  db.close();

  assert.equal(sessions.length, 1);
  assert.equal(
    sessions[0].totalCostUsd,
    0.05,
    'must use session.cost (0.05), not session.cost + messageCostTotal (0.10)',
  );
  assert.equal(sessions[0].dataQuality?.cost, 'actual');
});

test('OpenCode adapter: session.cost = 0 falls back to sum of message costs', async () => {
  const db = await createTestDb();

  // session.cost = 0; messages sum to 0.03
  db.run(
    `INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sessionRow('msgcost-session', 0, 30, 40),
  );
  db.run(`INSERT INTO message VALUES (?,?,?,?)`, [
    'msg-3',
    'msgcost-session',
    1700000100000,
    msgData('user', 0.01, 30, 0),
  ]);
  db.run(`INSERT INTO message VALUES (?,?,?,?)`, [
    'msg-4',
    'msgcost-session',
    1700000200000,
    msgData('assistant', 0.02, 0, 40),
  ]);

  _setTestDb(db);
  const adapter = createOpencodeAdapter();
  const sessions = await adapter.parse('msgcost-session', null);
  _setTestDb(null);
  db.close();

  assert.equal(sessions.length, 1);
  const cost = sessions[0].totalCostUsd ?? 0;
  assert.ok(Math.abs(cost - 0.03) < 1e-9, `totalCostUsd should be 0.03, got ${cost}`);
});

test('OpenCode adapter: empty session (no tokens, no cost, no messages) returns []', async () => {
  const db = await createTestDb();
  db.run(`INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, sessionRow('empty-session', 0));

  _setTestDb(db);
  const adapter = createOpencodeAdapter();
  const sessions = await adapter.parse('empty-session', null);
  _setTestDb(null);
  db.close();

  assert.equal(sessions.length, 0, 'session with no data should produce no output');
});

test('OpenCode adapter: checkpoint skips session whose time_updated is unchanged', async () => {
  const db = await createTestDb();
  const TIME_UPDATED = 1700001000000;
  db.run(
    `INSERT INTO session VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    sessionRow('ckpt-session', 0.01, 100, 50),
  );

  _setTestDb(db);
  const adapter = createOpencodeAdapter();
  const sessions = await adapter.parse('ckpt-session', {
    lastFileMtime: TIME_UPDATED,
    lastFileSize: 0,
    lastSessionId: 'ckpt-session',
  });
  _setTestDb(null);
  db.close();

  assert.equal(sessions.length, 0, 'session with matching time_updated checkpoint must be skipped');
});

test('OpenCode adapter: missing session ID returns []', async () => {
  const db = await createTestDb();
  // no rows inserted

  _setTestDb(db);
  const adapter = createOpencodeAdapter();
  const sessions = await adapter.parse('nonexistent-id', null);
  _setTestDb(null);
  db.close();

  assert.equal(sessions.length, 0, 'missing session should return empty array');
});
