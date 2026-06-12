# Changelog

All notable changes to Sessionlens are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.9.4] — 2026-06-12

### Added

- **Dashboard KPIs:** confirmed and estimated spend now displayed as separate metrics in the overview strip
- **Privacy settings:** opt-in redaction of sensitive tool inputs (`input_json` for shell calls and message content) via Settings UI
- **Adapter drift observability:** per-adapter counters for ignored lines, zero-token sessions, costless sessions, and model-less sessions; exposed at `/api/integrations/status` and visible in Settings
- **Localized insights:** insight/anomaly labels and loading messages now respect the selected language (EN / PT-BR)
- **Localized cost source:** session detail view shows localized "Confirmed" / "Estimated" / "Unknown" cost labels

### Changed

- **Incremental ingestion:** adapters now skip unchanged files via `lastFileMtime`/`lastFileSize` checkpoints (JSONL/MD) and `updated_at`/`time_updated` for SQLite sources; reprocessing forced with explicit flag
- **Session filtering:** `visibleSessionSql` helper centralizes valid-session logic across all routes (overview, sessions, analytics, budgets, project detail) — eliminates per-route divergence
- **Project IDs stability:** `refreshProjects` switched from `DELETE + INSERT` to upsert by `path`; project IDs no longer change between ingestions
- **Pricing backfill:** `backfillEstimatedCosts` now restricted to newly-touched sessions; pricing in-memory cache per ingestion run
- **Git calls:** replaced `execSync` (shell) with `execFileSync` (no shell) everywhere; remote/branch cached per project and only recomputed for changed projects
- **CLI database access:** Codex and OpenCode adapters now open `state_5.sqlite`/`opencode.db` once per ingestion run instead of per-session
- **API cache:** `responseCache` in frontend now has TTL and size limit; data keys invalidated automatically after ingest/refetch
- **CORS:** restricted to frontend URLs only (no wildcard); error responses return a generic message server-side, full details logged internally only
- **Provider/model normalization:** `normalizeProvider` and `normalizeModel` extracted to a single shared module used by both costing and storage
- **Shared adapter utilities:** `readString`, `readObject`, `updateModelUsage`, `dedupeFileEvents` extracted to `adapters/shared.ts`; `mapRows` to `db/utils.ts` — removes ~200 lines of duplicated code across adapters

### Fixed

- **`sessionless.db` typo:** watcher correctly ignores `sessionlens.db` journal files
- **Legacy `AIMETER_PORT` env var:** removed fallback; only `SESSIONLENS_PORT` is read
- **Error logging:** server errors logged with full context internally; no path or stack trace exposed to API clients

### Removed

- **Dead code:** `_aggregateModelUsage` (never called), `_avgDuration`/`_avgTokens` (calculated, never used)
- **Unused dependencies:** `drizzle-orm`, `drizzle-kit`, `@fastify/static` — none were imported anywhere in the codebase

### Tests

- Comprehensive adapter tests: Codex (per-event usage, fallback, malformed JSON, checkpoint), OpenCode (cost dedup, empty session, missing ID, checkpoint), Claude (per-model extraction), CommandCode (tool/file events)
- `resolveSessionCost` unit tests covering `actual`, `estimated`, `unknown` cases and adapter-declared quality
- `normalizeProvider`/`normalizeModel` unit tests
- `buildSessionDataQuality`, `summarizeQuality`, `capabilityScore`, `countToolCalls` unit tests

---

## [0.9.3] — 2026-05-XX

### Added

- **Cost integrity across all adapters:** `resolveSessionCost` reads each adapter's declared `dataQuality.cost` field; sessions correctly classify as `actual`, `estimated`, or `unknown`
- **Claude: per-model pricing:** adapter extracts exact model from each assistant event and accumulates tokens per model; engine prices by model instead of fixed Sonnet rate
- **Codex: real usage events:** adapter delegates pricing to the costing engine; uses real per-event token data or 70/30 fallback only when no event data exists
- **OpenCode: cost dedup fix:** eliminated double-counting where `session.cost` and per-message sums were both added
- **PreferencesProvider:** user preference state management in a dedicated context provider
- **Test coverage:** `resolveSessionCost` unit tests, adapter integration tests for Claude, Codex, OpenCode cost handling

### Changed

- `saveDatabase` coalesced — removed redundant calls from `saveCheckpoint`; one write per ingestion run
- Database backup handling improved (rotated `.bak.1..3` with integrity check on load)

### Fixed

- CI branch corrected from `main` to `master`; release workflow job names improved

---

## [0.9.0] — 2026-03-XX

- Initial public release
- Multi-CLI support: Codex, Claude Code, OpenCode, Gemini CLI, Kimi, Aider, Qwen, Antigravity, CommandCode
- Dashboard, Sessions, Analytics, Projects, Budgets, Settings pages
- Budget limits with local alert history
- Windows system tray with auto-start
- English and Português (PT-BR) i18n
- Sessionlens design system
