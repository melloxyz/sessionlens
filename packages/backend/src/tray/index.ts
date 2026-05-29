import { createRequire } from 'node:module';
import { exec } from 'node:child_process';
import { platform } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';
import { isIngestionRunning, runIngestion } from '../ingestion/engine.js';
import { getLastStatus } from '../ingestion/engine.js';
import { isAutoStartEnabled, setAutoStart } from './autostart.js';
import { buildMenu, type TrayCallbacks } from './menu.js';

const require = createRequire(import.meta.url);
const TrayIcon = require('trayicon');

const ENABLED_KEY = 'tray.enabled';
const MINIMIZED_KEY = 'tray.startMinimized';

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
        title: 'Sessionless',
        action: () => this.openDashboard(),
      });

      this.tray = tray;
      const items = buildMenu(tray, callbacks);
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
    const url = process.env.SESSIONLESS_FRONTEND_URL || 'http://127.0.0.1:5173';
    this.browserOpened = true;
    exec(`start "" "${url}"`, { windowsHide: true });
  }

  private async triggerIngestion() {
    if (isIngestionRunning()) return;

    try {
      this.tray?.setTitle('Sessionless - Ingesting...');
      await runIngestion();
      const status = getLastStatus();
      const total = status?.totalSessions ?? 0;
      this.tray?.setTitle(`Sessionless - ${total} sessions indexed`);
      this.tray?.notify('Ingestion Complete', `${total} sessions indexed`);
    } catch {
      this.tray?.setTitle('Sessionless - Ingestion failed');
      this.tray?.notify('Ingestion Failed', 'Could not complete the ingestion cycle');
    } finally {
      setTimeout(() => this.refreshStatus(), 5000);
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

    const status = getLastStatus();
    const total = status?.totalSessions ?? 0;
    const running = isIngestionRunning();

    if (running) {
      this.tray.setTitle('Sessionless - Ingesting...');
    } else if (status?.errors.length) {
      this.tray.setTitle(`Sessionless - ${total} sessions (warnings)`);
    } else {
      this.tray.setTitle(`Sessionless - ${total} sessions indexed`);
    }
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

    const items = buildMenu(tray, callbacks);
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
