export type CliProvider = 'claude' | 'opencode' | 'codex' | 'gemini' | 'kimi' | 'aider' | 'qwen';

export type SourceConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Session {
  id: number;
  provider: string;
  cli: CliProvider;
  sessionId: string;
  projectPath: string | null;
  model: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalCostUsd: number | null;
  sourceConfidence: SourceConfidence;
  createdAt: string;
  messageCount: number | null;
  toolCallCount: number | null;
}

export interface UsageEvent {
  id: number;
  sessionFk: number;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  toolCallsCount: number;
}

export interface Message {
  id: number;
  sessionFk: number;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface Project {
  id: number;
  path: string;
  gitRemote: string | null;
  totalSessions: number;
  totalCost: number;
}

export interface ModelPricing {
  id: number;
  provider: string;
  modelName: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
  cachedInputCost: number | null;
}

export interface DashboardOverview {
  todaySpend: number;
  weeklySpend: number;
  monthlySpend: number;
  totalSpend: number;
  sessionCount: number;
  averageSessionCost: number;
  mostUsedCli: string | null;
}

export interface SessionFilters {
  cli?: CliProvider;
  provider?: string;
  model?: string;
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
  confidence?: SourceConfidence;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
