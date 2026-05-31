import type { SVGProps } from 'react';
import { Badge } from '../ui/Badge.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { Tooltip } from '../ui/Tooltip.js';
import { cn } from '../../lib/utils.js';

type LogoRoute = string | { light: string; dark: string };
type CustomLogo = 'opencode' | 'commandcode';

interface BrandMeta {
  label: string;
  initials: string;
  color: string;
  logo?: LogoRoute;
  customLogo?: CustomLogo;
}

const OPENAI = {
  light: 'https://svgl.app/library/openai.svg',
  dark: 'https://svgl.app/library/openai_dark.svg',
};
const ANTHROPIC = {
  light: 'https://svgl.app/library/anthropic_black.svg',
  dark: 'https://svgl.app/library/anthropic_white.svg',
};
const GOOGLE = 'https://svgl.app/library/google.svg';

const CLI_BRANDS: Record<string, BrandMeta> = {
  codex: { label: 'Codex CLI', initials: 'CX', color: '#8b5cf6', logo: OPENAI },
  claude: {
    label: 'Claude Code',
    initials: 'CL',
    color: '#d97706',
    logo: 'https://svgl.app/library/claude-ai-icon.svg',
  },
  opencode: { label: 'OpenCode', initials: 'OC', color: '#131010', customLogo: 'opencode' },
  gemini: { label: 'Gemini CLI', initials: 'GE', color: '#4285f4', logo: GOOGLE },
  kimi: {
    label: 'Kimi CLI',
    initials: 'KI',
    color: '#06b6d4',
    logo: 'https://svgl.app/library/kimi-icon.svg',
  },
  aider: { label: 'Aider', initials: 'AI', color: '#14b8a6' },
  qwen: {
    label: 'Qwen CLI',
    initials: 'QW',
    color: '#615ced',
    logo: {
      light: 'https://svgl.app/library/qwen_light.svg',
      dark: 'https://svgl.app/library/qwen_dark.svg',
    },
  },
  antigravity: {
    label: 'Antigravity',
    initials: 'AG',
    color: '#f59e0b',
    logo: 'https://svgl.app/library/antigravity.svg',
  },
  commandcode: {
    label: 'CommandCode',
    initials: 'CC',
    color: '#000000',
    customLogo: 'commandcode',
  },
};

const PROVIDER_BRANDS: Record<string, BrandMeta> = {
  openai: { label: 'OpenAI', initials: 'OA', color: '#111827', logo: OPENAI },
  anthropic: { label: 'Anthropic', initials: 'AN', color: '#d97706', logo: ANTHROPIC },
  google: { label: 'Google', initials: 'GO', color: '#4285f4', logo: GOOGLE },
  deepseek: {
    label: 'DeepSeek',
    initials: 'DS',
    color: '#2563eb',
    logo: 'https://svgl.app/library/deepseek.svg',
  },
  minimax: { label: 'MiniMax', initials: 'MM', color: '#7c3aed' },
  nvidia: {
    label: 'NVIDIA',
    initials: 'NV',
    color: '#76b900',
    logo: {
      light: 'https://svgl.app/library/nvidia-icon-light.svg',
      dark: 'https://svgl.app/library/nvidia-icon-dark.svg',
    },
  },
  opencode: { label: 'OpenCode', initials: 'OC', color: '#131010', customLogo: 'opencode' },
  'github-copilot': {
    label: 'GitHub Copilot',
    initials: 'CP',
    color: '#6366f1',
    logo: {
      light: 'https://svgl.app/library/copilot.svg',
      dark: 'https://svgl.app/library/copilot_dark.svg',
    },
  },
};

export function getBrandMeta(
  value: string | null | undefined,
  kind: 'cli' | 'provider' = 'cli',
): BrandMeta {
  const key = (value ?? 'unknown').toLowerCase();
  const map = kind === 'cli' ? CLI_BRANDS : PROVIDER_BRANDS;
  return (
    map[key] ?? {
      label: value || 'Unknown',
      initials: (value || 'UN').slice(0, 2).toUpperCase(),
      color: '#64748b',
    }
  );
}

export function BrandMark({
  value,
  kind = 'cli',
  size = 'md',
  className,
}: {
  value: string | null | undefined;
  kind?: 'cli' | 'provider';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { theme } = useTheme();
  const meta = getBrandMeta(value, kind);
  const logo = typeof meta.logo === 'string' ? meta.logo : meta.logo?.[theme];
  const CustomLogo =
    meta.customLogo === 'opencode'
      ? OpenCodeLogo
      : meta.customLogo === 'commandcode'
        ? CommandCodeLogo
        : null;
  const sizeClass =
    size === 'sm'
      ? 'h-7 w-7 rounded-md text-[10px]'
      : size === 'lg'
        ? 'h-12 w-12 rounded-lg text-sm'
        : 'h-9 w-9 rounded-md text-xs';

  return (
    <Tooltip content={meta.label}>
      <span
        className={cn(
          'grid shrink-0 place-items-center border border-border bg-surface-elevated font-semibold text-white',
          sizeClass,
          className,
        )}
        style={{
          color: logo || CustomLogo ? undefined : '#fff',
          backgroundColor: logo || CustomLogo ? undefined : meta.color,
        }}
      >
        {CustomLogo ? (
          <CustomLogo className="h-full w-full" />
        ) : logo ? (
          <img
            src={logo}
            alt={`${meta.label} logo`}
            className="h-4/5 w-4/5 object-contain"
            loading="lazy"
          />
        ) : (
          meta.initials
        )}
      </span>
    </Tooltip>
  );
}

function OpenCodeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" {...props}>
      <rect width="512" height="512" fill="#131010" />
      <path d="M320 224V352H192V224H320Z" fill="#5A5858" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
        fill="white"
      />
    </svg>
  );
}

function CommandCodeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 137 137" fill="none" aria-hidden="true" {...props}>
      <path
        d="M0 66.7959C0 35.308 0 19.5641 9.78204 9.78204C19.5641 0 35.308 0 66.796 0H69.3317C100.82 0 116.564 0 126.346 9.78204C136.128 19.5641 136.128 35.308 136.128 66.7959V69.3316C136.128 100.82 136.128 116.564 126.346 126.346C116.564 136.128 100.82 136.128 69.3316 136.128H66.7959C35.308 136.128 19.5641 136.128 9.78204 126.346C0 116.564 0 100.82 0 69.3316V66.7959Z"
        fill="#000"
      />
      <path
        clipRule="evenodd"
        d="M69.3317 5.56633H66.796C50.8946 5.56633 39.5286 5.57815 30.891 6.73945C22.4135 7.87922 17.4024 10.0336 13.718 13.718C10.0336 17.4024 7.87922 22.4135 6.73945 30.891C5.57815 39.5286 5.56633 50.8946 5.56633 66.7959V69.3316C5.56633 85.233 5.57815 96.599 6.73945 105.237C7.87922 113.714 10.0336 118.725 13.718 122.41C17.4024 126.094 22.4135 128.248 30.891 129.388C39.5286 130.549 50.8946 130.561 66.796 130.561H69.3317C85.2331 130.561 96.5991 130.549 105.237 129.388C113.714 128.248 118.725 126.094 122.41 122.41C126.094 118.725 128.248 113.714 129.388 105.237C130.549 96.599 130.561 85.233 130.561 69.3316V66.7959C130.561 50.8946 130.549 39.5286 129.388 30.891C128.248 22.4135 126.094 17.4024 122.41 13.718C118.725 10.0336 113.714 7.87922 105.237 6.73945C96.599 5.57815 85.233 5.56633 69.3317 5.56633ZM9.78204 9.78204C0 19.5641 0 35.308 0 66.7959V69.3316C0 100.82 0 116.564 9.78204 126.346C19.5641 136.128 35.308 136.128 66.796 136.128H69.3317C100.820 136.128 116.564 136.128 126.346 126.346C136.128 116.564 136.128 100.82 136.128 69.3316V66.7959C136.128 35.308 136.128 19.5641 126.346 9.78204C116.564 0 100.82 0 69.3317 0H66.796C35.308 0 19.5641 0 9.78204 9.78204Z"
        fill="#000"
        fillRule="evenodd"
      />
      <path
        d="M93.6604 26.1784C84.6784 26.1784 77.3717 33.4851 77.3717 42.4672V49.4481H58.7559V42.4672C58.7559 33.4851 51.4492 26.1784 42.4672 26.1784C33.4851 26.1784 26.1784 33.4851 26.1784 42.4672C26.1784 51.4493 33.4851 58.756 42.4672 58.756H49.4481V77.3718H42.4672C33.4851 77.3718 26.1784 84.6785 26.1784 93.6606C26.1784 102.643 33.4851 109.949 42.4672 109.949C51.4492 109.949 58.7559 102.643 58.7559 93.6606V86.6796H77.3717V93.6606C77.3717 102.643 84.6784 109.949 93.6604 109.949C102.643 109.949 109.949 102.643 109.949 93.6606C109.949 84.6785 102.643 77.3718 93.6604 77.3718H86.6796V58.756H93.6604C102.643 58.756 109.949 51.4494 109.949 42.4672C109.949 33.4851 102.643 26.1784 93.6604 26.1784ZM86.6796 49.4481V42.4672C86.6796 38.6044 89.7978 35.4862 93.6604 35.4862C97.5232 35.4862 100.641 38.6043 100.641 42.4672C100.641 46.33 97.523 49.4481 93.6604 49.4481H86.6796ZM42.4672 49.4481C38.6044 49.4481 35.4863 46.33 35.4863 42.4672C35.4863 38.6044 38.6044 35.4862 42.4672 35.4862C46.33 35.4862 49.4481 38.6043 49.4481 42.4672V49.4481H42.4672ZM58.7559 77.3717V58.7559H77.3717V77.3717H58.7559ZM93.6604 100.641C89.7977 100.641 86.6796 97.523 86.6796 93.6606V86.6796H93.6604C97.5232 86.6796 100.641 89.7978 100.641 93.6606C100.641 97.5233 97.523 100.641 93.6604 100.641ZM42.4672 100.641C38.6044 100.641 35.4863 97.5233 35.4863 93.6606C35.4863 89.7978 38.6044 86.6796 42.4672 86.6796H49.4481V93.6606C49.4481 97.523 46.33 100.641 42.4672 100.641Z"
        fill="#fff"
      />
    </svg>
  );
}

export function BrandBadge({
  value,
  kind = 'cli',
}: {
  value: string | null | undefined;
  kind?: 'cli' | 'provider';
}) {
  const meta = getBrandMeta(value, kind);

  return (
    <Badge variant="neutral" className="gap-1.5 py-1 pr-2.5">
      <BrandMark
        value={value}
        kind={kind}
        size="sm"
        className="h-4 w-4 rounded-[4px] border-0 text-[7px] shadow-none"
      />
      {meta.label}
    </Badge>
  );
}
