export interface IntegrationStatusItem {
  cli: string;
  detected: boolean;
  status: 'available' | 'missing';
  path?: string | null;
  pathsFound?: number;
  sessionsIndexed?: number;
  lastIngestedAt?: string | null;
  lastError?: string | null;
  completenessScore?: number;
  capabilities?: Record<string, string>;
  dataQualitySummary?: Record<string, string>;
}
