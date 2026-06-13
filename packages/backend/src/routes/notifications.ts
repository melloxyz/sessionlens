import type { FastifyInstance } from 'fastify';
import { getDatabase, saveDatabase } from '../db/connection.js';
import { testDestination } from '../notifications/dispatcher.js';

export const VALID_DEST_TYPES = ['discord', 'slack', 'teams', 'ntfy', 'custom'] as const;
export const VALID_EVENT_TYPES = [
  'ingestion_complete',
  'budget_warning',
  'budget_approaching',
  'budget_exceeded',
] as const;

type DestType = (typeof VALID_DEST_TYPES)[number];
type EventType = (typeof VALID_EVENT_TYPES)[number];

interface DestinationRow {
  id: number;
  name: string;
  type: DestType;
  webhook_url: string;
  enabled: boolean;
  created_at: string;
  min_interval_minutes: number;
  last_notified_at: string | null;
  rules: Record<EventType, boolean>;
}

function listDestinations(): DestinationRow[] {
  const db = getDatabase();
  const result = db.exec(`
    SELECT d.id, d.name, d.type, d.webhook_url, d.enabled, d.created_at,
           d.min_interval_minutes, d.last_notified_at,
           GROUP_CONCAT(r.event_type || ':' || r.enabled) AS rules_concat
    FROM notification_destinations d
    LEFT JOIN notification_rules r ON r.destination_id = d.id
    GROUP BY d.id
    ORDER BY d.created_at ASC
  `);

  if (!result.length) return [];

  return result[0].values.map((row) => {
    const rulesStr = row[8] ? String(row[8]) : '';
    const rules = Object.fromEntries(VALID_EVENT_TYPES.map((e) => [e, false])) as Record<
      EventType,
      boolean
    >;
    for (const part of rulesStr.split(',')) {
      const sep = part.lastIndexOf(':');
      if (sep === -1) continue;
      const evtType = part.slice(0, sep) as EventType;
      const enabled = part.slice(sep + 1) === '1';
      if (VALID_EVENT_TYPES.includes(evtType)) rules[evtType] = enabled;
    }
    return {
      id: Number(row[0]),
      name: String(row[1]),
      type: String(row[2]) as DestType,
      webhook_url: String(row[3]),
      enabled: Boolean(Number(row[4])),
      created_at: String(row[5]),
      min_interval_minutes: Number(row[6] ?? 0),
      last_notified_at: row[7] ? String(row[7]) : null,
      rules,
    };
  });
}

function insertDefaultRules(db: ReturnType<typeof getDatabase>, destId: number, events: string[]) {
  for (const event of events) {
    if (VALID_EVENT_TYPES.includes(event as EventType)) {
      db.run(
        `INSERT OR IGNORE INTO notification_rules (destination_id, event_type, enabled) VALUES (?, ?, 1)`,
        [destId, event],
      );
    }
  }
}

export function registerNotificationRoutes(app: FastifyInstance) {
  app.get('/api/notifications/destinations', async () => listDestinations());

  app.post('/api/notifications/destinations', async (req, reply) => {
    const body = req.body as {
      name?: string;
      type?: string;
      webhook_url?: string;
      events?: string[];
      min_interval_minutes?: number;
    };

    if (!body?.name || !body?.type || !body?.webhook_url) {
      return reply.status(400).send({
        error: { code: 'INVALID_BODY', message: 'name, type e webhook_url são obrigatórios' },
      });
    }
    if (!VALID_DEST_TYPES.includes(body.type as DestType)) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_TYPE',
          message: `type deve ser um de: ${VALID_DEST_TYPES.join(', ')}`,
        },
      });
    }

    const minInterval = Number(body.min_interval_minutes ?? 0);
    const db = getDatabase();
    db.run(
      `INSERT INTO notification_destinations (name, type, webhook_url, min_interval_minutes) VALUES (?, ?, ?, ?)`,
      [body.name, body.type, body.webhook_url, minInterval],
    );
    const idResult = db.exec('SELECT last_insert_rowid()');
    const id = Number(idResult[0].values[0][0]);

    insertDefaultRules(db, id, body.events ?? [...VALID_EVENT_TYPES]);
    saveDatabase();
    return { id };
  });

  app.put('/api/notifications/destinations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      name?: string;
      webhook_url?: string;
      enabled?: boolean;
      events?: Record<string, boolean>;
      min_interval_minutes?: number;
    };

    const db = getDatabase();
    const exists = db.exec(`SELECT id FROM notification_destinations WHERE id = ?`, [Number(id)]);
    if (!exists.length || !exists[0].values.length) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Destino não encontrado' } });
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.webhook_url !== undefined) {
      updates.push('webhook_url = ?');
      values.push(body.webhook_url);
    }
    if (body.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(body.enabled ? 1 : 0);
    }
    if (body.min_interval_minutes !== undefined) {
      updates.push('min_interval_minutes = ?');
      values.push(Number(body.min_interval_minutes));
    }
    if (updates.length > 0) {
      values.push(Number(id));
      db.run(`UPDATE notification_destinations SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (body.events !== undefined) {
      for (const [event, enabled] of Object.entries(body.events)) {
        if (VALID_EVENT_TYPES.includes(event as EventType)) {
          db.run(
            `INSERT INTO notification_rules (destination_id, event_type, enabled) VALUES (?, ?, ?)
             ON CONFLICT(destination_id, event_type) DO UPDATE SET enabled = excluded.enabled`,
            [Number(id), event, enabled ? 1 : 0],
          );
        }
      }
    }

    saveDatabase();
    return { ok: true };
  });

  app.delete('/api/notifications/destinations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDatabase();
    const exists = db.exec(`SELECT id FROM notification_destinations WHERE id = ?`, [Number(id)]);
    if (!exists.length || !exists[0].values.length) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Destino não encontrado' } });
    }
    db.run(`DELETE FROM notification_destinations WHERE id = ?`, [Number(id)]);
    saveDatabase();
    return { ok: true };
  });

  app.post('/api/notifications/destinations/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDatabase();
    const result = db.exec(
      `SELECT name, type, webhook_url FROM notification_destinations WHERE id = ?`,
      [Number(id)],
    );
    if (!result.length || !result[0].values.length) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Destino não encontrado' } });
    }
    const [name, type, webhookUrl] = result[0].values[0];
    try {
      await testDestination(type as DestType, String(webhookUrl), String(name));
      return { ok: true };
    } catch (err) {
      return reply.status(502).send({ error: { code: 'WEBHOOK_FAILED', message: String(err) } });
    }
  });
}
