export interface IntegrationStatusItem {
  cli: string;
  status: 'available' | 'missing';
  path?: string | null;
}
