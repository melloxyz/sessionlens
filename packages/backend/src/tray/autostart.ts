import { existsSync, mkdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';

const AUTOSTART_KEY = 'tray.autoStart';

function getStartupShortcutPath(): string {
  const startupDir = join(
    homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup',
  );
  if (!existsSync(startupDir)) {
    mkdirSync(startupDir, { recursive: true });
  }
  return join(startupDir, 'Sessionless.lnk');
}

export function isAutoStartEnabled(): boolean {
  return getBooleanSetting(AUTOSTART_KEY, false);
}

export function setAutoStart(enabled: boolean): boolean {
  const shortcutPath = getStartupShortcutPath();

  if (enabled) {
    const targetPath = process.execPath;
    try {
      symlinkSync(targetPath, shortcutPath, 'file');
    } catch {
      return false;
    }
  } else {
    try {
      if (existsSync(shortcutPath)) {
        unlinkSync(shortcutPath);
      }
    } catch {
      return false;
    }
  }

  setAppSetting(AUTOSTART_KEY, enabled ? 'true' : 'false');
  return true;
}
