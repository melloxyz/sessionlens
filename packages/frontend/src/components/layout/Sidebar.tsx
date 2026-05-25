import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  BarChart3,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/sessions', label: 'Sessions', icon: MessageSquare },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/models', label: 'Models', icon: Database },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-border-secondary bg-bg-secondary">
      <div className="flex h-14 items-center gap-3 px-4 border-b border-border-secondary">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
          <span className="text-xs font-bold text-white">AI</span>
        </div>
        <span className="text-sm font-semibold text-text-primary">AIMeter</span>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-accent-subtle text-accent-hover font-medium'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-3 border-t border-border-secondary">
        <div className="rounded-lg bg-bg-tertiary px-3 py-2 text-xs text-text-tertiary">
          Local-first observability for AI coding CLIs
        </div>
      </div>
    </aside>
  );
}
