import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countToolCalls,
  buildSessionDataQuality,
  summarizeQuality,
  capabilityScore,
} from './session-quality.js';
import type { AdapterCapabilities, RawSession, SessionDataQuality } from '../adapters/types.js';

function makeSession(overrides: Partial<RawSession> = {}): RawSession {
  return {
    sessionId: 'test',
    provider: 'anthropic',
    cli: 'claude',
    projectPath: '/test',
    model: 'claude-sonnet-4',
    startedAt: '2024-01-01T00:00:00.000Z',
    endedAt: null,
    durationMs: null,
    totalCostUsd: null,
    sourceConfidence: 'HIGH',
    messages: [],
    usageEvents: [],
    ...overrides,
  };
}

const toolEvent = {
  timestamp: 't',
  toolName: 'read_file',
  operation: 'read',
  input: null,
  sourceConfidence: 'high' as const,
};

describe('countToolCalls', () => {
  it('prefers toolEvents.length over usageEvents.toolCallsCount', () => {
    const raw = makeSession({
      toolEvents: [
        toolEvent,
        { ...toolEvent, toolName: 'write_file' },
        { ...toolEvent, toolName: 'edit' },
      ],
      usageEvents: [
        {
          timestamp: 't',
          inputTokens: 10,
          outputTokens: 5,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
          toolCallsCount: 99,
        },
      ],
    });
    assert.equal(
      countToolCalls(raw),
      3,
      'must use toolEvents.length=3, not usageEvents.toolCallsCount=99',
    );
  });

  it('sums usageEvents.toolCallsCount when no toolEvents', () => {
    const raw = makeSession({
      toolEvents: [],
      usageEvents: [
        {
          timestamp: 't',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
          toolCallsCount: 3,
        },
        {
          timestamp: 't',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
          toolCallsCount: 2,
        },
      ],
    });
    assert.equal(countToolCalls(raw), 5);
  });

  it('falls back to modelUsage.toolCallsCount when usageEvents have none', () => {
    const raw = makeSession({
      usageEvents: [
        {
          timestamp: 't',
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
          toolCallsCount: 0,
        },
      ],
      modelUsage: [
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4',
          messageCount: 1,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          toolCallsCount: 4,
          totalCostUsd: 0,
        },
      ],
    });
    assert.equal(countToolCalls(raw), 4);
  });

  it('returns 0 when all sources are empty', () => {
    assert.equal(countToolCalls(makeSession()), 0);
  });
});

describe('buildSessionDataQuality', () => {
  it('preserves dataQuality.cost over the provided costSource', () => {
    const raw = makeSession({
      dataQuality: {
        messages: 'real',
        tokens: 'real',
        cost: 'actual',
        tools: 'real',
        files: 'real',
        model: 'real',
        projectPath: 'real',
      },
    });
    const result = buildSessionDataQuality(raw, 'estimated');
    assert.equal(
      result.cost,
      'actual',
      'adapter-declared actual cost must not be overridden by costSource',
    );
  });

  it('uses costSource when session has no dataQuality', () => {
    const raw = makeSession({ dataQuality: undefined, model: null, projectPath: null });
    const result = buildSessionDataQuality(raw, 'estimated');
    assert.equal(result.cost, 'estimated');
    assert.equal(result.model, 'unknown');
    assert.equal(result.projectPath, 'unknown');
  });

  it('sets messages=real when messages array is non-empty', () => {
    const raw = makeSession({
      messages: [{ role: 'user', content: 'hello', timestamp: 't' }],
      dataQuality: undefined,
    });
    const result = buildSessionDataQuality(raw, 'unknown');
    assert.equal(result.messages, 'real');
  });

  it('sets tools=real when toolEvents is non-empty', () => {
    const raw = makeSession({ toolEvents: [toolEvent], dataQuality: undefined });
    const result = buildSessionDataQuality(raw, 'unknown');
    assert.equal(result.tools, 'real');
  });
});

describe('summarizeQuality', () => {
  it('returns all-unavailable/unknown for empty input', () => {
    const result = summarizeQuality([]);
    assert.equal(result.messages, 'unavailable');
    assert.equal(result.tokens, 'unavailable');
    assert.equal(result.cost, 'unknown');
    assert.equal(result.tools, 'unavailable');
    assert.equal(result.model, 'unknown');
    assert.equal(result.projectPath, 'unknown');
  });

  it('picks the highest quality level across rows', () => {
    const rows: SessionDataQuality[] = [
      {
        messages: 'partial',
        tokens: 'unavailable',
        cost: 'unknown',
        tools: 'unavailable',
        files: 'unavailable',
        model: 'unknown',
        projectPath: 'unknown',
      },
      {
        messages: 'real',
        tokens: 'estimated',
        cost: 'estimated',
        tools: 'real',
        files: 'heuristic',
        model: 'real',
        projectPath: 'real',
      },
    ];
    const result = summarizeQuality(rows);
    assert.equal(result.messages, 'real');
    assert.equal(result.tokens, 'estimated');
    assert.equal(result.cost, 'estimated');
    assert.equal(result.tools, 'real');
    assert.equal(result.model, 'real');
  });

  it('single row mirrors itself', () => {
    const row: SessionDataQuality = {
      messages: 'partial',
      tokens: 'estimated',
      cost: 'actual',
      tools: 'partial',
      files: 'heuristic',
      model: 'inferred',
      projectPath: 'inferred',
    };
    const result = summarizeQuality([row]);
    assert.deepEqual(result, row);
  });
});

describe('capabilityScore', () => {
  it('returns 100 when all capabilities are real', () => {
    const caps: AdapterCapabilities = {
      messages: 'real',
      tokens: 'real',
      cost: 'real',
      model: 'real',
      provider: 'real',
      projectPath: 'real',
      duration: 'real',
      toolCalls: 'real',
      fileReads: 'real',
      fileWrites: 'real',
      multiModel: 'real',
    };
    assert.equal(capabilityScore(caps), 100);
  });

  it('returns 0 when all capabilities are unavailable', () => {
    const caps: AdapterCapabilities = {
      messages: 'unavailable',
      tokens: 'unavailable',
      cost: 'unavailable',
      model: 'unavailable',
      provider: 'unavailable',
      projectPath: 'unavailable',
      duration: 'unavailable',
      toolCalls: 'unavailable',
      fileReads: 'unavailable',
      fileWrites: 'unavailable',
      multiModel: 'unavailable',
    };
    assert.equal(capabilityScore(caps), 0);
  });

  it('partial mix scores between 0 and 100', () => {
    const caps: AdapterCapabilities = {
      messages: 'real',
      tokens: 'estimated',
      cost: 'unknown',
      model: 'real',
      provider: 'real',
      projectPath: 'unknown',
      duration: 'unavailable',
      toolCalls: 'partial',
      fileReads: 'partial',
      fileWrites: 'unavailable',
      multiModel: 'unavailable',
    };
    const score = capabilityScore(caps);
    assert.ok(score > 0 && score < 100, `expected score between 0 and 100, got ${score}`);
  });
});
