declare module 'trayicon' {
  interface TrayItemOptions {
    action?: () => void;
    disabled?: boolean;
    checked?: boolean;
    bold?: boolean;
    type?: 'separator';
  }

  interface TrayItem {
    uid: string;
    label: string;
    action: () => void;
    add(...items: TrayItem[]): void;
  }

  interface TrayCreateOptions {
    title?: string;
    icon?: Buffer;
    action?: () => void;
    debug?: boolean;
    useTempDir?: boolean | 'clean';
  }

  interface Tray {
    title: string;
    icon: Buffer;
    on(event: 'connected', listener: (tray: Tray) => void): void;
    setTitle(title: string): void;
    setIcon(icon: Buffer): void;
    setAction(action: () => void): void;
    setMenu(...items: TrayItem[]): void;
    notify(title: string, message: string, action?: () => void): void;
    item(label: string, options?: TrayItemOptions | (() => void)): TrayItem;
    separator(): TrayItem;
    kill(): void;
  }

  function create(opts: TrayCreateOptions, ready?: (tray: Tray) => void): Promise<Tray>;
  function create(ready: (tray: Tray) => void): Promise<Tray>;

  export { create, Tray, TrayItem, TrayCreateOptions, TrayItemOptions };
}
