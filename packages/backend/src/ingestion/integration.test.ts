import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { setupTestDb, type TestDbHandle } from '../test-helpers/db.js';
import { registry, createClaudeAdapter, type Adapter } from '../adapters/index.js';
import { runIngestion, _resetIngestionState } from './engine.js';

const FIXTURE_DIR = join(process.cwd(), 'src', 'adapters', '__fixtures__');

describe('Ciclo completo: fixture Claude → runIngestion() → endpoints', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();

    const base = createClaudeAdapter();
    const fixtureAdapter: Adapter = {
      ...base,
      cli: 'claude',
      async detect() {
        return true;
      },
      async discover() {
        return [join(FIXTURE_DIR, 'claude', 'multi-model', 'session.jsonl')];
      },
    };

    registry.clear();
    registry.register(fixtureAdapter);

    app = await buildApp({ logger: false });

    await runIngestion(true);
  });

  after(async () => {
    await app.close();
    _resetIngestionState();
    db.cleanup();
  });

  test('runIngestion() persiste ao menos 1 sessão sem erros', async () => {
    const { getLastStatus } = await import('./engine.js');
    const status = getLastStatus();
    assert.ok(status !== null, 'lastStatus deve estar preenchido após ingestion');
    assert.equal(status!.errors.length, 0, `erros de ingestion: ${status!.errors.join(', ')}`);
    assert.ok(status!.newSessions >= 1, 'deve criar ao menos 1 sessão nova');
  });

  test('GET /api/sessions?cli=claude retorna sessão com model preenchido', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions?cli=claude' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    const sessions = body.sessions ?? body.data ?? [];
    assert.ok(sessions.length >= 1, 'deve ter ao menos 1 sessão');
    const session = sessions[0];
    assert.equal(session.cli, 'claude');
    assert.ok(session.model, 'model deve estar preenchido');
  });

  test('GET /api/overview reflete sessionCount >= 1 após ingestion', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/overview' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.sessionCount >= 1, `sessionCount deve ser >= 1, mas é ${body.sessionCount}`);
  });

  test('GET /api/ingest/status reflete completedAt após ingestion', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ingest/status' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.completedAt, 'completedAt deve estar preenchido após ingestion');
  });

  test('GET /api/sessions/:id retorna sessão ingerida pelo id', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/sessions?cli=claude&limit=1' });
    const sessions = listRes.json().sessions ?? listRes.json().data ?? [];
    assert.ok(sessions.length >= 1, 'precisa de sessão para buscar por id');

    const sessionId = sessions[0].session_id ?? sessions[0].id;
    const res = await app.inject({ method: 'GET', url: `/api/sessions/${sessionId}` });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.id ?? body.session_id, 'deve retornar a sessão');
  });
});
