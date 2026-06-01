import { createAiderAdapter } from './aider.js';
import { createAntigravityAdapter } from './antigravity.js';
import { createClaudeAdapter } from './claude.js';
import { createCodexAdapter } from './codex.js';
import { createCommandCodeAdapter } from './commandcode.js';
import { createGeminiAdapter } from './gemini.js';
import { createKimiAdapter } from './kimi.js';
import { createOpencodeAdapter } from './opencode.js';
import { createQwenAdapter } from './qwen.js';
import { registry } from './registry.js';

export function registerAllAdapters(): void {
  registry.register(createCodexAdapter());
  registry.register(createClaudeAdapter());
  registry.register(createOpencodeAdapter());
  registry.register(createGeminiAdapter());
  registry.register(createKimiAdapter());
  registry.register(createAiderAdapter());
  registry.register(createQwenAdapter());
  registry.register(createAntigravityAdapter());
  registry.register(createCommandCodeAdapter());
}
