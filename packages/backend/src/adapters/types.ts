import type { CliProvider, SourceConfidence } from '@sessionlens/shared';

export type CapabilityLevel = 'real' | 'estimated' | 'partial' | 'unavailable' | 'unknown';

export interface AdapterCapabilities {
  messages: CapabilityLevel;
  tokens: CapabilityLevel;
  cost: CapabilityLevel;
  model: CapabilityLevel;
  provider: CapabilityLevel;
  projectPath: CapabilityLevel;
  duration: CapabilityLevel;
  toolCalls: CapabilityLevel;
  fileReads: CapabilityLevel;
  fileWrites: CapabilityLevel;
  multiModel: CapabilityLevel;
}

export interface SessionDataQuality {
  messages: 'real' | 'partial' | 'unavailable';
  tokens: 'real' | 'estimated' | 'unavailable';
  cost: 'actual' | 'estimated' | 'unknown';
  tools: 'real' | 'partial' | 'unavailable';
  files: 'real' | 'heuristic' | 'unavailable';
  model: 'real' | 'inferred' | 'unknown';
  projectPath: 'real' | 'inferred' | 'unknown';
}

export interface RawToolEvent {
  timestamp: string;
  toolName: string;
  operation: string;
  input: Record<string, unknown> | null;
  outputPreview?: string | null;
  sourceConfidence: 'high' | 'medium' | 'low';
}

export interface RawFileEvent {
  path: string | null;
  operation: 'read' | 'write' | 'edit' | 'delete' | 'shell_possible' | 'unknown';
  toolName: string | null;
  timestamp: string;
  confidence: 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown> | null;
}

export interface RawSession {
  sessionId: string;
  provider: string;
  cli: CliProvider;
  projectPath: string | null;
  sourcePath?: string;
  model: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  totalCostUsd: number | null;
  sourceConfidence: SourceConfidence;
  messages: RawMessage[];
  usageEvents: RawUsageEvent[];
  modelUsage?: RawModelUsage[];
  toolEvents?: RawToolEvent[];
  fileEvents?: RawFileEvent[];
  dataQuality?: SessionDataQuality;
  title?: string | null;
  gitOriginUrl?: string | null;
  gitBranch?: string | null;
  isAutomated?: boolean;
}

export interface RawModelUsage {
  provider: string;
  model: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCallsCount: number;
  totalCostUsd: number;
}

export interface RawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
}

export interface RawUsageEvent {
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  toolCallsCount: number;
}

export interface Checkpoint {
  lastFileMtime: number;
  lastFileSize: number;
  lastSessionId: string | null;
}

export interface Adapter {
  readonly cli: CliProvider;

  detect(): Promise<boolean>;

  /** Called once before discover/parse/computeCheckpoint for this ingestion run. */
  onIngestionStart?(): Promise<void>;

  /** Called once after all sessions for this adapter are processed. */
  onIngestionEnd?(): Promise<void>;

  discover(): Promise<string[]>;

  watchPaths?(): Promise<string[]>;

  computeCheckpoint(sessionPath: string): Promise<Checkpoint | null>;

  parse(sessionPath: string, checkpoint: Checkpoint | null): Promise<RawSession[]>;

  normalize(raw: RawSession): RawSession;

  getCapabilities?(): AdapterCapabilities;
}
