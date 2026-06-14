import { createRequire } from 'node:module';
import { exec } from 'node:child_process';
import { platform } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';
import { isIngestionRunning, runIngestion } from '../ingestion/engine.js';
import { getLastStatus } from '../ingestion/engine.js';
import { isAutoStartEnabled, setAutoStart } from './autostart.js';
import { buildMenu, type TrayCallbacks } from './menu.js';
import { getDatabase } from '../db/connection.js';
import { visibleSessionSql } from '../db/session-filters.js';

const require = createRequire(import.meta.url);
const TrayIcon = require('trayicon');

const ENABLED_KEY = 'tray.enabled';
const MINIMIZED_KEY = 'tray.startMinimized';

function getTodayStats(): { todaySpend: number; todaySessionCount: number } {
  try {
    const db = getDatabase();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();
    const results = db.exec(
      `SELECT COALESCE(SUM(total_cost_usd), 0), COUNT(*)
       FROM sessions
       WHERE ${visibleSessionSql()} AND started_at >= ?`,
      [todayStr],
    );
    if (!results.length || !results[0].values?.length) {
      return { todaySpend: 0, todaySessionCount: 0 };
    }
    const r = results[0].values[0];
    return {
      todaySpend: Number(r[0]) || 0,
      todaySessionCount: Number(r[1]) || 0,
    };
  } catch {
    return { todaySpend: 0, todaySessionCount: 0 };
  }
}

export function isTrayEnabled(): boolean {
  return getBooleanSetting(ENABLED_KEY, true);
}

export function setTrayEnabled(enabled: boolean): void {
  setAppSetting(ENABLED_KEY, enabled ? 'true' : 'false');
}

export function getTrayConfig() {
  return {
    enabled: isTrayEnabled(),
    autoStart: isAutoStartEnabled(),
    startMinimized: getBooleanSetting(MINIMIZED_KEY, false),
    available: platform() === 'win32',
  };
}

export class TrayManager {
  private tray: import('trayicon').Tray | null = null;
  private statusInterval: ReturnType<typeof setInterval> | null = null;
  private app: FastifyInstance | null = null;
  private browserOpened = false;

  async init(app: FastifyInstance) {
    if (platform() !== 'win32') {
      app.log.info('System tray only available on Windows');
      return;
    }

    if (!isTrayEnabled()) {
      app.log.info('System tray disabled via settings');
      return;
    }

    this.app = app;

    try {
      const callbacks: TrayCallbacks = {
        openDashboard: () => this.openDashboard(),
        triggerIngestion: () => this.triggerIngestion(),
        toggleAutoStart: () => this.toggleAutoStart(),
        quit: () => this.quit(),
      };

      const tray = await TrayIcon.create({
        title: 'Sessionlens',
        action: () => this.openDashboard(),
      });

      this.tray = tray;
      const { todaySpend } = getTodayStats();
      const items = buildMenu(tray, callbacks, todaySpend);
      tray.setMenu(...items);

      this.startStatusPolling();

      if (!getBooleanSetting(MINIMIZED_KEY, false)) {
        this.openDashboard();
      }

      app.log.info('System tray initialized');
    } catch (err) {
      app.log.error(err, 'Failed to initialize system tray');
      this.tray = null;
    }
  }

  private openDashboard() {
    if (this.browserOpened) return;
    const url = process.env.SESSIONLENS_FRONTEND_URL || 'http://127.0.0.1:5173';
    this.browserOpened = true;
    exec(`start "" "${url}"`, { windowsHide: true });
  }

  private async triggerIngestion() {
    if (isIngestionRunning()) return;

    try {
      this.tray?.setTitle('Sessionlens - Ingesting...');
      await runIngestion();
      const { todaySpend, todaySessionCount } = getTodayStats();
      const spendStr = `$${todaySpend.toFixed(2)}`;
      this.tray?.notify('Ingestion Complete', `${todaySessionCount} sessões hoje · ${spendStr}`);
    } catch {
      this.tray?.notify('Ingestion Failed', 'Could not complete the ingestion cycle');
    } finally {
      this.refreshStatus();
      this.rebuildMenu();
    }
  }

  private toggleAutoStart() {
    const current = !isAutoStartEnabled();
    setAutoStart(current);
    this.rebuildMenu();
  }

  private startStatusPolling() {
    this.refreshStatus();
    this.statusInterval = setInterval(() => this.refreshStatus(), 30000);
  }

  private refreshStatus() {
    if (!this.tray) return;

    if (isIngestionRunning()) {
      this.tray.setTitle('Sessionlens - Ingesting...');
      return;
    }

    const { todaySpend, todaySessionCount } = getTodayStats();
    const spendStr = `$${todaySpend.toFixed(2)}`;
    const status = getLastStatus();
    const suffix = status?.errors.length ? ' (avisos)' : '';
    this.tray.setTitle(`SessionLens · ${spendStr} hoje · ${todaySessionCount} sessões${suffix}`);
  }

  private rebuildMenu() {
    const tray = this.tray;
    if (!tray) return;

    const callbacks: TrayCallbacks = {
      openDashboard: () => this.openDashboard(),
      triggerIngestion: () => this.triggerIngestion(),
      toggleAutoStart: () => this.toggleAutoStart(),
      quit: () => this.quit(),
    };

    const { todaySpend } = getTodayStats();
    const items = buildMenu(tray, callbacks, todaySpend);
    tray.setMenu(...items);
  }

  async quit() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    if (this.tray) {
      try {
        this.tray.kill();
      } catch {
        // tray already dead
      }
      this.tray = null;
    }

    if (this.app) {
      try {
        await this.app.close();
      } catch {
        // already closing
      }
    }

    process.exit(0);
  }

  async destroy() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    if (this.tray) {
      try {
        this.tray.kill();
      } catch {
        // tray already dead
      }
      this.tray = null;
    }
  }
}

export const trayManager = new TrayManager();
