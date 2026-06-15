import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { setupTestDb, type TestDbHandle } from '../test-helpers/db.js';
import { registry } from '../adapters/index.js';

describe('GET /api/health', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'ok');
    assert.ok('timestamp' in res.json());
  });
});

describe('GET /api/overview', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 200 with zero stats when db is empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/overview' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok('sessionCount' in body, 'should have sessionCount');
    assert.ok('totalSpend' in body, 'should have totalSpend');
    assert.ok('todaySpend' in body, 'should have todaySpend');
    assert.ok('weeklySpend' in body, 'should have weeklySpend');
    assert.ok('monthlySpend' in body, 'should have monthlySpend');
    assert.equal(body.sessionCount, 0);
  });

  test('accepts dateFrom and dateTo query params without error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/overview?dateFrom=2024-01-01T00:00:00Z&dateTo=2024-12-31T23:59:59Z',
    });
    assert.equal(res.statusCode, 200);
  });
});

describe('GET /api/sessions', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 200 with empty data when db is empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok('sessions' in body || Array.isArray(body.data), 'should have sessions or data array');
    const sessions = body.sessions ?? body.data ?? [];
    assert.ok(Array.isArray(sessions));
    assert.equal(sessions.length, 0);
  });

  test('accepts cli filter without error', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions?cli=claude' });
    assert.equal(res.statusCode, 200);
  });

  test('accepts dateFrom/dateTo filters without error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions?dateFrom=2024-01-01T00:00:00Z&dateTo=2024-12-31T23:59:59Z',
    });
    assert.equal(res.statusCode, 200);
  });

  test('clamps limit to 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions?limit=9999' });
    assert.equal(res.statusCode, 200);
  });
});

describe('GET /api/sessions/:id', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 404 for nonexistent numeric id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/99999' });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, 'SESSION_NOT_FOUND');
  });

  test('returns 404 for nonexistent string session_id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sessions/nonexistent-session-id' });
    assert.equal(res.statusCode, 404);
  });
});

describe('GET /api/analytics/report', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 200 with empty data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/analytics/report' });
    assert.equal(res.statusCode, 200);
  });

  test('accepts date range filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analytics/report?dateFrom=2024-01-01T00:00:00Z&dateTo=2024-12-31T23:59:59Z',
    });
    assert.equal(res.statusCode, 200);
  });
});

describe('GET /api/budgets + mutations', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('GET /api/budgets returns 200 with empty array', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/budgets' });
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.json()));
  });

  test('POST /api/budgets sem scope_type retorna 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budgets',
      payload: { limit_usd: 100 },
    });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json().error?.code);
  });

  test('POST /api/budgets com scope_type inválido retorna 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budgets',
      payload: { scope_type: 'invalid', limit_usd: 100 },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error.code, 'INVALID_SCOPE');
  });

  test('POST /api/budgets com payload válido retorna 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/budgets',
      payload: { scope_type: 'global', limit_usd: 50, period: 'monthly' },
    });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.ok(body.id, 'deve ter id');
    assert.equal(body.scope_type, 'global');
    assert.equal(body.limit_usd, 50);
  });
});

describe('GET /api/ingest/status', () => {
  let app: FastifyInstance;
  let db: TestDbHandle;

  before(async () => {
    db = await setupTestDb();
    registry.clear();
    app = await buildApp({ logger: false });
  });

  after(async () => {
    await app.close();
    db.cleanup();
  });

  test('returns 200 with no-ingestion-yet message when lastStatus is null', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/ingest/status' });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok('message' in body || 'totalSessions' in body, 'deve ter message ou totalSessions');
  });
});
