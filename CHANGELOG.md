# Changelog

All notable changes to Sessionlens are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.9.5] — 2026-06-13

### Added

- **Sources page:** dedicated page showing detected CLI adapters and their live status (enabled/disabled, path, errors)
- **Webhook notifications:** full CRUD system for webhook notification destinations with built-in support for Microsoft Teams and ntfy
- **Alert management:** "Clear all" action to dismiss all active alerts at once from the UI
- **Notification cooldown:** per-destination cooldown setting to prevent alert spam
- **Session metadata:** new metadata fields added to the session model and populated during ingestion
- **Custom profile networks:** support for custom networks in the profile with per-network language selection

### Changed

- **Privacy enhancement:** currency values displayed in the UI now pass through the `Sensitive` component to respect the privacy setting

### Fixed

- **Adapter resilience:** errors during adapter detection are caught and logged; adapters that fail detection are skipped without interrupting ingestion

---

## [0.9.4] — 2026-06-12

### Added

- **Dashboard KPIs:** confirmed and estimated spend now displayed as separate metrics in the overview strip
- **Privacy settings:** opt-in redaction of sensitive tool inputs (`input_json` for shell calls and message content) via Settings UI
- **Adapter drift observability:** per-adapter counters for ignored lines, zero-token sessions, costless sessions, and model-less sessions; exposed at `/api/integrations/status` and visible in Settings
- **Localized insights:** insight/anomaly labels and loading messages now respect the selected language (EN / PT-BR)
- **Localized cost source:** session detail view shows localized "Confirmed" / "Estimated" / "Unknown" cost labels
- **Ingestion hooks:** per-adapter start/end hooks for Codex and OpenCode; enables progress tracking and cleaner error isolation
- **Provider/model normalization:** `normalizeProvider` and `normalizeModel` extracted to a shared module — consistent naming across costing, storage and analytics

### Changed

- **Incremental ingestion:** adapters now skip unchanged files via `lastFileMtime`/`lastFileSize` checkpoints (JSONL/MD) and `updated_at`/`time_updated` for SQLite sources; reprocessing forced with explicit flag
- **Session filtering:** `visibleSessionSql` helper centralizes valid-session logic across all routes (overview, sessions, analytics, budgets, project detail) — eliminates per-route divergence
- **Project IDs stability:** `refreshProjects` switched from `DELETE + INSERT` to upsert by `path`; project IDs no longer change between ingestions
- **Pricing backfill:** `backfillEstimatedCosts` now restricted to newly-touched sessions; pricing in-memory cache per ingestion run
- **Git calls:** replaced `execSync` (shell) with `execFileSync` (no shell) everywhere; remote/branch cached per project and only recomputed for changed projects
- **CLI database access:** Codex and OpenCode adapters now open `state_5.sqlite`/`opencode.db` once per ingestion run instead of per-session
- **API cache:** `responseCache` in frontend now has TTL and size limit; data keys invalidated automatically after ingest/refetch
- **CORS:** restricted to frontend URLs only (no wildcard); error responses return a generic message server-side, full details logged internally only
- **Shared adapter utilities:** `readString`, `readObject`, `updateModelUsage`, `dedupeFileEvents` extracted to `adapters/shared.ts`; `mapRows` to `db/utils.ts` — removes ~200 lines of duplicated code across adapters
- **Error logging:** server errors logged with full context internally; no path or stack trace exposed to API clients

### Fixed

- **`sessionless.db` typo:** watcher correctly ignores `sessionlens.db` journal files (was matching wrong filename)
- **Legacy `AIMETER_PORT` env var:** removed fallback; only `SESSIONLENS_PORT` is read
- **Session layout overflow:** adjusted layout and overflow properties in SessionDetailPage for long messages

### Removed

- **Dead code:** `_aggregateModelUsage` (never called), `_avgDuration`/`_avgTokens` (calculated, never used)
- **Unused dependencies:** `drizzle-orm`, `drizzle-kit`, `@fastify/static` — none were imported anywhere in the codebase
- **In-app changelog page:** removed `/changelog` route, sidebar link and all changelog i18n strings — changelogs now live in GitHub Releases and `CHANGELOG.md`

### Tests

- Comprehensive adapter tests: Codex (per-event usage, fallback, malformed JSON, checkpoint), OpenCode (cost dedup, empty session, missing ID, checkpoint), Claude (per-model extraction), CommandCode (tool/file events)
- `resolveSessionCost` unit tests covering `actual`, `estimated`, `unknown` cases and adapter-declared quality
- `normalizeProvider`/`normalizeModel` unit tests
- `buildSessionDataQuality`, `summarizeQuality`, `capabilityScore`, `countToolCalls` unit tests
- Updated test cases for improved coverage across ingestion engine and adapter drift counters

---

## [0.9.3] — 2026-05-26

### Added

- **Cost integrity across all adapters:** `resolveSessionCost` reads each adapter's declared `dataQuality.cost` field; sessions correctly classify as `actual`, `estimated`, or `unknown` based on real evidence — not presence of a cost value
- **Claude: per-model pricing:** adapter extracts exact model from each assistant event and accumulates tokens per model; engine prices by model instead of a fixed Sonnet rate
- **Codex: real usage events:** adapter delegates pricing to the costing engine using real per-event token data; hardcoded 70/30 cost split removed
- **OpenCode: cost dedup fix:** eliminated double-counting where `session.cost` and per-message sums were both added to the total
- **PreferencesProvider:** user preference state management in a dedicated React context provider
- **DataQualityMatrix component:** visual quality breakdown per session showing completeness, cost confidence, and adapter reliability
- **AlertStrip component:** reusable in-app alert for warnings and informational messages

### Changed

- `saveDatabase` coalesced — removed redundant calls from `saveCheckpoint`; one write per ingestion run reduces I/O under concurrent sessions
- Database backup handling improved: rotated `.bak.1..3` with integrity check on load — corrupt backups no longer crash startup
- Session inspector rebalanced for faster reading on desktop: denser metrics, improved panel alignment

### Fixed

- CI branch corrected from `main` to `master`; release workflow job names improved
- Analytics and project filters corrected for edge cases with missing CLI/provider/model values

### Tests

- `resolveSessionCost` unit tests: all three cost-source branches covered
- Adapter costing tests: Claude per-model extraction, Codex engine delegation, OpenCode dedup

---

## [0.9.1] — 2026-05-10

### Added

- Insight detail page: visualizations with spend trend chart, session/project context, and recommended actions
- Analytics drill-down: filter by CLI, provider, and model; granularity controls (day/week/month) for spend charts
- CommandCode adapter: parses CommandCode session logs and maps tool/file events
- CommandCode: migrations and UI integration for the new CLI source

### Changed

- Projects, analytics and budgets gained cleaner headers, denser filters and improved panel alignment
- Dashboard command center and graph quality rebalanced for faster reading on desktop
- Remaining high-visibility UI copy translated to PT-BR

### Fixed

- Project navigation from analytics drill-down corrected (was routing to wrong project IDs)
- Analytics filter state persisted across tab switches

---

## [0.9.0] — 2026-04-28

### Added

- Sessionlens branding: renamed from Sessionless to Sessionlens; new black/white logo assets
- Budgets: spending limits with local alert history and progress tracking per project or globally
- Windows system tray: auto-start on login, minimized mode, tray menu with open/quit actions
- API cache: request deduplication and TTL-based caching in the frontend `useApi` hook
- Loading skeletons: dashboard, projects, session detail and settings show skeleton states instead of spinners
- Tooltip component: used across charts and integration status items

### Changed

- OpenAI-inspired redesign: stronger light/dark contrast, calmer desktop density, refined chart palette
- Contextual analytics filters: sidebar filter panel replaces inline dropdowns
- Projects restore flow: hidden projects can be restored from the Projects page without touching disk

---

## [0.8.1] — 2026-03-15

### Added

- System tray integration: background process persists after window close; tray icon with open/quit actions
- Auto-start toggle in Settings: opt-in to launch Sessionlens on OS login
- Budget limits: per-project and global limits with configurable thresholds and alert history

---

## [0.8.0] — 2026-03-05

### Added

- **Complete i18n:** full English and Português (PT-BR) translation for all UI strings; locale-aware date, duration, and currency formatting
- **New component system:** `DataPanel`, `DataTable`, `FilterBar`, `MetricTile`, `SectionHeader` — replaces ad-hoc Card components across all pages
- **Analytics filters:** provider, model, and project filters applied uniformly to report, charts and breakdowns
- **Model catalog:** search and used-model ranking; OpenRouter pricing sync updates input/output costs per 1M tokens

### Changed

- Sidebar redesigned: nav items with section codes, integration health section, settings/theme controls in footer
- Focus-visible polish: all interactive elements have consistent focus rings
- Chart palette updated for better contrast in both themes
- CI/CD: migrated from release-please to git-cliff for changelog generation; releases triggered by pushing version tags

---

## [0.7.1] — 2026-02-20

### Added

- Filesystem watcher: auto-ingestion on file changes for all supported CLI data directories
- Auto-ingestion toggle in Settings
- Ingestion concurrency guard: sql.js write lock prevents concurrent ingestion corrupting the database
- CI/CD: GitHub Actions workflow for lint, typecheck, build, and test on push to `master`
- CONTRIBUTING.md, LICENSE (MIT), initial AGENTS.md

### Fixed

- Windows-safe dev orchestration: sequential process startup avoids port conflicts and native file lock races

---

## [0.7.0] — 2026-02-10

### Added

- Sessionlens branding and package rename (from Sessionless)
- Windows system tray foundation
- English and Portuguese interface (first pass)

---

## [0.6.4] — 2026-01-28

### Added

- Model catalog search with used-model ranking (recently used models ranked first)
- Provider/model/project analytics filters
- OpenRouter model pricing sync

---

## [0.6.3] — 2026-01-20

### Added

- `actual` / `estimated` / `unknown` cost source tracking per session
- Token-based fallback cost estimation for sessions without adapter-provided cost
- Backfill migration for sessions previously showing $0.00

---

## [0.6.2] — 2026-01-12

### Added

- Hide projects without deleting local folders
- Open project folder from session detail view
- Git commit timeline for repositories tracked by Sessionlens

---

## [0.6.0] — 2026-01-05

### Added

- Premium OpenCode/Linear-style shell design
- Light and dark themes with toggle in sidebar
- English and Portuguese interface (foundation)

---

## [0.5.0] — 2025-12-20

### Added

- Gemini CLI adapter
- Kimi adapter
- Aider adapter
- Qwen adapter
- Antigravity adapter
- Integration detection in sidebar with per-adapter session counts

---

## [0.4.0] — 2025-12-05

### Added

- Insights Engine: rule-based anomaly detection on session data
- Anomaly detection: cost spikes, duration outliers, token usage anomalies
- Multi-model session usage: sessions using multiple models tracked separately

---

## [0.3.0] — 2025-11-20

### Added

- Codex adapter: parses OpenAI Codex session logs
- Claude Code adapter: parses Claude Code JSONL session files
- OpenCode adapter: parses OpenCode SQLite database
- Cross-provider normalization: unified `RawSession` schema from all adapters
- Project refresh: detects and links sessions to local project folders

---

## [0.1.0] — 2025-11-01

### Added

- pnpm monorepo: `packages/backend`, `packages/frontend`, `packages/shared`
- Fastify backend with sql.js local SQLite database (WASM, no native deps)
- Vite + React + Tailwind v4 frontend
- Dashboard, Sessions, Analytics, Projects, Settings pages
- SQLite migrations system (sequential, never-edit-applied)
