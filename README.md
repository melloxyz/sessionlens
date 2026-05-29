<div align="center">

# Sessionlens

**Observabilidade local-first para AI Coding CLIs — multi-CLI, open-source, privado.**

[![License: MIT](https://img.shields.io/badge/License-MIT-00c853.svg?style=flat-square)](LICENSE)
[![v0.8.0](https://img.shields.io/badge/v0.8.0-00c853?style=flat-square)](https://github.com/melloxyz/sessionlens/releases)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D9-f69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

*Rastreie custos, analise sessões e compare eficiência entre suas CLIs de IA — tudo offline, tudo local.*

[Funcionalidades](#funcionalidades) ·
[Quick Start](#quick-start) ·
[Stack](#stack-tecnológica) ·
[Arquitetura](#arquitetura) ·
[Integrações](#integrações-suportadas) ·
[Contribuindo](CONTRIBUTING.md)

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

## Funcionalidades

| Recurso | Descrição |
|---|---|
| **Multi-CLI** | Suporte para 8 CLIs: Codex, Claude Code, OpenCode, Gemini CLI, Kimi, Aider, Qwen e Antigravity |
| **Rastreamento de custos** | Custo real da CLI, estimativa por tokens e sync com OpenRouter para pricing atualizado |
| **Sessões inteligentes** | Tokens (input/output/cache/reasoning), tool calls, duração, contexto do projeto |
| **Analytics** | Dashboard com trends de gastos, breakdown por modelo/provider/projeto, insights e anomalias |
| **Orçamentos** | Defina limites de gasto e acompanhe alertas por projeto ou período |
| **Privacidade local-first** | SQLite via sql.js WASM — zero dados enviados externamente, zero telemetria |
| **Auto-ingestão** | Filesystem watcher com debounce observa diretórios das CLIs e atualiza automaticamente |
| **UI premium** | Design system OpenCode/Linear com DataPanel, DataTable, FilterBar, MetricTile, skeleton/loading states e tooltips |
| **Temas** | Modo escuro OLED puro (#000000) e modo claro com alto contraste, persistente via localStorage |
| **i18n** | Inglês e Português (PT-BR) com formatação localizada de datas, durações e moedas |
| **System Tray** | Ícone na bandeja do Windows com auto-start, ingestão rápida e status ao vivo |
| **Controles de projeto** | Oculte projetos sem deletar dados, abra pasta do projeto, timeline de commits git |
| **API com cache** | Requisições com cache e validação para respostas mais rápidas e consistentes |

---

## Quick Start

### Pré-requisitos

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### Instalação

```bash
# Clone o repositório
git clone https://github.com/melloxyz/sessionlens.git
cd sessionlens

# Instale as dependências
pnpm install

# Execute em modo desenvolvimento
pnpm dev
```

Acesse o frontend em **http://localhost:5173** — o backend roda em **http://127.0.0.1:3030**.

### Comandos

| Comando | Descrição |
|---|---|
| `pnpm dev` | Stack completo (backend + frontend) |
| `pnpm typecheck` | Typecheck em todos os packages |
| `pnpm lint` | Lint em todos os packages |
| `pnpm build` | Build de produção |
| `pnpm --filter @sessionlens/backend dev` | Apenas backend |
| `pnpm --filter @sessionlens/frontend dev` | Apenas frontend |
| `pnpm --filter @sessionlens/frontend build` | Build do frontend |

---

## Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Runtime** | Node.js | >= 20 |
| **Gerenciador** | pnpm | >= 9 |
| **Linguagem** | TypeScript | 5.9 |
| **Backend** | Fastify | 5.x |
| **Database** | SQLite via sql.js | WASM |
| **Frontend** | React + Vite | 6.x |
| **Estilo** | Tailwind CSS | v4 |
| **Gráficos** | Recharts | 2.x |
| **Ícones** | Lucide React | latest |
| **Pricing** | OpenRouter API | sync |
| **Tray** | trayicon | Windows |

---

## Arquitetura

```
sessionlens/
├── assets/
│   ├── logo/              # Logotipos preto e branco (theme-aware)
│   └── screenshots/       # Prints da interface para documentação
├── packages/
│   ├── backend/           # Fastify + sql.js + OpenRouter sync + adapters + tray
│   ├── frontend/          # React + Vite + Tailwind v4 + Recharts
│   └── shared/            # Tipos TypeScript compartilhados
├── scripts/               # Dev scripts (Windows-safe orchestration)
├── .github/workflows/     # CI + Release (git-cliff)
└── tsconfig.base.json     # Configuração TypeScript base
```

### Backend (`@sessionlens/backend`)

- **Runtime:** Fastify em `127.0.0.1:3030`
- **Database:** SQLite via sql.js WASM (zero binários nativos)
- **Migrations:** Incrementais em `packages/backend/src/db/migrations/`
- **Custos:** Motor central com `actual`/`estimated`/`unknown` + fallback por tokens
- **Sync:** OpenRouter pricing em background no startup
- **Ingestão:** Auto-ingestão com filesystem watcher + debounce + scan periódico
- **Orçamentos:** Rotas de budget com limites e alertas por projeto/período
- **Tray:** Gerenciador de bandeja do Windows com auto-start e status ao vivo

### Frontend (`@sessionlens/frontend`)

- **Dev server:** Vite em `5173` com proxy `/api` → backend
- **Componentes:** DataPanel, DataTable, FilterBar, MetricTile, SectionHeader, Tooltip, Skeleton
- **Estilo:** Tailwind v4 com CSS variables, design system OpenCode/Linear
- **Gráficos:** Recharts (AreaChart, LineChart, PieChart, BarChart) com tooltips customizados
- **Temas:** OLED escuro (`#000000`) e claro com alto contraste, persistente via localStorage
- **Idiomas:** English e Português (PT-BR) via `LanguageProvider` com locale-aware formatting
- **Cache:** Camada de API com cache e validação para respostas consistentes

### Shared (`@sessionlens/shared`)

- Tipos TypeScript compartilhados: `Session`, `CliProvider`, `SourceConfidence`, etc.
- Usado por backend e frontend para manter contrato consistente

---

## Integrações Suportadas

| CLI | Status | Localização dos Dados | Confiança |
|---|---|---|---|
| **Codex CLI** | ✅ Suportado | `~/.codex/state_5.sqlite` + rollout JSONL | HIGH |
| **Claude Code** | ✅ Suportado | `~/.claude/projects/**/*.jsonl` | MEDIUM |
| **OpenCode** | ✅ Suportado | `~/.local/share/opencode/opencode.db` | HIGH |
| **Gemini CLI** | ✅ Suportado | `~/.gemini/tmp/**/chats/*.jsonl` | HIGH |
| **Kimi CLI** | ✅ Suportado | `~/.kimi/logs/kimi.log` | MEDIUM |
| **Aider** | ✅ Suportado | `.aider.chat.history.md` | LOW |
| **Qwen CLI** | ✅ Suportado | `~/.qwen/`, `~/.config/qwen/`, `~/.local/share/qwen/` | MEDIUM |
| **Antigravity** | ✅ Suportado | `~/.gemini/antigravity/` | MEDIUM |

> Cada adapter é isolado — uma mudança no schema de uma CLI não afeta as outras.

---

## Configuração

### Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário:

| Variável | Descrição | Padrão |
|---|---|---|
| `SESSIONLENS_PORT` | Porta do backend | `3030` |
| `SESSIONLENS_FRONTEND_URL` | URL do frontend (usado pelo tray) | `http://127.0.0.1:5173` |
| `DATABASE_PATH` | Caminho do arquivo SQLite | `./data/sessionlens.db` |

### Auto-Ingestão

O Sessionlens observa automaticamente os diretórios de dados das CLIs suportadas e atualiza os dados quando novos arquivos são escritos. Você pode desligar em **Settings > Auto-ingestion**.

### System Tray (Windows)

O Sessionlens oferece um ícone de bandeja no Windows com:
- **Auto-start:** Inicie o Sessionlens ao fazer login
- **Ingestão rápida:** Acione a ingestão manualmente pelo menu do tray
- **Status ao vivo:** Veja o total de sessões indexadas diretamente no ícone

---

## Roadmap

| Fase | Status | Descrição |
|---|---|---|
| Fase 0-2 | ✅ Concluído | Bootstrap, Foundation, Core Product |
| Fase 3 | ✅ Concluído | Multi-CLI (Codex, Claude, OpenCode) |
| Fase 3.5 | ✅ Concluído | UI/UX Premium (OpenCode/Linear style) |
| Fase 4 | ✅ Concluído | Advanced Analytics (insights, anomalias, multi-model) |
| Fase 5 | ✅ Concluído | CLI Expansion (Gemini, Kimi, Aider, Qwen, Antigravity) |
| Fase 6 | ✅ Concluído | UI Polish & Brand Assets |
| Fase 7 | ✅ Concluído | Runtime & Ingestion (auto-ingestão, filesystem watcher) |
| Fase 8 | ✅ Concluído | Controls & Alerts (budget limits, alertas locais) |
| Fase 9 | ✅ Concluído | Tray & Runtime (system tray, CI/CD, auto-start) |
| Fase 10 | 🚧 Em progresso | UI v2 + i18n (DataPanel system, temas OLED, tradução PT-BR) |
| Fase 11 | 📋 Planejado | Extensibility (plugin SDK, IDE integration) |
| Fase 12 | 📋 Planejado | Future / Cloud Optional (opt-in sync, team analytics) |

---

## Licença

Este projeto está sob a [MIT License](LICENSE).

---

<div align="center">

[Contribua](https://github.com/melloxyz/sessionlens/issues) · [Reporte Bugs](https://github.com/melloxyz/sessionlens/issues) · [Sugira Funcionalidades](https://github.com/melloxyz/sessionlens/issues)

**Sessionlens** — observabilidade local-first para AI Coding CLIs.

</div>
