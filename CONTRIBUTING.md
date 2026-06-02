<div align="center">

# Contributing to Sessionlens

Thank you for considering contributing to Sessionlens!

</div>

---

## Table of Contents

- [How to Contribute](#how-to-contribute)
- [Development Guide](#development-guide)
- [Adding a New CLI Adapter](#adding-a-new-cli-adapter)
- [Engineering Rules](#engineering-rules)
- [Code Style](#code-style)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Issues](#issues)
- [License](#license)

---

## How to Contribute

1. **Fork** the repository
2. Create a **branch** for your feature (`git checkout -b feat/your-feature-name`)
3. **Commit** your changes
4. **Push** to the branch (`git push origin feat/your-feature-name`)
5. Open a **Pull Request**

---

## Development Guide

### Prerequisites

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) >= 9 (`npm install -g pnpm`)

### Setup

```bash
git clone https://github.com/melloxyz/sessionlens.git
cd sessionlens
pnpm install
pnpm dev
```

### Available Commands

| Command                                     | Description                     |
| ------------------------------------------- | ------------------------------- |
| `pnpm dev`                                  | Full stack (backend + frontend) |
| `pnpm typecheck`                            | Typecheck across all packages   |
| `pnpm lint`                                 | Lint across all packages        |
| `pnpm build`                                | Production build                |
| `pnpm --filter @sessionlens/backend dev`    | Backend only                    |
| `pnpm --filter @sessionlens/frontend dev`   | Frontend only                   |
| `pnpm --filter @sessionlens/frontend build` | Frontend build                  |

---

## Adding a New CLI Adapter

### 1. Create the adapter

Create `packages/backend/src/adapters/name.ts` and implement the `Adapter` interface:

```typescript
import type { Adapter, Checkpoint, RawSession } from './types.js';
import type { CliProvider } from '@sessionlens/shared';

export function createNameAdapter(): Adapter {
  return {
    cli: 'name' as CliProvider,

    async detect(): Promise<boolean> {
      // Check if the CLI is installed / data exists
    },

    async discover(): Promise<string[]> {
      // Return the list of session paths to process
    },

    async computeCheckpoint(sessionPath: string): Promise<Checkpoint | null> {
      // Return a checkpoint for incremental parsing
    },

    async parse(sessionPath: string, checkpoint: Checkpoint | null): Promise<RawSession[]> {
      // Parse raw data into RawSession[]
    },

    normalize(raw: RawSession): RawSession {
      // Normalize provider/model if needed
      return raw;
    },

    async watchPaths(): Promise<string[]> {
      // Return directories for the filesystem watcher
      return [];
    },
  };
}
```

### 2. Register the adapter

In `packages/backend/src/adapters/index.ts`:

```typescript
export { createNameAdapter } from './name.js';
```

In `packages/backend/src/index.ts`, add it to the registry:

```typescript
import { createNameAdapter } from './adapters/index.js';
// ...
registry.register(createNameAdapter());
```

### 3. Add the provider

In `packages/shared/src/types.ts`, add it to `CliProvider`:

```typescript
export type CliProvider =
  | 'claude'
  | 'opencode'
  | 'codex'
  | 'gemini'
  | 'kimi'
  | 'aider'
  | 'qwen'
  | 'antigravity'
  | 'commandcode'
  | 'name';
```

### 4. Migration (if needed)

If you need new columns or tables:

1. Create `packages/backend/src/db/migrations/NNNN_description.sql`
2. Register it in `packages/backend/src/db/migrate.ts` in the `migrations` array
3. **Never** edit an already-applied migration

### 5. Test

```bash
pnpm typecheck
pnpm --filter @sessionlens/backend dev
```

Verify that `/api/integrations/status` shows the new CLI.

---

## Engineering Rules

| Rule                                | Description                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------- |
| **Local-first**                     | No cloud dependency. Everything runs offline.                               |
| **No terminal scraping**            | No regex on stdout, pseudo-terminals, or interception.                      |
| **Adapter isolation**               | Each CLI has its own isolated adapter. Internal changes don't break others. |
| **Incremental parsing**             | Always use checkpoint/hash to avoid re-reading already-ingested data.       |
| **No auth in MVP**                  | Zero login, single-user local.                                              |
| **Never edit an applied migration** | Create a new file and register it in `migrate.ts`.                          |
| **Match the project style**         | NodeNext modules, `.js` extensions on imports, Tailwind v4.                 |

---

## Code Style

- **TypeScript:** Strict mode, `moduleResolution: NodeNext`
- **Imports:** Always with `.js` extension on relative imports
- **Formatting:** Prettier with the project's configuration
- **Naming:** `camelCase` for variables/functions, `PascalCase` for components/types
- **CSS:** Tailwind v4, follow the existing design system
- **Frontend:** Reuse the existing components in `packages/frontend/src/components/ui/`

---

## Commits

Commit messages use the format below, with `scope` and a short, descriptive summary:

```
type(scope): summary
```

Both **Portuguese (PT-BR)** and **English** commit summaries are accepted — pick whichever you are most comfortable with. The current maintainer convention (`AGENTS.md`) leans PT-BR, but English is equally welcome as the project grows internationally.

### Types

| Type       | Description                          |
| ---------- | ------------------------------------ |
| `feat`     | New feature                          |
| `fix`      | Bug fix                              |
| `docs`     | Documentation                        |
| `style`    | Formatting (no logic change)         |
| `refactor` | Refactor with no behavior change     |
| `test`     | Adding/fixing tests                  |
| `chore`    | Configuration, dependencies, tooling |

### Examples

```
feat(adapters): add new CLI adapter for Gemini
fix(ingestion): resolve cost calculation edge case
docs(readme): update contributing section
chore(deps): update fastify to v5
feat(adapters): adiciona adapter para nova CLI
fix(ingestion): corrige cálculo de custo
```

---

## Pull Requests

- One feature/fix per PR
- Describe what changed and why
- Include screenshots if there are visual changes
- Make sure `pnpm typecheck` passes
- Request review from at least one person

### PR Template

```markdown
## What changed

Brief description of the changes.

## Why

Reason for the change.

## How to test

1. Step 1
2. Step 2
3. Step 3

## Screenshots (if applicable)

[Paste screenshots here]
```

---

## Issues

- Use the existing templates when available
- Include: Node version, OS, steps to reproduce
- Labels: `bug`, `feature`, `documentation`, `good first issue`

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
