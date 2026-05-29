import { isAutoStartEnabled } from './autostart.js';
import { getBooleanSetting, setAppSetting } from '../db/settings.js';

export interface TrayCallbacks {
  openDashboard(): void;
  triggerIngestion(): Promise<void>;
  toggleAutoStart(): void;
  quit(): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildMenu(tray: any, callbacks: TrayCallbacks) {
  const startMinimized = getBooleanSetting('tray.startMinimized', false);

  const statusItem = tray.item('Sessionless', () => {});
  statusItem.disabled = true;

  const sep1 = tray.separator();

  const dashboardItem = tray.item('Open Dashboard', () => callbacks.openDashboard());

  const ingestItem = tray.item('Trigger Ingestion', () => {
    void callbacks.triggerIngestion();
  });

  const sep2 = tray.separator();

  const autoStartEnabled = isAutoStartEnabled();
  const autoStartItem = tray.item(`Start with system${autoStartEnabled ? ' ✓' : ''}`, () =>
    callbacks.toggleAutoStart(),
  );

  const startMinimizedEnabled = startMinimized;
  const minimizedItem = tray.item(`Start minimized${startMinimizedEnabled ? ' ✓' : ''}`, () => {
    const current = getBooleanSetting('tray.startMinimized', false);
    setAppSetting('tray.startMinimized', String(!current));
  });

  const sep3 = tray.separator();

  const quitItem = tray.item('Quit', () => callbacks.quit());

  return [
    statusItem,
    sep1,
    dashboardItem,
    ingestItem,
    sep2,
    autoStartItem,
    minimizedItem,
    sep3,
    quitItem,
  ];
}
