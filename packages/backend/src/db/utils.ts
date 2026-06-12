import { getDatabase } from './connection.js';

export function mapRows<T>(results: ReturnType<ReturnType<typeof getDatabase>['exec']>): T[] {
  const rows: T[] = [];
  if (results.length === 0 || !results[0].values || !results[0].columns) return rows;

  const columns = results[0].columns;
  for (const row of results[0].values) {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    rows.push(obj as T);
  }

  return rows;
}
