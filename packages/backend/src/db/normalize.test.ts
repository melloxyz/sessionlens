import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProvider, normalizeModel } from './normalize.js';

describe('normalizeProvider', () => {
  it('returns known providers as canonical lowercase', () => {
    assert.equal(normalizeProvider('anthropic'), 'anthropic');
    assert.equal(normalizeProvider('openai'), 'openai');
    assert.equal(normalizeProvider('google'), 'google');
    assert.equal(normalizeProvider('deepseek'), 'deepseek');
    assert.equal(normalizeProvider('minimax'), 'minimax');
    assert.equal(normalizeProvider('opencode'), 'opencode');
  });

  it('maps github-copilot to openai', () => {
    assert.equal(normalizeProvider('github-copilot'), 'openai');
    assert.equal(normalizeProvider('GitHub-Copilot'), 'openai');
  });

  it('lowercases unknown providers', () => {
    assert.equal(normalizeProvider('SomeUnknown'), 'someunknown');
    assert.equal(normalizeProvider('ANTHROPIC'), 'anthropic');
  });
});

describe('normalizeModel', () => {
  it('returns null for null/undefined input', () => {
    assert.equal(normalizeModel(null), null);
    assert.equal(normalizeModel(undefined), null);
  });

  it('strips provider prefix before /', () => {
    assert.equal(normalizeModel('anthropic/claude-sonnet-4'), 'claude-sonnet-4');
    assert.equal(normalizeModel('openai/gpt-4o'), 'gpt-4o');
    assert.equal(normalizeModel('google/gemini-2.5-pro'), 'gemini-2.5-pro');
  });

  it('preserves model name when no prefix', () => {
    assert.equal(normalizeModel('claude-sonnet-4'), 'claude-sonnet-4');
    assert.equal(normalizeModel('gpt-4o'), 'gpt-4o');
  });

  it('lowercases the result', () => {
    assert.equal(normalizeModel('Claude-Sonnet-4'), 'claude-sonnet-4');
    assert.equal(normalizeModel('Anthropic/Claude-Sonnet-4'), 'claude-sonnet-4');
  });

  it('keeps nested slashes intact (only strips first segment)', () => {
    assert.equal(normalizeModel('provider/family/model-v1'), 'family/model-v1');
  });
});
