import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react';
import {
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Download,
  Flame,
  FolderGit2,
  Github,
  Globe2,
  Hash,
  Instagram,
  Linkedin,
  LockKeyhole,
  MessageCircle,
  PieChart,
  Save,
  Share2,
  Sparkles,
  Trophy,
  Upload,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { getBrandMeta } from '../components/brand/BrandMark.js';
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

interface GithubHeatmapData {
  weeks: HeatmapCell[][];
  monthLabels: { label: string; weekIndex: number }[];
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

// Clean single-hue ramp (GitHub uses one color family, not random hues)
const HEATMAP_LEVELS = [
  'bg-surface-muted/80',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const;

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

// Displays only the `/in/handle` portion of a LinkedIn value.
function displayLinkedin(value: string) {
  const match = value.match(/\/in\/[^/\s]+/);
  if (match) return match[0];
  const handle = value
    .replace(/^https?:\/\//, '')
    .replace(/^(www\.)?linkedin\.com\/?/, '')
    .replace(/^in\//, '')
    .replace(/\/+$/, '')
    .trim();
  return handle ? `/in/${handle}` : value;
}

// Official X (formerly Twitter) glyph — lucide ships only the legacy bird.
function XLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function buildGithubStyleHeatmap(
  tokenPoints: TokenPoint[],
  spendPoints: SpendPoint[],
  sessions: SessionRow[],
  mode: HeatmapMode,
): GithubHeatmapData {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();

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

  // Start from Monday of the week containing Jan 1
  const jan1 = new Date(year, 0, 1);
  const dayOfWeekOffset = (jan1.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start = new Date(jan1);
  start.setDate(start.getDate() - dayOfWeekOffset);

  const NUM_WEEKS = 53;
  const rawCells: HeatmapCell[] = [];

  for (let w = 0; w < NUM_WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const key = toDayKey(date);
      const isFuture = date > today;
      const isOutOfYear = date.getFullYear() !== year;

      const tokens = isFuture || isOutOfYear ? 0 : (tokenByDate.get(key) ?? 0);

      rawCells.push({
        key: isOutOfYear ? `pad-${w}-${d}` : key,
        date: isOutOfYear ? '' : key,
        tokens,
        sessions: isFuture || isOutOfYear ? 0 : (sessionsByDate.get(key) ?? 0),
        cost: isFuture || isOutOfYear ? 0 : (spendByDate.get(key)?.spend ?? 0),
        level: 0,
        isPadding: isOutOfYear,
      });
    }
  }

  if (mode === 'weekly') {
    for (let w = 0; w < NUM_WEEKS; w++) {
      const weekTotal = rawCells.slice(w * 7, w * 7 + 7).reduce((sum, c) => sum + c.tokens, 0);
      for (let d = 0; d < 7; d++) {
        if (!rawCells[w * 7 + d].isPadding) {
          rawCells[w * 7 + d].tokens = weekTotal;
        }
      }
    }
  } else if (mode === 'cumulative') {
    let running = 0;
    for (const cell of rawCells) {
      if (!cell.isPadding) {
        running += cell.tokens;
        cell.tokens = running;
      }
    }
  }

  const maxTokens = Math.max(...rawCells.map((c) => c.tokens), 1);
  for (const cell of rawCells) {
    cell.level =
      cell.isPadding || cell.tokens === 0
        ? 0
        : Math.min(4, Math.ceil((cell.tokens / maxTokens) * 4));
  }

  const weeks: HeatmapCell[][] = [];
  for (let w = 0; w < NUM_WEEKS; w++) {
    weeks.push(rawCells.slice(w * 7, w * 7 + 7));
  }

  const monthLabels: { label: string; weekIndex: number }[] = [];
  for (let m = 0; m < 12; m++) {
    const firstOfMonth = new Date(year, m, 1);
    const daysSinceStart = Math.floor((firstOfMonth.getTime() - start.getTime()) / 86400000);
    const weekIndex = Math.floor(daysSinceStart / 7);
    monthLabels.push({ label: MONTH_LABELS[m], weekIndex });
  }

  return { weeks, monthLabels };
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

// ─── SVG export — neutral palette, strict vertical flow (no overlaps) ─────────

const SVG = {
  textStrong: '#f4f0e9',
  text: '#cfc8ba',
  muted: '#8f8a7f',
  subtle: '#5f5b52',
  cardFill: '#181715',
  cardStroke: '#2c2a26',
  pillFill: '#131210',
  ring: '#3a3833',
  avatarFill: '#1d1c18',
  // Single warm-neutral ramp for the heatmap
  heatLevels: ['#1f1d19', '#393631', '#56524a', '#847f74', '#c6bba8'],
};

function renderSvgMetricCard(x: number, y: number, width: number, label: string, value: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="88" rx="14" fill="${SVG.cardFill}" stroke="${SVG.cardStroke}"/>
  <text x="${x + 18}" y="${y + 32}" font-family="Arial, sans-serif" font-size="14" fill="${SVG.muted}">${escapeXml(label)}</text>
  <text x="${x + 18}" y="${y + 67}" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${SVG.textStrong}">${escapeXml(value)}</text>`;
}

function renderSvgPill(x: number, y: number, label: string, width: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="42" rx="11" fill="${SVG.pillFill}" stroke="${SVG.cardStroke}"/>
  <text x="${x + 16}" y="${y + 27}" font-family="Arial, sans-serif" font-size="14" fill="${SVG.text}">${escapeXml(label)}</text>`;
}

// Renders the GitHub-style heatmap. `topY` is the baseline of the month labels;
// the cell grid begins 14px below it. Returns the block and its total height.
function renderSvgGithubHeatmap(
  data: GithubHeatmapData,
  x: number,
  topY: number,
  availableWidth: number,
): { svg: string; height: number } {
  const gap = 3;
  const dayLabelWidth = 30;
  const cellSize = Math.floor((availableWidth - dayLabelWidth - 52 * gap) / 53);
  const gridX = x + dayLabelWidth;
  const gridTop = topY + 14;
  const DAY_LABELS = ['Seg', '', 'Qua', '', 'Sex', '', ''];

  const monthLabelsSvg = data.monthLabels
    .map(({ label, weekIndex }) => {
      const mx = gridX + weekIndex * (cellSize + gap);
      return `<text x="${mx}" y="${topY}" font-family="Arial, sans-serif" font-size="13" fill="${SVG.muted}">${escapeXml(label)}</text>`;
    })
    .join('');

  const dayLabelsSvg = DAY_LABELS.map((name, i) => {
    if (!name) return '';
    const dy = gridTop + i * (cellSize + gap) + cellSize - 2;
    return `<text x="${x}" y="${dy}" font-family="Arial, sans-serif" font-size="11" fill="${SVG.muted}">${escapeXml(name)}</text>`;
  }).join('');

  const cellsSvg = data.weeks
    .flatMap((week, wi) =>
      week.map((cell, di) => {
        if (cell.isPadding || !cell.date) return '';
        const cx = gridX + wi * (cellSize + gap);
        const cy = gridTop + di * (cellSize + gap);
        return `<rect x="${cx}" y="${cy}" width="${cellSize}" height="${cellSize}" rx="2" fill="${SVG.heatLevels[cell.level]}"/>`;
      }),
    )
    .join('');

  const height = 14 + 7 * (cellSize + gap) - gap;
  return { svg: `${monthLabelsSvg}${dayLabelsSvg}${cellsSvg}`, height };
}

function generateProfileCardSvg(
  variant: ShareImageVariant,
  profile: LocalProfile,
  data: {
    totalTokens: number;
    dailyPeakTokens: number;
    totalDurationMs: number;
    streaks: { current: number; longest: number };
    sessionCount: number;
    favoriteCliLabel: string;
    topModel: string;
    topProject: string;
    heatmap: GithubHeatmapData;
    availableIntegrations: IntegrationStatusItem[];
    networkItems: { key: string; label: string; value: string }[];
  },
): string {
  const isCompact = variant === 'compact';
  const isComplete = variant === 'complete';
  const W = isCompact ? 1080 : 1200;
  const PAD = isCompact ? 80 : 72;
  const innerW = W - PAD * 2;
  const cx = W / 2;

  const allMetrics: [string, string][] = [
    ['Total de tokens', formatTokens(data.totalTokens)],
    ['Pico diário', formatTokens(data.dailyPeakTokens)],
    ['Tempo total', formatDuration(data.totalDurationMs)],
    ['Sequência atual', `${data.streaks.current} dias`],
    ['Melhor sequência', `${data.streaks.longest} dias`],
  ];

  const sections: string[] = [];

  // ── Header (brand + centered avatar/identity) ──
  const avatarCY = isCompact ? 178 : 144;
  const avatarR = isCompact ? 64 : 52;
  const clipId = `avatarClip_${variant}`;
  const hasAvatar = Boolean(profile.avatarUrl);
  sections.push(
    `<text x="${PAD}" y="50" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="${SVG.muted}">SESSIONLENS</text>`,
    `<text x="${W - PAD}" y="50" text-anchor="end" font-family="Arial, sans-serif" font-size="14" fill="${SVG.subtle}">dados locais · ${new Date().getFullYear()}</text>`,
    `<defs><clipPath id="${clipId}"><circle cx="${cx}" cy="${avatarCY}" r="${avatarR}"/></clipPath></defs>`,
    `<circle cx="${cx}" cy="${avatarCY}" r="${avatarR}" fill="${SVG.avatarFill}" stroke="${SVG.ring}" stroke-width="3"/>`,
    hasAvatar
      ? `<image href="${profile.avatarUrl}" x="${cx - avatarR}" y="${avatarCY - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
      : `<text x="${cx}" y="${avatarCY + avatarR * 0.34}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${avatarR * 0.78}" font-weight="700" fill="${SVG.textStrong}">${escapeXml(getInitials(profile.name) || 'SL')}</text>`,
  );

  // Vertical cursor begins below the avatar
  let y = avatarCY + avatarR + (isCompact ? 56 : 48);
  sections.push(
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${isCompact ? 46 : 40}" font-weight="700" fill="${SVG.textStrong}">${escapeXml(profile.name)}</text>`,
  );

  // ── Stats row ──
  y += isCompact ? 56 : 50;
  const statCount = isCompact ? 3 : 5;
  const statGap = 16;
  const statW = (innerW - (statCount - 1) * statGap) / statCount;
  sections.push(
    allMetrics
      .slice(0, statCount)
      .map(([label, value], i) =>
        renderSvgMetricCard(PAD + i * (statW + statGap), y, statW, label, value),
      )
      .join(''),
  );
  y += 88;

  // ── Heatmap ──
  y += isCompact ? 60 : 52;
  sections.push(
    `<text x="${PAD}" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${SVG.text}">Atividade de tokens em ${new Date().getFullYear()}</text>`,
  );
  y += 16;
  const heat = renderSvgGithubHeatmap(data.heatmap, PAD, y, innerW);
  sections.push(heat.svg);
  y += heat.height;

  // ── Highlights row (standard + complete) ──
  if (!isCompact) {
    y += 50;
    const hi: [string, string][] = [
      ['CLI favorita', data.favoriteCliLabel],
      ['Modelo mais usado', data.topModel],
      ['Projeto mais ativo', basename(data.topProject)],
    ];
    const hiGap = 16;
    const hiW = (innerW - 2 * hiGap) / 3;
    sections.push(
      hi
        .map(([label, value], i) =>
          renderSvgMetricCard(PAD + i * (hiW + hiGap), y, hiW, label, value),
        )
        .join(''),
    );
    y += 88;
  }

  // ── Networks + achievements (complete only) ──
  if (isComplete) {
    y += 50;
    sections.push(
      `<text x="${PAD}" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${SVG.text}">Redes no perfil</text>`,
    );
    y += 18;
    const pillGap = 16;
    const pillW = (innerW - 2 * pillGap) / 3;
    const nets = data.networkItems.slice(0, 6);
    sections.push(
      nets
        .map((item, i) =>
          renderSvgPill(
            PAD + (i % 3) * (pillW + pillGap),
            y + Math.floor(i / 3) * 54,
            item.value,
            pillW,
          ),
        )
        .join(''),
    );
    y += Math.ceil(nets.length / 3) * 54 + 8;

    y += 36;
    sections.push(
      `<text x="${PAD}" y="${y}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="${SVG.text}">Conquistas locais</text>`,
    );
    y += 18;
    const achievements = [
      `${data.availableIntegrations.length} fontes conectadas`,
      '100% local-first',
      `${data.sessionCount} sessões indexadas`,
    ];
    sections.push(
      achievements
        .map((label, i) => renderSvgPill(PAD + i * (pillW + pillGap), y, label, pillW))
        .join(''),
    );
    y += 42;
  }

  // ── Footer ──
  y += isCompact ? 48 : 44;
  const height = y + 20;
  sections.push(
    `<line x1="${PAD}" y1="${y - 22}" x2="${W - PAD}" y2="${y - 22}" stroke="${SVG.cardStroke}"/>`,
    `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="${SVG.muted}">sessionlens · perfil local compartilhável</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}">
  <defs>
    <linearGradient id="sl-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0d0c0b"/>
      <stop offset="100%" stop-color="#151311"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${height}" rx="28" fill="url(#sl-bg)"/>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${height - 1}" rx="27.5" fill="none" stroke="#26241f"/>
  ${sections.join('\n  ')}
</svg>`;
}

export function ProfilePage() {
  const { profile, setProfile } = useLocalProfile();
  const [editorOpen, setEditorOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
  const totalDurationMs =
    overview?.totalDurationMs ??
    sessions.reduce((sum, session) => sum + Number(session.duration_ms ?? 0), 0);
  const streaks = useMemo(() => calculateStreaks(sessions), [sessions]);
  const heatmap = useMemo(
    () => buildGithubStyleHeatmap(tokenPoints, spendPoints, sessions, heatmapMode),
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
  const sessionCount = overview?.sessionCount ?? sessionsData?.total ?? 0;

  function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfile({ ...profile, avatarUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

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
        value: displayLinkedin(profile.networks.linkedin),
        icon: Linkedin,
        tone: 'text-info',
      },
      {
        key: 'x',
        label: 'X',
        value: profile.networks.x,
        icon: XLogo,
        tone: 'text-foreground',
      },
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

  const shareData = {
    totalTokens,
    dailyPeakTokens,
    totalDurationMs,
    streaks,
    sessionCount,
    favoriteCliLabel,
    topModel,
    topProject,
    heatmap,
    availableIntegrations,
    networkItems,
  };

  return (
    <div className="relative w-full">
      {/* ── Top-left privacy badge ── */}
      <div className="absolute left-4 top-1 z-10 hidden items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
        <LockKeyhole className="h-3 w-3 text-success" />
        Dados somente nesta máquina
      </div>

      {/* ── Top-right actions ── */}
      <div className="absolute right-4 top-1 z-10 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
          <UserRound className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Editar perfil</span>
        </Button>
        <Button size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Compartilhar</span>
        </Button>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
        {/* ── Centered identity header ── */}
        <section className="flex flex-col items-center gap-2 pt-6 text-center sm:pt-1">
          <label className="group relative grid size-16 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-surface-muted">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarFile}
              aria-label="Carregar imagem de avatar"
            />
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
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-4 w-4 text-white" />
            </span>
          </label>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold leading-tight text-foreground">{profile.name}</h2>
          </div>

          {/* Social networks — single row */}
          {networkItems.length > 0 && (
            <div className="flex w-full flex-nowrap justify-center gap-2 overflow-x-auto pb-1 pt-0.5">
              {networkItems.map(({ key, ...item }) => (
                <NetworkPill key={key} {...item} />
              ))}
            </div>
          )}
        </section>

        {/* ── Stats ── */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
            label="Pico diário"
          />
          <StatCard
            icon={Clock3}
            tone="success"
            value={formatDuration(totalDurationMs)}
            label="Tempo total"
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
            label="Melhor sequência"
          />
        </section>

        {/* ── GitHub-style heatmap ── */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Atividade de tokens em {new Date().getFullYear()}
              </h3>
              <div className="flex rounded-md border border-border bg-surface p-0.5">
                {(['daily', 'weekly', 'cumulative'] as HeatmapMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      'cursor-pointer rounded px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground',
                      heatmapMode === mode && 'bg-accent-soft text-accent',
                    )}
                    onClick={() => setHeatmapMode(mode)}
                  >
                    {mode === 'daily' ? 'Diário' : mode === 'weekly' ? 'Semanal' : 'Acumulado'}
                  </button>
                ))}
              </div>
            </div>
            <GithubHeatmap data={heatmap} />
          </CardContent>
        </Card>

        {/* ── Insights 3×1 ── */}
        <section className="grid items-stretch gap-3 lg:grid-cols-3">
          <BreakdownCard
            title="Modelo mais usado"
            icon={<Sparkles className="h-4 w-4 text-info" />}
            primaryValue={topModel}
            items={modelBreakdown}
            renderLabel={(label) => label}
            renderValue={(item) => formatShortPercent(item.percentage)}
          />

          <Card className="h-full">
            <CardContent className="flex h-full flex-col p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Distribuição por CLI</h3>
                <div className="grid size-7 place-items-center rounded-md border border-border bg-surface-muted">
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="grid flex-1 place-items-center gap-3 sm:grid-cols-[104px_1fr] sm:place-items-stretch">
                <div
                  className="mx-auto grid size-24 place-items-center rounded-full"
                  style={
                    {
                      '--profile-donut': conicGradient,
                      background: 'var(--profile-donut)',
                    } as CSSProperties
                  }
                >
                  <div className="grid size-14 place-items-center rounded-full border border-border bg-panel text-center">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {cliDistribution.length}
                      </div>
                      <div className="text-[9px] uppercase text-muted-foreground">CLIs</div>
                    </div>
                  </div>
                </div>
                <div className="flex w-full flex-col justify-center space-y-1.5">
                  {cliDistribution.map((item, index) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span
                          className="size-2 shrink-0 rounded-full"
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

          <BreakdownCard
            title="Projeto mais ativo"
            icon={<FolderGit2 className="h-4 w-4 text-fuchsia-400" />}
            primaryValue={basename(topProject)}
            primaryMeta={compactPath(topProject)}
            items={projectBreakdown}
            renderLabel={(label) => basename(label)}
            renderValue={(item) => `${item.value} sess.`}
          />
        </section>
      </div>

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

      {shareOpen && (
        <ShareModal profile={profile} data={shareData} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

// ─── GithubHeatmap component ─────────────────────────────────────────────────

function GithubHeatmap({ data }: { data: GithubHeatmapData }) {
  const DAY_LABELS = ['Seg', '', 'Qua', '', 'Sex', '', ''];
  const gap = 3;

  return (
    <div className="w-full">
      {/* Month labels — positioned as a fraction of the full width */}
      <div className="relative mb-1 ml-[30px] h-4">
        {data.monthLabels.map(({ label, weekIndex }) => (
          <span
            key={label}
            className="absolute select-none text-[10px] leading-4 text-muted-foreground"
            style={{ left: `${(weekIndex / 53) * 100}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex items-stretch" style={{ gap: 6 }}>
        {/* Day labels */}
        <div
          className="grid w-5 shrink-0"
          style={{ gridTemplateRows: 'repeat(7, 1fr)', gap: `${gap}px` }}
        >
          {DAY_LABELS.map((day, index) => (
            <div
              key={index}
              className="flex select-none items-center justify-end text-[9px] leading-none text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Cell grid — fills the remaining width, square cells */}
        <div
          className="grid flex-1"
          style={{
            gridTemplateColumns: 'repeat(53, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(7, auto)',
            gridAutoFlow: 'column',
            gap: `${gap}px`,
          }}
        >
          {data.weeks.flatMap((week) =>
            week.map((cell) => (
              <div
                key={cell.key}
                title={
                  cell.date
                    ? `${cell.date} · ${formatTokens(cell.tokens)} tokens · ${cell.sessions} sessões · ${formatCurrency(cell.cost)}`
                    : undefined
                }
                className={cn(
                  'aspect-square rounded-[2px] transition-opacity hover:opacity-80',
                  cell.isPadding ? 'invisible' : HEATMAP_LEVELS[cell.level],
                )}
              />
            )),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="ml-[30px] mt-2 flex items-center justify-end gap-1">
        <span className="text-[10px] text-muted-foreground">Menos</span>
        {HEATMAP_LEVELS.map((level, i) => (
          <div key={i} className={cn('size-[11px] rounded-[2px]', level.split(' ')[0])} />
        ))}
        <span className="text-[10px] text-muted-foreground">Mais</span>
      </div>
    </div>
  );
}

// ─── ShareModal (10.1.1, 10.1.2, 10.1.3) ────────────────────────────────────

function ShareModal({
  profile,
  data,
  onClose,
}: {
  profile: LocalProfile;
  data: {
    totalTokens: number;
    dailyPeakTokens: number;
    totalDurationMs: number;
    streaks: { current: number; longest: number };
    sessionCount: number;
    favoriteCliLabel: string;
    topModel: string;
    topProject: string;
    heatmap: GithubHeatmapData;
    availableIntegrations: IntegrationStatusItem[];
    networkItems: { key: string; label: string; value: string }[];
  };
  onClose: () => void;
}) {
  const [variant, setVariant] = useState<ShareImageVariant>('standard');
  const [copied, setCopied] = useState(false);

  const variantConfig: Record<ShareImageVariant, { label: string; desc: string }> = {
    compact: { label: 'Quadrado', desc: '1080 · social' },
    standard: { label: 'Padrão', desc: '1200 · wide' },
    complete: { label: 'Completo', desc: '1200 · full' },
  };

  const svgContent = useMemo(
    () => generateProfileCardSvg(variant, profile, data),
    [variant, profile, data],
  );

  const shareText = useMemo(
    () =>
      [
        `Meu perfil no Sessionlens:`,
        `• ${formatTokens(data.totalTokens)} tokens processados`,
        `• ${data.sessionCount} sessões de IA`,
        `• Sequência: ${data.streaks.current} dias ativos`,
        `• CLI favorita: ${data.favoriteCliLabel}`,
        `\n#Sessionlens #AI #DevTools`,
      ].join('\n'),
    [data],
  );

  function handleDownload() {
    downloadSvg(`sessionlens-perfil-${variant}.svg`, svgContent);
  }

  function handleShareX() {
    handleDownload();
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleShareLinkedIn() {
    handleDownload();
    void navigator.clipboard.writeText(shareText).catch(() => {});
    window.open('https://www.linkedin.com/feed/', '_blank', 'noopener,noreferrer');
  }

  function handleShareWhatsApp() {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleCopyText() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  const previewSrc = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`,
    [svgContent],
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compartilhar perfil"
        className="max-h-[90dvh] w-full max-w-md overflow-auto rounded-xl border border-border bg-panel shadow-[var(--shadow-floating)]"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Compartilhar perfil</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          {/* Format selector (10.1.3 - customização) */}
          <div className="grid grid-cols-3 gap-2">
            {(
              Object.entries(variantConfig) as [
                ShareImageVariant,
                { label: string; desc: string },
              ][]
            ).map(([v, { label, desc }]) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={cn(
                  'cursor-pointer rounded-lg border px-2 py-2 text-center transition-colors',
                  variant === v
                    ? 'border-accent/50 bg-accent-soft text-foreground'
                    : 'border-border bg-surface-muted text-muted-foreground hover:border-border-strong hover:text-foreground',
                )}
              >
                <div className="text-xs font-medium">{label}</div>
                <div className="text-[10px] opacity-60">{desc}</div>
              </button>
            ))}
          </div>

          {/* Live preview (10.1.3) */}
          <div className="overflow-hidden rounded-lg border border-border bg-[#0d0c0b] p-2">
            <img
              src={previewSrc}
              alt="Preview do card de perfil"
              className="mx-auto w-full object-contain"
              style={{ maxHeight: 300 }}
            />
          </div>

          {/* Download (10.1.1) */}
          <Button className="w-full" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Baixar card SVG
          </Button>

          {/* Social (10.1.2 - múltiplas redes) */}
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Compartilhar nas redes
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ShareButton icon={XLogo} label="X" onClick={handleShareX} />
              <ShareButton
                icon={Linkedin}
                label="LinkedIn"
                iconClass="text-info"
                onClick={handleShareLinkedIn}
              />
              <ShareButton
                icon={MessageCircle}
                label="WhatsApp"
                iconClass="text-success"
                onClick={handleShareWhatsApp}
              />
              <button
                type="button"
                onClick={handleCopyText}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-colors',
                  copied
                    ? 'border-accent/40 bg-accent-soft text-accent'
                    : 'border-border bg-surface-muted text-foreground hover:bg-surface-hover',
                )}
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copiado!' : 'Copiar texto'}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Em X e LinkedIn, o card SVG é baixado para você anexar ao post.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareButton({
  icon: Icon,
  label,
  iconClass,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  iconClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-surface-hover"
    >
      <Icon className={cn('h-3.5 w-3.5', iconClass)} />
      {label}
    </button>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs text-foreground">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', tone)} />
      <span className="max-w-[180px] truncate">{value}</span>
    </span>
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
      <CardContent className="flex items-center gap-2.5 p-3">
        <div className={cn('grid size-8 shrink-0 place-items-center rounded-full', toneClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight text-foreground">
            {value}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  icon,
  primaryValue,
  primaryMeta,
  items,
  renderLabel,
  renderValue,
}: {
  title: string;
  icon: ReactNode;
  primaryValue: string;
  primaryMeta?: string;
  items: BreakdownItem[];
  renderLabel: (label: string) => string;
  renderValue: (item: BreakdownItem) => string;
}) {
  const max = items[0]?.value ?? 1;

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <div className="grid size-7 place-items-center rounded-md border border-border bg-surface-muted">
            {icon}
          </div>
        </div>

        <div className="mb-3 min-w-0">
          <div className="truncate text-lg font-semibold text-foreground">{primaryValue}</div>
          {primaryMeta && (
            <div className="truncate text-[11px] text-muted-foreground">{primaryMeta}</div>
          )}
        </div>

        <div className="mt-auto space-y-2">
          {items.length > 0 ? (
            items.slice(0, 4).map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-muted-foreground">{renderLabel(item.label)}</span>
                  <span className="shrink-0 font-mono text-foreground">{renderValue(item)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground">Sem dados suficientes.</div>
          )}
        </div>
      </CardContent>
    </Card>
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

  function handleDraftAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft((current) => ({ ...current, avatarUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90dvh] w-full max-w-3xl overflow-auto rounded-xl border border-border bg-panel shadow-[var(--shadow-floating)]"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">Editar perfil local</h3>
            <p className="text-xs text-muted-foreground">
              Dados visuais salvos apenas nesta máquina.
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-foreground">
            Nome
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <div className="space-y-1.5 md:col-span-2">
            <div className="text-xs font-medium text-foreground">Avatar</div>
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-muted">
                {draft.avatarUrl ? (
                  <img
                    src={draft.avatarUrl}
                    alt="Avatar"
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  <UserRound className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <Input
                className="flex-1"
                value={draft.avatarUrl.startsWith('data:') ? '' : draft.avatarUrl}
                placeholder="Cole uma URL ou carregue do computador"
                onChange={(event) => setDraft({ ...draft, avatarUrl: event.target.value })}
              />
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-hover">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleDraftAvatarFile}
                />
                <Upload className="h-3.5 w-3.5" />
                Carregar
              </label>
            </div>
            {draft.avatarUrl && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, avatarUrl: '' })}
                className="cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Remover avatar
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-medium text-foreground">Redes opcionais</div>
            <div className="grid gap-2.5 md:grid-cols-2">
              <Input
                value={draft.networks.linkedin}
                placeholder="LinkedIn"
                onChange={(event) => updateNetwork('linkedin', event.target.value)}
              />
              <Input
                value={draft.networks.x}
                placeholder="X / Twitter"
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
              <div className="grid grid-cols-[88px_1fr] gap-2">
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
