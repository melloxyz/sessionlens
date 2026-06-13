export type NotificationEvent =
  | {
      type: 'ingestion_complete';
      newSessions: number;
      updatedSessions: number;
      totalSessions: number;
      errors: string[];
    }
  | {
      type: 'budget_warning' | 'budget_approaching' | 'budget_exceeded';
      title: string;
      message: string;
      currentSpend: number;
      limitUsd: number;
      percentage: number;
    };

const COLOR_SUCCESS = 0x22c55e;
const COLOR_WARNING = 0xf59e0b;
const COLOR_DANGER = 0xef4444;
const COLOR_INFO = 0x6366f1;

function resolveColor(event: NotificationEvent): number {
  if (event.type === 'ingestion_complete') {
    return event.errors.length > 0 ? COLOR_WARNING : COLOR_SUCCESS;
  }
  if (event.type === 'budget_exceeded') return COLOR_DANGER;
  if (event.type === 'budget_approaching') return COLOR_WARNING;
  return COLOR_INFO;
}

function resolveEmoji(event: NotificationEvent): string {
  switch (event.type) {
    case 'ingestion_complete':
      return event.errors.length > 0 ? '⚠️' : '✅';
    case 'budget_warning':
      return '⚠️';
    case 'budget_approaching':
      return '🟡';
    case 'budget_exceeded':
      return '🚨';
  }
}

function resolveTitle(event: NotificationEvent): string {
  if (event.type === 'ingestion_complete') return 'Ingestion Complete';
  return event.title;
}

export function buildDiscordPayload(event: NotificationEvent): Record<string, unknown> {
  const emoji = resolveEmoji(event);
  const title = resolveTitle(event);
  const color = resolveColor(event);

  let description: string;
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (event.type === 'ingestion_complete') {
    description = `**${event.newSessions}** new · **${event.updatedSessions}** updated · **${event.totalSessions}** total`;
    if (event.errors.length > 0) {
      fields.push({
        name: `Errors (${event.errors.length})`,
        value: event.errors.slice(0, 3).join('\n'),
      });
    }
  } else {
    description = event.message;
    fields.push(
      { name: 'Spend', value: `$${event.currentSpend.toFixed(2)}`, inline: true },
      { name: 'Limit', value: `$${event.limitUsd.toFixed(2)}`, inline: true },
      { name: 'Usage', value: `${event.percentage.toFixed(0)}%`, inline: true },
    );
  }

  return {
    username: 'Sessionlens',
    embeds: [
      {
        title: `${emoji} ${title}`,
        description,
        color,
        fields,
        footer: { text: 'Sessionlens · Local-first AI observability' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function buildSlackPayload(event: NotificationEvent): Record<string, unknown> {
  const emoji = resolveEmoji(event);
  const title = resolveTitle(event);

  const blocks: Record<string, unknown>[] = [];

  if (event.type === 'ingestion_complete') {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *${title}*\n*${event.newSessions}* new · *${event.updatedSessions}* updated · *${event.totalSessions}* total`,
      },
    });
    if (event.errors.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Errors:*\n${event.errors.slice(0, 3).join('\n')}`,
        },
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `${emoji} *${title}*\n${event.message}` },
    });
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Spend*\n$${event.currentSpend.toFixed(2)}` },
        { type: 'mrkdwn', text: `*Limit*\n$${event.limitUsd.toFixed(2)}` },
        { type: 'mrkdwn', text: `*Usage*\n${event.percentage.toFixed(0)}%` },
      ],
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'plain_text',
        text: 'Sessionlens · Local-first AI observability',
        emoji: true,
      },
    ],
  });

  return { username: 'Sessionlens', blocks };
}
