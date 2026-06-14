<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/sessionlens-white-logo.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo/sessionlens-black-logo.png">
  <img alt="Sessionlens" src="assets/logo/sessionlens-black-logo.png" height="56">
</picture>

# Sessionlens

**Local-first observability for AI Coding CLIs — multi-CLI, open-source, private.**

[![License: MIT](https://img.shields.io/badge/License-MIT-00c853.svg?style=flat-square)](LICENSE)
[![v0.9.5](https://img.shields.io/badge/v0.9.5-00c853?style=flat-square)](https://github.com/melloxyz/sessionlens/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<p>
  <strong>English</strong> · <a href="README.pt-br.md">Português (BR)</a>
</p>

_Track costs, analyze sessions, and compare efficiency across your AI CLIs — fully offline, fully local._

[Features](#features) · [Quick Start](#quick-start) · [Stack](#tech-stack) · [Architecture](#architecture) · [Integrations](#supported-integrations) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

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

| Feature                | Description                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-CLI**          | 9 supported CLIs: Codex, Claude Code, OpenCode, Gemini CLI, Kimi, Aider, Qwen, Antigravity, and CommandCode                                                     |
| **Cost tracking**      | Real CLI cost, token-based estimation, and OpenRouter sync for up-to-date pricing. Confirmed vs. estimated spend shown separately                               |
| **Smart sessions**     | Tokens (input/output/cache/reasoning), tool calls, duration, project context, per-model usage breakdown                                                         |
| **Analytics**          | Dashboard with contextual filters, spend trends, breakdowns by model/provider/project, and dedicated insight/anomaly pages                                      |
| **Data reliability**   | Per-field quality, adapter drift counters, captured tools, touched files, and per-CLI coverage in Settings and Session Detail                                   |
| **Budgets**            | Global, per-project, CLI, provider, or model limits with local alert history                                                                                    |
| **Privacy & security** | Opt-in redaction of sensitive tool inputs; CORS restricted to localhost; no error details exposed to clients; git calls use `execFileSync` (no shell injection) |
| **Local-first**        | SQLite via sql.js WASM — zero data sent externally, zero telemetry, zero accounts                                                                               |
| **Auto-ingestion**     | Filesystem watcher with debounce; incremental checkpoints skip unchanged files automatically                                                                    |
| **Premium UI**         | Sessionlens design system — DataPanel, DataTable, FigurePanel, CompactStat, ControlField, skeleton states, and tooltips                                         |
| **Themes**             | Dark and light mode with refined contrast, accessible chart palette, and localStorage persistence                                                               |
| **i18n**               | English and Português (PT-BR) with localized dates, durations, currencies, and insight labels                                                                   |
| **System Tray**        | Windows tray icon with auto-start, quick ingestion, and live session count                                                                                      |
| **Project controls**   | Hide/restore projects without deleting data; open folder; follow git timeline and related sessions                                                              |

---

## What's New in v0.9.5

> Full history in [CHANGELOG.md](CHANGELOG.md).

- **Sources page:** dedicated page showing detected CLI adapters and their live status (enabled/disabled, path, errors)
- **Webhook notifications:** full CRUD system for webhook destinations, with built-in support for Microsoft Teams and ntfy
- **Alert management:** "Clear all" action to dismiss all active alerts at once
- **Notification cooldown:** per-destination cooldown setting to prevent alert spam
- **Session metadata:** new metadata fields on the session model, populated during ingestion
- **Adapter resilience:** detection errors are caught and logged; failing adapters are skipped without breaking ingestion
- **Privacy enhancement:** currency values in the UI now pass through the `Sensitive` component

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### Installation

```bash
git clone https://github.com/melloxyz/sessionlens.git
cd sessionlens
pnpm install
pnpm dev
```

Frontend: **http://localhost:5173** — Backend API: **http://127.0.0.1:3030**

### Commands

| Command                                                | Description                                               |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm dev`                                             | Full stack (backend + frontend)                           |
| `pnpm build`                                           | Production build                                          |
| `pnpm typecheck`                                       | Typecheck across all packages                             |
| `pnpm lint`                                            | Lint across all packages                                  |
| `pnpm -r test`                                         | Run test suite                                            |
| `pnpm changelog`                                       | Regenerate `CHANGELOG.md` from git history via git-cliff  |
| `pnpm --filter @sessionlens/backend diagnose:adapters` | Local adapter diagnostic (capabilities, sources, quality) |
| `pnpm --filter @sessionlens/backend backfill:quality`  | Idempotent backfill of tools, files, and data quality     |

---

## Tech Stack

| Layer               | Technology        | Version  |
| ------------------- | ----------------- | -------- |
| **Runtime**         | Node.js           | >= 20    |
| **Package manager** | pnpm              | >= 9     |
| **Language**        | TypeScript        | 5.9      |
| **Backend**         | Fastify           | 5.x      |
| **Database**        | SQLite via sql.js | WASM     |
| **Frontend**        | React + Vite      | 18 / 6.x |
| **Styling**         | Tailwind CSS      | v4       |
| **Charts**          | Recharts          | 2.x      |
| **Icons**           | Lucide React      | latest   |
| **Pricing**         | OpenRouter API    | sync     |
| **Tray**            | trayicon          | Windows  |

---

## Architecture

```
sessionlens/
├── assets/
│   ├── logo/              # Black and white logos (theme-aware)
│   └── screenshots/       # UI screenshots
├── packages/
│   ├── backend/           # Fastify + sql.js + adapters + costing + tray
│   ├── frontend/          # React + Vite + Tailwind v4 + Recharts
│   └── shared/            # Shared TypeScript types
├── scripts/               # Dev orchestration (Windows-safe)
├── .github/workflows/     # CI + Release (git-cliff)
└── CHANGELOG.md
```

### Backend

- **Fastify** on `127.0.0.1:3030` with CORS restricted to the configured frontend URL
- **SQLite** via sql.js WASM — in-memory, persisted via atomic write + rotated backups
- **Adapters** (`claude`, `codex`, `opencode`, `gemini`, `kimi`, `aider`, `qwen`, `commandcode`, `antigravity`) each emit `RawSession`; the ingestion engine owns normalization, costing, dedup, and upsert
- **Costing engine:** `cost_source` field with `actual` / `estimated` / `unknown`; OpenRouter pricing synced at startup
- **Incremental ingestion:** file-level checkpoints skip unchanged sources; `backfillEstimatedCosts` scoped to touched sessions only
- **Privacy:** opt-in `redact` flag strips sensitive `input_json` and message content before storage

### Frontend

- **Vite** dev server on port `5173` with `/api` proxy → backend
- **Components:** `DataPanel`, `DataTable`, `FigurePanel`, `FigureGrid`, `CompactStat`, `ControlField`, `MetricBlock`, `QueryBar`, `SectionHeader`, `AlertStrip`, `Skeleton`
- **Themes:** dark/light with CSS variables and refined contrast
- **Languages:** EN / PT-BR via `LanguageProvider` with locale-aware formatting
- **Cache:** TTL + size-limited response cache, invalidated after ingest

### Shared

- TypeScript types: `Session`, `CliProvider`, `SourceConfidence`, `SessionFilters`, `PaginatedResponse`, etc.
- Shared between backend and frontend to keep the API contract consistent

---

## Supported Integrations

| CLI             | Status          | Data location                                           | Confidence |
| --------------- | --------------- | ------------------------------------------------------- | ---------- |
| **Codex CLI**   | ✅ Supported    | `~/.codex/state_5.sqlite` + rollout JSONL               | HIGH       |
| **Claude Code** | ✅ Supported    | `~/.claude/projects/**/*.jsonl`                         | MEDIUM     |
| **OpenCode**    | ✅ Supported    | `~/.local/share/opencode/opencode.db`                   | HIGH       |
| **Gemini CLI**  | ✅ Supported    | `~/.gemini/tmp/**/chats/*.jsonl`                        | HIGH       |
| **CommandCode** | ✅ Supported    | `~/.commandcode/projects/**/*.jsonl` + `.meta.json`     | HIGH       |
| **Kimi CLI**    | ⚠️ Experimental | `~/.kimi/sessions/**/context.jsonl` or `KIMI_SHARE_DIR` | PARTIAL    |
| **Aider**       | ⚠️ Experimental | `.aider.chat.history.md` + `.aider.llm.history`         | PARTIAL    |
| **Qwen CLI**    | ⚠️ Experimental | `~/.qwen/sessions/**/*.json`                            | PARTIAL    |
| **Antigravity** | ⚠️ Experimental | `~/.gemini/antigravity/`                                | PARTIAL    |

> Each adapter is isolated — a schema change in one CLI does not affect the others. Confidence reflects the quality and completeness of data exposed by each source. Where CLIs don't expose cost, tokens, or tools, Sessionlens preserves what's available and flags the gap.

---

## Configuration

### Environment variables

Copy `.env.example` to `.env`:

| Variable                   | Description                          | Default                 |
| -------------------------- | ------------------------------------ | ----------------------- |
| `SESSIONLENS_PORT`         | Backend port                         | `3030`                  |
| `SESSIONLENS_FRONTEND_URL` | Frontend URL (used by CORS and tray) | `http://127.0.0.1:5173` |
| `DATABASE_PATH`            | SQLite file path                     | `./data/sessionlens.db` |

### Auto-ingestion

Sessionlens watches CLI data directories and updates automatically on new files. Disable in **Settings → Auto-ingestion**.

### System Tray (Windows)

- **Auto-start:** Launch on login
- **Quick ingestion:** Trigger from the tray menu
- **Live status:** Total indexed sessions on the icon

---

## Roadmap

| Phase        | Status     | Description                                                                                |
| ------------ | ---------- | ------------------------------------------------------------------------------------------ |
| **Phase 1**  | ✅ Done    | Bootstrap & Core — multi-CLI ingestion, SQLite, cost tracking                              |
| **Phase 2**  | ✅ Done    | Analytics & Budgets — insights, anomalies, spend trends, budget limits                     |
| **Phase 3**  | ✅ Done    | CLI Expansion — Gemini, Kimi, Aider, Qwen, Antigravity, CommandCode                        |
| **Phase 4**  | ✅ Done    | Design System & Premium UI — Sessionlens visual language, component library                |
| **Phase 5**  | ✅ Done    | Runtime & Tray — auto-ingestion, filesystem watcher, Windows tray, CI/CD                   |
| **Phase 6**  | ✅ Done    | Data Reliability — per-field quality, adapter diagnostics, idempotent backfill             |
| **Phase 7**  | ✅ Done    | Cost Integrity & Performance — honest cost classification, incremental ingestion, caching  |
| **Phase 8**  | ✅ Done    | Security & Code Quality — data redaction, CORS hardening, dead code removal, audit cleanup |
| **Phase 9**  | 📋 Planned | Export & Sharing — local CSV/JSON export, Discord webhooks, sharing templates              |
| **Phase 10** | 📋 Planned | Extensibility — plugin SDK, IDE integration                                                |
| **Phase 11** | 🔮 Future  | Cloud Optional — opt-in sync, team analytics                                               |

---

## License

[MIT](LICENSE)

---

<div align="center">

[Report a bug](https://github.com/melloxyz/sessionlens/issues) · [Request a feature](https://github.com/melloxyz/sessionlens/issues) · [Contribute](CONTRIBUTING.md)

**Sessionlens** — local-first observability for AI Coding CLIs.

</div>
