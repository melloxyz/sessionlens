<div align="center">

# Sessionlens

**Local-first observability for AI Coding CLIs — multi-CLI, open-source, private.**

[![License: MIT](https://img.shields.io/badge/License-MIT-00c853.svg?style=flat-square)](LICENSE)
[![v0.9.3](https://img.shields.io/badge/v0.9.3-00c853?style=flat-square)](https://github.com/melloxyz/sessionlens/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/README-English-00c853?style=for-the-badge" alt="English README"/></a>
  <a href="README.pt-br.md"><img src="https://img.shields.io/badge/README-Português%20(BR)-00c853?style=for-the-badge" alt="README em Português (BR)"/></a>
</p>

_Track costs, analyze sessions and compare efficiency across your AI CLIs — fully offline, fully local._

[Features](#features) ·
[Quick Start](#quick-start) ·
[Stack](#tech-stack) ·
[Architecture](#architecture) ·
[Integrations](#supported-integrations) ·
[Contributing](CONTRIBUTING.md)

<br/>

<table>
  <tr>
    <td align="center"><strong>Dashboard</strong><br/><img src="assets/screenshots/dashboard-screenshot.png" alt="Dashboard" width="380"/></td>
    <td align="center"><strong>Sessions</strong><br/><img src="assets/screenshots/sessions-screenshot.png" alt="Sessions" width="380"/></td>
  </tr>
  <tr>
    <td align="center"><strong>Analytics</strong><br/><img src="assets/screenshots/analytics-screenshot.png" alt="Analytics" width="380"/></td>
    <td align="center"><strong>Budgets</strong><br/><img src="assets/screenshots/budgets-screenshot.png" alt="Budgets" width="380"/></td>
  </tr>
</table>

</div>

---

## Features

| Feature                 | Description                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-CLI**           | Support for 9 CLIs: Codex, Claude Code, OpenCode, Gemini CLI, Kimi, Aider, Qwen, Antigravity, and CommandCode                                                                |
| **Cost tracking**       | Real CLI cost, token-based estimation, and OpenRouter sync for up-to-date pricing                                                                                            |
| **Smart sessions**      | Tokens (input/output/cache/reasoning), tool calls, duration, project context, per-model usage                                                                                |
| **Analytics**           | Dashboard with contextual filters, spend trends, breakdowns by model/provider/project, dedicated insight and anomaly pages                                                   |
| **Data reliability**    | Session source, per-field quality, captured tools, touched files, and per-CLI coverage in Settings and Session Detail                                                        |
| **Budgets**             | Set global, per-project, CLI, provider, or model limits with local alert history                                                                                             |
| **Local-first privacy** | SQLite via sql.js WASM — zero data sent externally, zero telemetry                                                                                                           |
| **Auto-ingestion**      | Filesystem watcher with debounce observes CLI directories and updates automatically                                                                                          |
| **Premium UI**          | Sessionlens's own design system, inspired by editorial and technical interfaces, with DataPanel, DataTable, CompactStat, ControlField, skeleton/loading states, and tooltips |
| **Themes**              | Dark and light mode with refined contrast, accessible chart palette, and persistence via localStorage                                                                        |
| **i18n**                | English and Portuguese (PT-BR) with localized date, duration, and currency formatting                                                                                        |
| **System Tray**         | Windows tray icon with auto-start, quick ingestion, and live status                                                                                                          |
| **Project controls**    | Hide/restore projects without deleting data, open project folder, follow git timeline and related sessions                                                                   |
| **Cached API**          | Cached and validated requests for faster and more consistent responses                                                                                                       |

### Highlights in v0.9.3

> `v0.9.3` is the current release. All changes listed below are live.

- **Cost integrity across all adapters (Fase 2):** `resolveSessionCost` now reads each adapter's declared `dataQuality.cost` field instead of defaulting every session with a cost value to `actual`. Sessions correctly show `actual`, `estimated` or `unknown` based on real adapter evidence.
- **Claude: per-model pricing:** the Claude adapter now extracts the exact model from each assistant event (`message.model`) and accumulates tokens per model. Costs are estimated by the engine per model instead of using a hardcoded Sonnet rate.
- **Codex: engine-delegated pricing:** removed the internal 70/30 token-split cost estimate. The adapter sets `totalCostUsd: null` and the costing engine uses real token events (or the 70/30 fallback only when no per-event data exists) to price correctly.
- **OpenCode: eliminated double-counting:** `session.cost` and per-message cost sums were being added together. The fix uses `session.cost` when available, or falls back to the message sum — never both.
- **PreferencesProvider foundation:** user preference state management extracted into a dedicated context provider.
- **Database reliability:** redundant `saveDatabase` calls removed; backup handling improved.
- **CI/CD:** branch name corrected from `main` to `master` in the release workflow; job names improved.
- **Test coverage:** `resolveSessionCost` unit tests and adapter-level integration tests for Claude, Codex and OpenCode cost handling.

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/melloxyz/sessionlens.git
cd sessionlens

# Install dependencies
pnpm install

# Run in development mode
pnpm dev
```

Open the frontend at **http://localhost:5173** — the backend runs on **http://127.0.0.1:3030**.

### Commands

| Command                                                | Description                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------- |
| `pnpm dev`                                             | Full stack (backend + frontend)                                            |
| `pnpm typecheck`                                       | Typecheck across all packages                                              |
| `pnpm lint`                                            | Lint across all packages                                                   |
| `pnpm build`                                           | Production build                                                           |
| `pnpm --filter @sessionlens/backend dev`               | Backend only                                                               |
| `pnpm --filter @sessionlens/backend diagnose:adapters` | Local adapter diagnostic (capabilities, detected sources, quality summary) |
| `pnpm --filter @sessionlens/backend backfill:quality`  | Idempotent backfill of tools, files, and data quality                      |
| `pnpm --filter @sessionlens/frontend dev`              | Frontend only                                                              |
| `pnpm --filter @sessionlens/frontend build`            | Frontend build                                                             |

---

## Tech Stack

| Layer               | Technology        | Version |
| ------------------- | ----------------- | ------- |
| **Runtime**         | Node.js           | >= 20   |
| **Package manager** | pnpm              | >= 9    |
| **Language**        | TypeScript        | 5.9     |
| **Backend**         | Fastify           | 5.x     |
| **Database**        | SQLite via sql.js | WASM    |
| **Frontend**        | React + Vite      | 6.x     |
| **Styling**         | Tailwind CSS      | v4      |
| **Charts**          | Recharts          | 2.x     |
| **Icons**           | Lucide React      | latest  |
| **Pricing**         | OpenRouter API    | sync    |
| **Tray**            | trayicon          | Windows |

---

## Architecture

```
sessionlens/
├── assets/
│   ├── logo/              # Black and white logos (theme-aware)
│   └── screenshots/       # UI screenshots for documentation
├── packages/
│   ├── backend/           # Fastify + sql.js + OpenRouter sync + adapters + tray
│   ├── frontend/          # React + Vite + Tailwind v4 + Recharts + shadcn-like UI
│   └── shared/            # Shared TypeScript types
├── scripts/               # Dev scripts (Windows-safe orchestration)
├── .github/workflows/     # CI + Release (git-cliff)
└── tsconfig.base.json     # Base TypeScript configuration
```

### Backend (`@sessionlens/backend`)

- **Runtime:** Fastify on `127.0.0.1:3030`
- **Database:** SQLite via sql.js WASM (zero native binaries)
- **Migrations:** Incremental files in `packages/backend/src/db/migrations/`
- **Costing engine:** central `cost_source` field with `actual` / `estimated` / `unknown`, plus token-based fallback
- **Pricing sync:** OpenRouter background sync at startup with `/api/models/sync-openrouter` endpoint
- **Ingestion:** Auto-ingestion via filesystem watcher with debounce and periodic scan
- **Budgets:** budget routes with limits and alerts by project / period
- **Tray:** Windows tray manager with auto-start and live status
- **Diagnostics:** `diagnose:adapters` and `backfill:quality` scripts for safe local diagnostics and idempotent backfills

### Frontend (`@sessionlens/frontend`)

- **Dev server:** Vite on `5173` with `/api` proxy → backend
- **Components:** `DataPanel`, `DataTable`, `FigurePanel`, `FigureGrid`, `CompactStat`, `ControlField`, `MetricBlock`, `QueryBar`, `SectionHeader`, `Tooltip`, `Skeleton`, `AlertStrip`
- **Styling:** Tailwind v4 with CSS variables and Sessionlens's own design system
- **Charts:** Recharts (AreaChart, LineChart, PieChart, BarChart) with custom tooltips
- **Themes:** Dark/light with refined contrast, flat surfaces, and an accessible chart palette
- **Languages:** English and Portuguese (PT-BR) via `LanguageProvider` with locale-aware formatting
- **Cache:** API layer with cache and validation for consistent responses

### Shared (`@sessionlens/shared`)

- Shared TypeScript types: `Session`, `CliProvider`, `SourceConfidence`, `SessionFilters`, `PaginatedResponse`, etc.
- Used by both backend and frontend to keep the contract consistent

---

## Supported Integrations

| CLI             | Status                 | Data location                                                              | Confidence |
| --------------- | ---------------------- | -------------------------------------------------------------------------- | ---------- |
| **Codex CLI**   | ✅ Supported           | `~/.codex/state_5.sqlite` + rollout JSONL                                  | HIGH       |
| **Claude Code** | ✅ Supported           | `~/.claude/projects/**/*.jsonl`                                            | MEDIUM     |
| **OpenCode**    | ✅ Supported           | `~/.local/share/opencode/opencode.db`                                      | HIGH       |
| **Gemini CLI**  | ✅ Supported           | `~/.gemini/tmp/**/chats/*.jsonl`                                           | HIGH       |
| **Kimi CLI**    | ⚠️ Honest experimental | `~/.kimi/sessions/**/context.jsonl` or `KIMI_SHARE_DIR`                    | PARTIAL    |
| **Aider**       | ⚠️ Honest experimental | `.aider.chat.history.md` + `.aider.llm.history`                            | PARTIAL    |
| **Qwen CLI**    | ⚠️ Honest experimental | `~/.qwen/sessions/**/*.json` and equivalents                               | PARTIAL    |
| **Antigravity** | ⚠️ Honest experimental | `~/.gemini/antigravity/`                                                   | PARTIAL    |
| **CommandCode** | ✅ Supported           | `~/.commandcode/projects/**/*.jsonl` + `.meta.json` + `.checkpoints.jsonl` | HIGH       |

> Each adapter is isolated — a schema change in one CLI does not affect the others.
> Confidence reflects the quality of data exposed by each source. Some CLIs don't expose cost, tokens, or tools in full; in those cases Sessionlens preserves the real data available and flags gaps for improvement.

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable                   | Description                     | Default                 |
| -------------------------- | ------------------------------- | ----------------------- |
| `SESSIONLENS_PORT`         | Backend port                    | `3030`                  |
| `SESSIONLENS_FRONTEND_URL` | Frontend URL (used by the tray) | `http://127.0.0.1:5173` |
| `DATABASE_PATH`            | SQLite file path                | `./data/sessionlens.db` |

### Auto-Ingestion

Sessionlens automatically watches the supported CLI data directories and updates data as new files are written. You can disable this in **Settings > Auto-ingestion**.

### System Tray (Windows)

Sessionlens provides a Windows tray icon with:

- **Auto-start:** Launch Sessionlens on login
- **Quick ingestion:** Trigger ingestion manually from the tray menu
- **Live status:** See the total indexed sessions directly on the icon

---

## Roadmap

| Phase     | Status     | Description                                                                                 |
| --------- | ---------- | ------------------------------------------------------------------------------------------- |
| Phase 0–2 | ✅ Done    | Bootstrap, Foundation, Core Product                                                         |
| Phase 3   | ✅ Done    | Multi-CLI (Codex, Claude, OpenCode)                                                         |
| Phase 3.5 | ✅ Done    | Initial Premium UI/UX                                                                       |
| Phase 4   | ✅ Done    | Advanced Analytics (insights, anomalies, multi-model)                                       |
| Phase 5   | ✅ Done    | CLI Expansion (Gemini, Kimi, Aider, Qwen, Antigravity)                                      |
| Phase 6   | ✅ Done    | UI Polish & Brand Assets                                                                    |
| Phase 7   | ✅ Done    | Runtime & Ingestion (auto-ingestion, filesystem watcher)                                    |
| Phase 8   | ✅ Done    | Controls & Alerts (budget limits, local alerts)                                             |
| Phase 9   | ✅ Done    | Tray & Runtime (system tray, CI/CD, auto-start)                                             |
| Phase 9.5 | ✅ Done    | UX Polish & Feature Refinement (Analytics, Insights, Settings, Projects, Sidebar)           |
| Phase 9.7 | ✅ Done    | Design System & UI Redesign (Sessionlens visual language, shell, main pages, visual QA)     |
| Phase 9.8 | ✅ Done    | Adapter Reliability & Data Quality (per-field quality, tools, files, diagnostics, backfill) |
| Phase 9.9 | ✅ Done    | UI/UX Prime Intellect Planning (design analysis, tokens, components map, phased plan)       |
| Phase 10  | 📋 Planned | Sharing & Webhooks (local-first export, Discord webhooks, sharing templates)                |
| Phase 11  | 📋 Planned | Extensibility (plugin SDK, IDE integration)                                                 |
| Phase 12  | 📋 Planned | Future / Cloud Optional (opt-in sync, team analytics)                                       |

---

## Documentation Roadmap

The current documentation set covers onboarding (this README) and contribution guidelines ([CONTRIBUTING.md](CONTRIBUTING.md)). The following files are planned for a future documentation pass to give the project a more complete, multi-audience doc surface:

| File                               | Purpose                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md`                     | Mirror of the in-app `/changelog` page, in plain Markdown for release notes and RSS feeds                                                                                                                                                    |
| `SECURITY.md`                      | Vulnerability disclosure policy, supported versions, contact channel, and SLAs                                                                                                                                                               |
| `CODE_OF_CONDUCT.md`               | Community standards (Contributor Covenant v2.1)                                                                                                                                                                                              |
| `docs/ARCHITECTURE.md`             | Module diagram, ingestion flow, watcher, costing engine, OpenRouter sync                                                                                                                                                                     |
| `docs/ADAPTERS.md`                 | `Adapter` interface, `AdapterCapabilities`, `SessionDataQuality`, `detect → discover → parse → normalize` flow, per-CLI examples                                                                                                             |
| `docs/API.md`                      | REST endpoint reference (`/api/overview`, `/api/sessions`, `/api/analytics/*`, `/api/projects`, `/api/models`, `/api/budgets`, `/api/alerts`, `/api/integrations/status`, `/api/ingest*`, `/api/tray/*`, `/api/health`)                      |
| `docs/DATA-MODEL.md`               | SQLite schema (`sessions`, `usage_events`, `messages`, `projects`, `models`, `pricing`, `session_model_usage`, `hidden_projects`, `budget_limits`, `alert_history`, `app_settings`) and the semantics of `cost_source` / `source_confidence` |
| `docs/TROUBLESHOOTING.md`          | Common issues: port `3030` busy, CLI paths not detected, stuck ingestion, OpenRouter sync failures, Windows tray, large chunk warning on frontend build                                                                                      |
| `.github/ISSUE_TEMPLATE/`          | Bug report and feature request templates                                                                                                                                                                                                     |
| `.github/PULL_REQUEST_TEMPLATE.md` | Structured PR template to replace the inline one in CONTRIBUTING                                                                                                                                                                             |

These are tracked as proposals for a follow-up documentation PR — contributions are welcome.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

[Contribute](https://github.com/melloxyz/sessionlens/issues) ·
[Report Bugs](https://github.com/melloxyz/sessionlens/issues) ·
[Suggest Features](https://github.com/melloxyz/sessionlens/issues)

**Sessionlens** — local-first observability for AI Coding CLIs.

</div>
