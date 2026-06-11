import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Flame,
  Github,
  Globe2,
  Hash,
  Instagram,
  Linkedin,
  LockKeyhole,
  MoreHorizontal,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  Twitter,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import type { IntegrationStatusItem } from '../components/layout/IntegrationStatus.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { useApi } from '../hooks/useApi.js';
import { chartColor } from '../lib/chart-colors.js';
import {
  basename,
  compactPath,
  formatCurrency,
  formatDuration,
  formatTokens,
} from '../lib/format.js';
import { cn } from '../lib/utils.js';

type HeatmapMode = 'daily' | 'weekly' | 'cumulative';
type ShareImageVariant = 'compact' | 'standard' | 'complete';

interface LocalProfile {
  name: string;
  handle: string;
  avatarUrl: string;
  networks: {
    linkedin: string;
    x: string;
    instagram: string;
    github: string;
    website: string;
    customLabel: string;
    customValue: string;
  };
}

interface Overview {
  totalSpend: number;
  sessionCount: number;
  mostUsedCli: string | null;
  totalDurationMs: number;
}

interface SessionRow {
  id: number;
  cli: string;
  provider: string;
  model: string | null;
  project_path: string | null;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  total_cost_usd: number | null;
  session_id: string;
}

interface TokenPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface SpendPoint {
  date: string;
  spend: number;
  tokens: number;
  sessions: number;
}

interface BreakdownItem {
  label: string;
  value: number;
  percentage: number;
}

interface HeatmapCell {
  key: string;
  date: string;
  tokens: number;
  sessions: number;
  cost: number;
  level: number;
  isPadding?: boolean;
}

interface HeatmapMonth {
  label: string;
  weeks: HeatmapCell[][];
}

const PROFILE_STORAGE_KEY = 'sessionlens-local-profile';

const DEFAULT_PROFILE: LocalProfile = {
  name: 'João Mello',
  handle: '@joaovdmello',
  avatarUrl: '',
  networks: {
    linkedin: 'linkedin.com/in/joaovdmello',
    x: '@joaovdmello',
    instagram: '@joaovdmello',
    github: 'github.com/melloxyz',
    website: 'melloxyz.dev',
    customLabel: '#',
    customValue: '@joaovdmello',
  },
};

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
const MONTH_LABELS = [
  'jan.',
  'fev.',
  'mar.',
  'abr.',
  'mai.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'out.',
  'nov.',
  'dez.',
];
const HEATMAP_LEVELS = [
  'bg-surface-muted/80',
  'bg-accent/20 shadow-[0_0_10px_rgba(34,197,94,0.08)]',
  'bg-accent/45 shadow-[0_0_12px_rgba(34,197,94,0.14)]',
  'bg-info/70 shadow-[0_0_12px_rgba(59,130,246,0.18)]',
  'bg-accent shadow-[0_0_16px_rgba(34,197,94,0.24)]',
];

function readLocalProfile(): LocalProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<LocalProfile>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      networks: { ...DEFAULT_PROFILE.networks, ...parsed.networks },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function useLocalProfile() {
  const [profile, setProfile] = useState<LocalProfile>(readLocalProfile);

  useEffect(() => {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  return { profile, setProfile };
}

function normalizeHandle(value: string) {
  const clean = value.trim();
  if (!clean) return '@local';
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function toDayKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function buildYearHeatmap(
  tokenPoints: TokenPoint[],
  spendPoints: SpendPoint[],
  sessions: SessionRow[],
  mode: HeatmapMode,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);

  const tokenByDate = new Map<string, number>();
  for (const point of tokenPoints) {
    tokenByDate.set(point.date, (point.inputTokens ?? 0) + (point.outputTokens ?? 0));
  }

  const spendByDate = new Map<string, SpendPoint>();
  for (const point of spendPoints) spendByDate.set(point.date, point);

  const sessionsByDate = new Map<string, number>();
  for (const session of sessions) {
    const key = toDayKey(session.started_at);
    if (!key) continue;
    sessionsByDate.set(key, (sessionsByDate.get(key) ?? 0) + 1);
  }

  const rawCells = daysBetween(start, end).map((date, index, allDays) => {
    const key = toDayKey(date);
    const weekStart = Math.max(0, index - date.getDay());
    const weekEnd = Math.min(allDays.length - 1, weekStart + 6);
    const weekKeys = allDays.slice(weekStart, weekEnd + 1).map(toDayKey);
    const weeklyTokens = weekKeys.reduce((sum, day) => sum + (tokenByDate.get(day) ?? 0), 0);
    const isFuture = date > today;
    const tokens = isFuture ? 0 : (tokenByDate.get(key) ?? 0);

    return {
      key,
      date: key,
      tokens: mode === 'weekly' && !isFuture ? weeklyTokens : tokens,
      sessions: isFuture ? 0 : (sessionsByDate.get(key) ?? 0),
      cost: isFuture ? 0 : (spendByDate.get(key)?.spend ?? 0),
    };
  });

  let running = 0;
  const valuedCells = rawCells.map((cell) => {
    running += cell.tokens;
    return { ...cell, tokens: mode === 'cumulative' ? running : cell.tokens };
  });
  const maxTokens = Math.max(...valuedCells.map((cell) => cell.tokens), 0);
  const cells = valuedCells.map<HeatmapCell>((cell) => ({
    ...cell,
    level: maxTokens > 0 ? Math.min(4, Math.ceil((cell.tokens / maxTokens) * 4)) : 0,
  }));

  const cellsByDate = new Map(cells.map((cell) => [cell.date, cell]));
  const months: HeatmapMonth[] = MONTH_LABELS.map((label, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const flatCells: HeatmapCell[] = [];

    for (let index = 0; index < firstDay.getDay(); index += 1) {
      flatCells.push({
        key: `${label}-pad-start-${index}`,
        date: '',
        tokens: 0,
        sessions: 0,
        cost: 0,
        level: 0,
        isPadding: true,
      });
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const key = toDayKey(new Date(year, monthIndex, day));
      flatCells.push(
        cellsByDate.get(key) ?? {
          key,
          date: key,
          tokens: 0,
          sessions: 0,
          cost: 0,
          level: 0,
        },
      );
    }

    while (flatCells.length < 42) {
      flatCells.push({
        key: `${label}-pad-end-${flatCells.length}`,
        date: '',
        tokens: 0,
        sessions: 0,
        cost: 0,
        level: 0,
        isPadding: true,
      });
    }

    const weeks: HeatmapCell[][] = [];
    for (let week = 0; week < 6; week += 1) {
      weeks.push(flatCells.slice(week * 7, week * 7 + 7));
    }

    return { label, weeks };
  });

  return { months };
}

function calculateStreaks(sessions: SessionRow[]) {
  const activeDays = new Set(
    sessions.map((session) => toDayKey(session.started_at)).filter(Boolean),
  );
  const sorted = Array.from(activeDays).sort();
  let longest = 0;
  let currentRun = 0;
  let previous: Date | null = null;

  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00`);
    const isConsecutive =
      previous && Math.round((date.getTime() - previous.getTime()) / 86400000) === 1;
    currentRun = isConsecutive ? currentRun + 1 : 1;
    longest = Math.max(longest, currentRun);
    previous = date;
  }

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDays.has(toDayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}

function formatShortPercent(value: number) {
  return `${Math.round(value)}%`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function downloadSvg(filename: string, svg: string) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderSvgMetricCard(x: number, y: number, width: number, label: string, value: string) {
  return `
  <rect x="${x}" y="${y}" width="${width}" height="94" rx="18" fill="#101614" stroke="#26302c"/>
  <text x="${x + 24}" y="${y + 34}" font-family="Arial, sans-serif" font-size="18" fill="#98a39e">${escapeXml(label)}</text>
  <text x="${x + 24}" y="${y + 72}" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#f8fafc">${escapeXml(value)}</text>`;
}

function renderSvgPill(x: number, y: number, label: string, width = 210) {
  return `
  <rect x="${x}" y="${y}" width="${width}" height="46" rx="12" fill="#0c1110" stroke="#26302c"/>
  <text x="${x + 20}" y="${y + 30}" font-family="Arial, sans-serif" font-size="17" fill="#f8fafc">${escapeXml(label)}</text>`;
}

function renderSvgHeatmap(months: HeatmapMonth[], x: number, y: number, cellSize: number) {
  const gap = Math.max(1, Math.round(cellSize * 0.4));
  const monthGap = cellSize * 4;
  const monthWidth = 6 * cellSize + 5 * gap;
  const colors = ['#17201d', '#123924', '#1c7b45', '#168bd8', '#25dc6a'];

  return months
    .map((month, monthIndex) => {
      const monthX = x + monthIndex * (monthWidth + monthGap);
      const cells = month.weeks
        .map((week, weekIndex) =>
          week
            .map((cell, dayIndex) => {
              if (cell.isPadding) return '';
              return `<rect x="${monthX + weekIndex * (cellSize + gap)}" y="${y + dayIndex * (cellSize + gap)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors[cell.level]}"/>`;
            })
            .join(''),
        )
        .join('');
      return `${cells}<text x="${monthX}" y="${y + 7 * (cellSize + gap) + 20}" font-family="Arial, sans-serif" font-size="13" fill="#98a39e">${month.label}</text>`;
    })
    .join('');
}

export function ProfilePage() {
  const { profile, setProfile } = useLocalProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('daily');

  const { data: overview } = useApi<Overview>('/api/overview');
  const { data: sessionsData } = useApi<{ data: SessionRow[]; total: number }>(
    '/api/sessions?limit=500&sortBy=started_at&sortOrder=desc',
    { initialData: { data: [], total: 0 } },
  );
  const { data: tokenData } = useApi<{ points: TokenPoint[] }>('/api/analytics/tokens-over-time', {
    initialData: { points: [] },
  });
  const { data: spendData } = useApi<{ points: SpendPoint[] }>(
    '/api/analytics/spend-over-time?granularity=day',
    { initialData: { points: [] } },
  );
  const { data: cliBreakdownData } = useApi<{ breakdown: BreakdownItem[] }>(
    '/api/analytics/breakdown?dimension=cli&metric=tokens',
    { initialData: { breakdown: [] } },
  );
  const { data: modelBreakdownData } = useApi<{ breakdown: BreakdownItem[] }>(
    '/api/analytics/breakdown?dimension=model&metric=tokens',
    { initialData: { breakdown: [] } },
  );
  const { data: projectBreakdownData } = useApi<{ breakdown: BreakdownItem[] }>(
    '/api/analytics/breakdown?dimension=project&metric=sessions',
    { initialData: { breakdown: [] } },
  );
  const { data: integrationsData } = useApi<{ integrations: IntegrationStatusItem[] }>(
    '/api/integrations/status',
    { initialData: { integrations: [] } },
  );

  const sessions = sessionsData?.data ?? [];
  const tokenPoints = tokenData?.points ?? [];
  const spendPoints = spendData?.points ?? [];
  const totalTokens = tokenPoints.reduce(
    (sum, point) => sum + (point.inputTokens ?? 0) + (point.outputTokens ?? 0),
    0,
  );
  const dailyPeakTokens = tokenPoints.reduce(
    (peak, point) => Math.max(peak, (point.inputTokens ?? 0) + (point.outputTokens ?? 0)),
    0,
  );
  const longestSessionMs = sessions.reduce(
    (max, session) => Math.max(max, Number(session.duration_ms ?? 0)),
    0,
  );
  const streaks = useMemo(() => calculateStreaks(sessions), [sessions]);
  const heatmap = useMemo(
    () => buildYearHeatmap(tokenPoints, spendPoints, sessions, heatmapMode),
    [heatmapMode, sessions, spendPoints, tokenPoints],
  );

  const cliBreakdown = (cliBreakdownData?.breakdown ?? []).filter((item) => item.value > 0);
  const modelBreakdown = (modelBreakdownData?.breakdown ?? []).filter((item) => item.value > 0);
  const projectBreakdown = (projectBreakdownData?.breakdown ?? []).filter((item) => item.value > 0);
  const favoriteCli = cliBreakdown[0]?.label ?? overview?.mostUsedCli ?? 'codex';
  const favoriteCliLabel = getBrandMeta(favoriteCli, 'cli').label;
  const topModel = modelBreakdown[0]?.label ?? 'unknown';
  const topProject =
    projectBreakdown[0]?.label ?? sessions.find((s) => s.project_path)?.project_path ?? 'local';
  const availableIntegrations = (integrationsData?.integrations ?? []).filter(
    (item) => item.status === 'available',
  );

  const weekdayUsage = useMemo(() => {
    const totals = Array.from({ length: 7 }, () => 0);
    for (const point of tokenPoints) {
      const date = new Date(`${point.date}T00:00:00`);
      const mondayIndex = (date.getDay() + 6) % 7;
      totals[mondayIndex] += (point.inputTokens ?? 0) + (point.outputTokens ?? 0);
    }
    return totals;
  }, [tokenPoints]);
  const weekdayPeak = Math.max(...weekdayUsage, 1);
  const mostActiveDayIndex = weekdayUsage.indexOf(Math.max(...weekdayUsage));
  const mostActiveDay = WEEKDAYS[mostActiveDayIndex >= 0 ? mostActiveDayIndex : 0];
  const sessionCount = overview?.sessionCount ?? sessionsData?.total ?? 0;

  const networkItems = useMemo(() => {
    const items: {
      key: string;
      label: string;
      value: string;
      icon: ComponentType<{ className?: string }>;
      tone: string;
    }[] = [
      {
        key: 'linkedin',
        label: 'LinkedIn',
        value: profile.networks.linkedin,
        icon: Linkedin,
        tone: 'text-info',
      },
      { key: 'x', label: 'X', value: profile.networks.x, icon: Twitter, tone: 'text-foreground' },
      {
        key: 'instagram',
        label: 'Instagram',
        value: profile.networks.instagram,
        icon: Instagram,
        tone: 'text-fuchsia-400',
      },
      {
        key: 'github',
        label: 'GitHub',
        value: profile.networks.github,
        icon: Github,
        tone: 'text-foreground',
      },
      {
        key: 'website',
        label: 'Site',
        value: profile.networks.website,
        icon: Globe2,
        tone: 'text-muted-foreground',
      },
      {
        key: 'custom',
        label: profile.networks.customLabel || 'Rede',
        value: profile.networks.customValue,
        icon: Hash,
        tone: 'text-muted-foreground',
      },
    ];
    return items.filter((item) => item.value.trim().length > 0);
  }, [profile.networks]);

  function exportProfileCard(variant: ShareImageVariant) {
    const isCompact = variant === 'compact';
    const isComplete = variant === 'complete';
    const width = isCompact ? 1080 : 1200;
    const height = isCompact ? 1080 : isComplete ? 1480 : 900;
    const metricCards = [
      ['Total de tokens', formatTokens(totalTokens)],
      ['Pico de tokens', formatTokens(dailyPeakTokens)],
      ['Sessão mais longa', formatDuration(longestSessionMs)],
      ['Sequência atual', `${streaks.current} dias`],
      ['Maior sequência', `${streaks.longest} dias`],
    ];
    const visibleNetworks = networkItems.slice(0, isComplete ? 6 : 4);
    const metricWidth = isCompact ? 292 : isComplete ? 198 : 208;
    const metricStartX = isCompact ? 92 : 80;
    const metricY = isCompact ? 430 : 324;
    const renderedMetrics = metricCards
      .slice(0, isCompact ? 3 : 5)
      .map(([label, value], index) =>
        renderSvgMetricCard(
          metricStartX + index * (metricWidth + 18),
          metricY,
          metricWidth,
          label,
          value,
        ),
      )
      .join('');
    const renderedNetworks = visibleNetworks
      .map((item, index) =>
        renderSvgPill(
          80 + (index % 3) * 350,
          isComplete ? 560 + Math.floor(index / 3) * 58 : 452 + Math.floor(index / 3) * 58,
          item.value,
          320,
        ),
      )
      .join('');
    const heatmapY = isCompact ? 590 : isComplete ? 720 : 600;
    const renderedHighlights = `
  ${renderSvgMetricCard(80, isComplete ? 1028 : 704, 320, 'CLI favorita', favoriteCliLabel)}
  ${renderSvgMetricCard(440, isComplete ? 1028 : 704, 320, 'Modelo mais usado', topModel)}
  ${renderSvgMetricCard(800, isComplete ? 1028 : 704, 320, 'Projeto mais ativo', basename(topProject))}`;
    const renderedAchievements = `
  ${renderSvgPill(80, 1190, `${availableIntegrations.length} fontes conectadas`, 320)}
  ${renderSvgPill(440, 1190, '100% local-first', 320)}
  ${renderSvgPill(800, 1190, `${sessionCount} sessões indexadas`, 320)}`;
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#050807"/>
      <stop offset="55%" stop-color="#0b1512"/>
      <stop offset="100%" stop-color="#07110f"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="16" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${width}" height="${height}" rx="36" fill="url(#bg)"/>
  <text x="80" y="76" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#37d67a">SESSIONLENS</text>
  <text x="${width - 80}" y="76" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#98a39e">dados locais desta máquina</text>
  <circle cx="${width / 2}" cy="${isCompact ? 188 : 152}" r="${isCompact ? 78 : 60}" fill="#111917" stroke="#37d67a" stroke-width="4" filter="url(#glow)"/>
  <text x="${width / 2}" y="${isCompact ? 208 : 170}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${isCompact ? 50 : 38}" font-weight="700" fill="#f4fbf6">${escapeXml(getInitials(profile.name) || 'SL')}</text>
  <text x="${width / 2}" y="${isCompact ? 320 : 252}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${isCompact ? 56 : 46}" font-weight="700" fill="#f8fafc">${escapeXml(profile.name)}</text>
  <text x="${width / 2}" y="${isCompact ? 366 : 292}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#98a39e">${escapeXml(normalizeHandle(profile.handle))}</text>
  ${renderedMetrics}
  <text x="80" y="${heatmapY - 32}" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f8fafc">Atividade de tokens em ${new Date().getFullYear()}</text>
  ${renderSvgHeatmap(heatmap.months, 80, heatmapY, isCompact ? 5 : isComplete ? 5 : 4)}
  ${isCompact ? '' : `<text x="80" y="${isComplete ? 540 : 432}" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">Redes no perfil</text>${renderedNetworks}${renderedHighlights}`}
  ${isComplete ? `<text x="80" y="1160" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">Conquistas locais</text>${renderedAchievements}` : ''}
  <text x="${width / 2}" y="${height - 54}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#37d67a">Sessionlens · perfil local compartilhável</text>
</svg>`;
    downloadSvg(`sessionlens-perfil-${variant}.svg`, svg);
    setMenuOpen(false);
  }

  const cliDistribution = cliBreakdown.length
    ? cliBreakdown.slice(0, 5)
    : [{ label: favoriteCli, value: 1, percentage: 100 }];
  const conicGradient = cliDistribution
    .reduce(
      (acc, item, index) => {
        const next = acc.offset + item.percentage;
        acc.parts.push(`${chartColor(index)} ${acc.offset}% ${next}%`);
        acc.offset = next;
        return acc;
      },
      { parts: [] as string[], offset: 0 },
    )
    .parts.join(', ');

  return (
    <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3 lg:p-4">
      <div className="absolute right-3 top-3 z-10 lg:right-4 lg:top-4">
        <div className="relative">
          <Button
            variant="command"
            size="icon"
            aria-label="Abrir ações do perfil"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-20 w-64 overflow-hidden rounded-md border border-border bg-surface-elevated shadow-[var(--shadow-floating)]">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                onClick={() => {
                  setEditorOpen(true);
                  setMenuOpen(false);
                }}
              >
                <UserRound className="h-4 w-4 text-muted-foreground" />
                Editar perfil local
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                onClick={() => exportProfileCard('compact')}
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                Exportar SVG compacto
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                onClick={() => exportProfileCard('standard')}
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                Exportar SVG padrão
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
                onClick={() => exportProfileCard('complete')}
              >
                <Download className="h-4 w-4 text-muted-foreground" />
                Exportar SVG completo
              </button>
            </div>
          )}
        </div>
      </div>

      <section className="flex flex-col items-center gap-1 py-0 text-center">
        <div className="grid size-16 place-items-center rounded-full border border-accent/30 bg-accent-soft p-1 shadow-[0_0_28px_rgba(34,197,94,0.18)]">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.name}
              className="size-full rounded-full object-cover"
            />
          ) : (
            <div className="grid size-full place-items-center rounded-full bg-surface text-xl font-semibold text-foreground">
              {getInitials(profile.name) || <UserRound className="h-7 w-7" />}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-normal text-foreground">{profile.name}</h2>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
              {normalizeHandle(profile.handle)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5" />
            Dados armazenados somente nesta máquina
          </div>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Redes no perfil{' '}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Exibidas visualmente quando preenchidas.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Campos opcionais salvos localmente.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
            {networkItems.length > 0 ? (
              networkItems.map(({ key, ...item }) => <NetworkPill key={key} {...item} />)
            ) : (
              <div className="col-span-full rounded-md border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                Nenhuma rede preenchida. O perfil continua privado e local.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-8">
        <StatCard
          icon={Database}
          tone="info"
          value={formatTokens(totalTokens)}
          label="Total de tokens"
        />
        <StatCard
          icon={Zap}
          tone="info"
          value={formatTokens(dailyPeakTokens)}
          label="Pico de tokens"
        />
        <StatCard
          icon={Clock3}
          tone="success"
          value={formatDuration(longestSessionMs)}
          label="Sessão mais longa"
        />
        <StatCard
          icon={Flame}
          tone="warning"
          value={`${streaks.current} dias`}
          label="Sequência atual"
        />
        <StatCard
          icon={Trophy}
          tone="default"
          value={`${streaks.longest} dias`}
          label="Maior sequência"
        />
        <HighlightCard
          icon={<BrandMark value={favoriteCli} size="sm" />}
          label="CLI favorita"
          value={favoriteCliLabel}
        />
        <HighlightCard
          icon={<Sparkles className="h-5 w-5 text-info" />}
          label="Modelo mais usado"
          value={topModel}
        />
        <HighlightCard
          icon={<Globe2 className="h-5 w-5 text-fuchsia-400" />}
          label="Projeto mais ativo"
          value={basename(topProject)}
          meta={compactPath(topProject)}
        />
      </section>

      <Card className="overflow-hidden">
        <CardContent className="p-3">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-foreground">Atividade de tokens</h3>
            <div className="flex rounded-md border border-border bg-surface p-1">
              {(['daily', 'weekly', 'cumulative'] as HeatmapMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    'rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground',
                    heatmapMode === mode && 'bg-accent-soft text-accent',
                  )}
                  onClick={() => setHeatmapMode(mode)}
                >
                  {mode === 'daily' ? 'Diário' : mode === 'weekly' ? 'Semanal' : 'Acumulado'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-12 xl:gap-2">
            {heatmap.months.map((month) => (
              <div key={month.label} className="min-w-0">
                <div className="grid grid-flow-col grid-rows-7 justify-start gap-[3px]">
                  {month.weeks.flatMap((week) =>
                    week.map((cell) => (
                      <div
                        key={cell.key}
                        title={
                          cell.date
                            ? `${cell.date} - ${formatTokens(cell.tokens)} tokens - ${cell.sessions} sessões - ${formatCurrency(cell.cost)}`
                            : undefined
                        }
                        className={cn(
                          'size-1.5 rounded-[2px] 2xl:size-[7px]',
                          cell.isPadding ? 'bg-transparent' : HEATMAP_LEVELS[cell.level],
                        )}
                      />
                    )),
                  )}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{month.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid items-start gap-3 xl:grid-cols-[1fr_1fr_1fr]">
        <Card>
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">Ritmo de uso</h3>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-16">
              <svg viewBox="0 0 420 100" className="h-full w-full overflow-visible">
                <polyline
                  points={weekdayUsage
                    .map((value, index) => {
                      const x = 16 + index * 64;
                      const y = 82 - (value / weekdayPeak) * 60;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="rgb(var(--accent-rgb))"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {weekdayUsage.map((value, index) => {
                  const x = 16 + index * 64;
                  const y = 82 - (value / weekdayPeak) * 60;
                  return (
                    <circle
                      key={WEEKDAYS[index]}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="rgb(var(--accent-rgb))"
                    />
                  );
                })}
              </svg>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-accent/15 bg-accent-soft px-3 py-1.5 text-xs text-accent">
              <Clock3 className="h-3.5 w-3.5" />
              Maior atividade em {mostActiveDay}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <h3 className="mb-3 text-base font-semibold text-foreground">Distribuição por CLI</h3>
            <div className="grid gap-4 sm:grid-cols-[132px_1fr] sm:items-center">
              <div
                className="mx-auto grid size-28 place-items-center rounded-full"
                style={
                  {
                    '--profile-donut': conicGradient,
                    background: 'var(--profile-donut)',
                  } as CSSProperties
                }
              >
                <div className="grid size-16 place-items-center rounded-full border border-border bg-panel text-center">
                  <div>
                    <div className="text-base font-semibold text-foreground">
                      {cliDistribution.length}
                    </div>
                    <div className="text-[10px] uppercase text-muted-foreground">CLIs</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {cliDistribution.map((item, index) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: chartColor(index) }}
                      />
                      <span className="truncate">{getBrandMeta(item.label, 'cli').label}</span>
                    </span>
                    <span className="font-mono text-foreground">
                      {formatShortPercent(item.percentage)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <h3 className="mb-3 text-base font-semibold text-foreground">Conquistas locais</h3>
            <div className="space-y-1.5">
              <Achievement
                icon={ShieldCheck}
                title={`${availableIntegrations.length} fontes conectadas`}
                description="Todas ativas e sincronizadas"
                tone="success"
              />
              <Achievement
                icon={LockKeyhole}
                title="100% local-first"
                description="Seus dados permanecem locais"
                tone="info"
              />
              <Achievement
                icon={Database}
                title={`${sessionCount} sessões indexadas`}
                description="Histórico completo disponível"
                tone="default"
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {editorOpen && (
        <ProfileEditor
          profile={profile}
          onClose={() => setEditorOpen(false)}
          onSave={(nextProfile) => {
            setProfile({ ...nextProfile, handle: normalizeHandle(nextProfile.handle) });
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}

function NetworkPill({
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 text-xs text-foreground">
      <Icon className={cn('h-4 w-4 shrink-0', tone)} />
      <span className="truncate">{value}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: 'default' | 'info' | 'success' | 'warning';
  value: string;
  label: string;
}) {
  const toneClass = {
    default: 'bg-fuchsia-500/10 text-fuchsia-400',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
  }[tone];

  return (
    <Card>
      <CardContent className="flex min-h-16 items-center gap-3 p-3">
        <div className={cn('grid size-9 place-items-center rounded-full', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  icon,
  label,
  value,
  meta,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <Card interactive>
      <CardContent className="flex min-h-14 items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-muted">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="truncate text-base font-semibold text-foreground">{value}</div>
            {meta && <div className="truncate text-xs text-subtle-foreground">{meta}</div>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

function Achievement({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: 'default' | 'info' | 'success';
}) {
  const toneClass = {
    default: 'bg-fuchsia-500/10 text-fuchsia-400',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className={cn('grid size-7 shrink-0 place-items-center rounded-md', toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function ProfileEditor({
  profile,
  onClose,
  onSave,
}: {
  profile: LocalProfile;
  onClose: () => void;
  onSave: (profile: LocalProfile) => void;
}) {
  const [draft, setDraft] = useState<LocalProfile>(profile);

  function updateNetwork(key: keyof LocalProfile['networks'], value: string) {
    setDraft((current) => ({
      ...current,
      networks: { ...current.networks, [key]: value },
    }));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-md border border-border bg-panel shadow-[var(--shadow-floating)]"
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Editar perfil local</h3>
            <p className="text-sm text-muted-foreground">
              Dados visuais salvos apenas nesta máquina.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-foreground">
            Nome
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground">
            @ do perfil
            <Input
              value={draft.handle}
              onChange={(event) => setDraft({ ...draft, handle: event.target.value })}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
            URL do avatar
            <Input
              value={draft.avatarUrl}
              placeholder="https://..."
              onChange={(event) => setDraft({ ...draft, avatarUrl: event.target.value })}
            />
          </label>

          <div className="md:col-span-2">
            <div className="mb-3 text-sm font-medium text-foreground">Redes opcionais</div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={draft.networks.linkedin}
                placeholder="LinkedIn"
                onChange={(event) => updateNetwork('linkedin', event.target.value)}
              />
              <Input
                value={draft.networks.x}
                placeholder="X"
                onChange={(event) => updateNetwork('x', event.target.value)}
              />
              <Input
                value={draft.networks.instagram}
                placeholder="Instagram"
                onChange={(event) => updateNetwork('instagram', event.target.value)}
              />
              <Input
                value={draft.networks.github}
                placeholder="GitHub"
                onChange={(event) => updateNetwork('github', event.target.value)}
              />
              <Input
                value={draft.networks.website}
                placeholder="Site pessoal"
                onChange={(event) => updateNetwork('website', event.target.value)}
              />
              <div className="grid grid-cols-[90px_1fr] gap-2">
                <Input
                  value={draft.networks.customLabel}
                  placeholder="Label"
                  onChange={(event) => updateNetwork('customLabel', event.target.value)}
                />
                <Input
                  value={draft.networks.customValue}
                  placeholder="Rede personalizada"
                  onChange={(event) => updateNetwork('customValue', event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)}>
            <Save className="h-4 w-4" />
            Salvar perfil
          </Button>
        </div>
      </div>
    </div>
  );
}
