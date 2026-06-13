import { getDatabase } from '../db/connection.js';
import {
  buildDiscordPayload,
  buildSlackPayload,
  buildTeamsPayload,
  buildNtfyPayload,
  type NotificationEvent,
} from './formatters.js';

export type { NotificationEvent };

type DestType = 'discord' | 'slack' | 'teams' | 'ntfy' | 'custom';

interface Destination {
  id: number;
  name: string;
  type: DestType;
  webhook_url: string;
}

async function sendToDestination(dest: Destination, event: NotificationEvent): Promise<void> {
  let payload: Record<string, unknown>;
  if (dest.type === 'discord') {
    payload = buildDiscordPayload(event);
  } else if (dest.type === 'slack') {
    payload = buildSlackPayload(event);
  } else if (dest.type === 'teams') {
    payload = buildTeamsPayload(event);
  } else if (dest.type === 'ntfy') {
    payload = buildNtfyPayload(event);
  } else {
    payload = { source: 'sessionlens', event };
  }

  const response = await fetch(dest.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Webhook "${dest.name}" returned HTTP ${response.status}`);
  }
}

export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  const db = getDatabase();

  const result = db.exec(
    `SELECT d.id, d.name, d.type, d.webhook_url
     FROM notification_destinations d
     JOIN notification_rules r ON r.destination_id = d.id
     WHERE d.enabled = 1 AND r.enabled = 1 AND r.event_type = ?`,
    [event.type],
  );

  if (!result.length || !result[0].values.length) return;

  const destinations: Destination[] = result[0].values.map((row) => ({
    id: Number(row[0]),
    name: String(row[1]),
    type: row[2] as DestType,
    webhook_url: String(row[3]),
  }));

  await Promise.allSettled(destinations.map((dest) => sendToDestination(dest, event)));
}

export async function testDestination(
  type: DestType,
  webhookUrl: string,
  name: string,
): Promise<void> {
  const testEvent: NotificationEvent = {
    type: 'ingestion_complete',
    newSessions: 3,
    updatedSessions: 1,
    totalSessions: 42,
    errors: [],
  };
  await sendToDestination({ id: 0, name, type, webhook_url: webhookUrl }, testEvent);
}
