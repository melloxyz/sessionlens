import { getDatabase, saveDatabase } from './connection.js';

export function getAppSetting(key: string, fallback: string): string {
  const db = getDatabase();
  const result = db.exec(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  if (result.length === 0 || result[0].values.length === 0) return fallback;
  return String(result[0].values[0][0]);
}

export function setAppSetting(key: string, value: string): void {
  const db = getDatabase();
  db.run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [key, value],
  );
  saveDatabase();
}

export function getBooleanSetting(key: string, fallback: boolean): boolean {
  const raw = getAppSetting(key, fallback ? 'true' : 'false');
  return raw === 'true';
}
