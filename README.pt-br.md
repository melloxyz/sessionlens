<div align="center">

<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo/sessionlens-white-logo.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/logo/sessionlens-black-logo.png">
  <img alt="Sessionlens" src="assets/logo/sessionlens-black-logo.png" height="72">
</picture>

<br/><br/>

# Sessionlens

### Observabilidade local-first para AI Coding CLIs

**Rastreie custos, analise sessões e compare eficiência entre 9 AI CLIs — tudo offline, tudo local.**

<br/>

<!-- row 1: project / status badges -->
<!-- If ci.yml is renamed, update the badge URL below -->
[![CI](https://img.shields.io/github/actions/workflow/status/melloxyz/sessionlens/ci.yml?style=for-the-badge&label=ci&branch=master)](https://github.com/melloxyz/sessionlens/actions/workflows/ci.yml)
[![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20PT--BR-1f6feb?style=for-the-badge)](README.md)

<br/>

<!-- row 2: technology badges -->
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-f69220?style=for-the-badge&logo=pnpm&logoColor=white)](https://pnpm.io)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/react-18-149eca?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![Fastify](https://img.shields.io/badge/fastify-5.x-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev)

<br/>

<p>
  <a href="README.md">English</a> · <strong>Português (BR)</strong>
</p>

[Funcionalidades](#funcionalidades) · [Quick Start](#quick-start) · [Stack](#stack-tecnológica) · [Integrações](#integrações-suportadas) · [Changelog](CHANGELOG.md) · [Contribuindo](CONTRIBUTING.md)

</div>

### Veja em ação

<div align="center">
  <img src="assets/screenshots/dashboard-screenshot.png" alt="Dashboard do Sessionlens" width="880"/>
</div>

### Todas as visualizações

<table>
  <tr>
    <td align="center" width="50%" valign="top"><strong>Sessões</strong><br/><img src="assets/screenshots/sessions-screenshot.png" alt="Sessões" width="100%"/></td>
    <td align="center" width="50%" valign="top"><strong>Analytics</strong><br/><img src="assets/screenshots/analytics-screenshot.png" alt="Analytics" width="100%"/></td>
  </tr>
  <tr>
    <td align="center" width="50%" valign="top"><strong>Orçamentos</strong><br/><img src="assets/screenshots/budgets-screenshot.png" alt="Orçamentos" width="100%"/></td>
    <td align="center" width="50%" valign="top"><em>(Dashboard mostrado acima)</em></td>
  </tr>
</table>

---

## Por que o Sessionlens

A maioria dos times que alterna entre várias AI coding CLIs não consegue responder perguntas básicas: _qual CLI é mais barata? qual é mais confiável? pra onde vai o dinheiro?_ O Sessionlens responde lendo os artefatos em disco que cada CLI já produz — sem scraping, sem proxies, sem cloud. **Seus dados nunca saem da sua máquina, todo custo é marcado como `actual` ou `estimated`, e você fica produtivo em 60 segundos depois de `pnpm install`.**

---

## Funcionalidades

#### Tracking

| Recurso                      | Descrição                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-CLI**                | 9 CLIs suportadas: Codex, Claude Code, OpenCode, Gemini CLI, Kimi, Aider, Qwen, Antigravity e CommandCode                                                       |
| **Rastreamento de custos**   | Custo real da CLI, estimativa por tokens e sync com OpenRouter. Spend confirmado e estimado exibidos separadamente                                              |
| **Sessões inteligentes**     | Tokens (input/output/cache/reasoning), tool calls, duração, contexto do projeto, breakdown por modelo                                                            |
| **Auto-ingestão**            | Filesystem watcher com debounce; checkpoints incrementais pulam arquivos não alterados automaticamente                                                         |

#### Analytics & Insights

| Recurso                      | Descrição                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analytics**                | Dashboard com filtros contextuais, trends de gasto, breakdown por modelo/provider/projeto, páginas dedicadas de insights e anomalias                           |
| **Confiabilidade de dados**  | Qualidade por campo, contadores de drift por adapter, tools capturadas, arquivos tocados e coverage por CLI em Settings e Session Detail                      |
| **Orçamentos**               | Limites globais, por projeto, CLI, provider ou modelo com histórico de alertas locais                                                                           |
| **Busca full-text**          | Pesquise por session IDs, caminhos de projeto e conteúdo completo de mensagens com trechos de resultado                                                         |
| **Exportação CSV**           | Exporte sessões filtradas e breakdowns analíticos para CSV diretamente pela UI                                                                                  |
| **Controles de projeto**     | Ocultar/restaurar projetos sem deletar dados; abrir pasta; acompanhar timeline git e sessões relacionadas                                                       |
| **UI premium**               | Design system próprio — DataPanel, DataTable, FigurePanel, CompactStat, ControlField, skeleton states e tooltips                                                |
| **Temas**                    | Modo escuro e claro com contraste refinado, chart palette acessível e persistência via localStorage                                                             |

#### Privacidade & Controle

| Recurso                      | Descrição                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Privacidade & segurança**  | Redação opt-in de inputs sensíveis; CORS restrito ao localhost; sem detalhes de erro expostos; chamadas git sem shell injection                                 |
| **Local-first**              | SQLite via sql.js WASM — zero dados enviados externamente, zero telemetria, zero contas                                                                          |
| **i18n**                     | Inglês e Português (PT-BR) com formatação localizada de datas, durações, moedas e labels de insights                                                            |

---

## Novidades na v0.9.5

> Histórico completo em [CHANGELOG.md](CHANGELOG.md).

- **Página de Sources:** página dedicada exibindo os adapters CLI detectados e seus status em tempo real (habilitado/desabilitado, caminho, erros)
- **Notificações via webhook:** sistema completo de CRUD para destinos webhook, com suporte nativo a Microsoft Teams e ntfy
- **Gerenciamento de alertas:** ação "Limpar tudo" para descartar todos os alertas ativos de uma vez
- **Cooldown de notificações:** configuração de cooldown por destino para evitar spam de alertas
- **Metadados de sessão:** novos campos de metadados no modelo de sessão, preenchidos durante a ingestão
- **Resiliência de adapters:** erros de detecção são capturados e logados; adapters com falha são ignorados sem interromper a ingestão
- **Melhoria de privacidade:** valores de moeda na UI agora passam pelo componente `Sensitive`

---

## Quick Start

### Pré-requisitos

- [Node.js](https://nodejs.org) >= 20
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### Instalação

```bash
git clone https://github.com/melloxyz/sessionlens.git
cd sessionlens
pnpm install
pnpm dev
```

Frontend: **http://localhost:5173** — API Backend: **http://127.0.0.1:3030**

### Comandos

| Comando                                                | Descrição                                                 |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `pnpm dev`                                             | Stack completo (backend + frontend)                       |
| `pnpm build`                                           | Build de produção                                         |
| `pnpm typecheck`                                       | Typecheck em todos os packages                            |
| `pnpm lint`                                            | Lint em todos os packages                                 |
| `pnpm -r test`                                         | Executar suite de testes                                  |
| `pnpm --filter @sessionlens/backend diagnose:adapters` | Diagnóstico de adapters (capabilities, fontes, qualidade) |
| `pnpm --filter @sessionlens/backend backfill:quality`  | Backfill idempotente de tools, files e data quality       |

---

## Stack Tecnológica

| Camada          | Tecnologia        | Versão   |
| --------------- | ----------------- | -------- |
| **Runtime**     | Node.js           | >= 20    |
| **Gerenciador** | pnpm              | >= 9     |
| **Linguagem**   | TypeScript        | 5.x      |
| **Backend**     | Fastify           | 5.x      |
| **Database**    | SQLite via sql.js | WASM     |
| **Frontend**    | React + Vite      | 18 / 6.x |
| **Estilo**      | Tailwind CSS      | v4       |
| **Gráficos**    | Recharts          | 2.x      |
| **Ícones**      | Lucide React      | latest   |
| **Pricing**     | OpenRouter API    | sync     |

---

## Arquitetura

Os adapters escrevem `RawSession`, o engine de ingestão normaliza/deduplica/precifica, e o frontend consulta via Fastify.

```
sessionlens/
├── assets/
│   ├── logo/              # Logotipos preto e branco (theme-aware)
│   └── screenshots/       # Prints da interface
├── packages/
│   ├── backend/           # Fastify + sql.js + adapters + costing
│   ├── frontend/          # React + Vite + Tailwind v4 + Recharts
│   └── shared/            # Tipos TypeScript compartilhados
├── scripts/               # Dev scripts (Windows-safe)
├── .github/workflows/     # CI + Release (git-cliff)
└── CHANGELOG.md
```

### Backend

- **Fastify** em `127.0.0.1:3030` com CORS restrito à URL do frontend configurada
- **SQLite** via sql.js WASM — em memória, persistido com escrita atômica + backups rotacionados
- **Adapters** (`claude`, `codex`, `opencode`, `gemini`, `kimi`, `aider`, `qwen`, `commandcode`, `antigravity`) emitem `RawSession`; o engine de ingestão normaliza, precifica, deduplica e persiste
- **Engine de custo:** campo `cost_source` com `actual`/`estimated`/`unknown`; pricing via OpenRouter sync no startup
- **Ingestão incremental:** checkpoints por arquivo pulam fontes não alteradas; `backfillEstimatedCosts` restrito a sessões tocadas
- **Privacidade:** flag `redact` opt-in remove `input_json` sensíveis e conteúdo de mensagens antes de persistir

### Frontend

- **Vite** na porta `5173` com proxy `/api` → backend
- **Componentes:** `DataPanel`, `DataTable`, `FigurePanel`, `CompactStat`, `ControlField`, `MetricBlock`, `QueryBar`, `AlertStrip`, `Skeleton`
- **Temas:** escuro/claro com CSS variables e contraste refinado
- **Idiomas:** EN / PT-BR via `LanguageProvider` com formatação locale-aware
- **Cache:** TTL + limite de tamanho, invalidado após ingest

### Shared

- Tipos TypeScript: `Session`, `CliProvider`, `SourceConfidence`, `SessionFilters`, `PaginatedResponse`, etc.
- Compartilhado entre backend e frontend para manter o contrato de API consistente

---

## Integrações Suportadas

| CLI             | Status          | Localização dos dados                                   | Confiança |
| --------------- | --------------- | ------------------------------------------------------- | --------- |
| **Codex CLI**   | ✅ Suportado    | `~/.codex/state_5.sqlite` + rollout JSONL               | HIGH      |
| **Claude Code** | ✅ Suportado    | `~/.claude/projects/**/*.jsonl`                         | MEDIUM    |
| **OpenCode**    | ✅ Suportado    | `~/.local/share/opencode/opencode.db`                   | HIGH      |
| **Gemini CLI**  | ✅ Suportado    | `~/.gemini/tmp/**/chats/*.jsonl`                        | HIGH      |
| **CommandCode** | ✅ Suportado    | `~/.commandcode/projects/**/*.jsonl` + `.meta.json`     | HIGH      |
| **Kimi CLI**    | ⚠️ Experimental | `~/.kimi/sessions/**/context.jsonl` ou `KIMI_SHARE_DIR` | PARTIAL   |
| **Aider**       | ⚠️ Experimental | `.aider.chat.history.md` + `.aider.llm.history`         | PARTIAL   |
| **Qwen CLI**    | ⚠️ Experimental | `~/.qwen/sessions/**/*.json`                            | PARTIAL   |
| **Antigravity** | ⚠️ Experimental | `~/.gemini/antigravity/`                                | PARTIAL   |

> Cada adapter é isolado — uma mudança no schema de uma CLI não afeta as outras. A confiança reflete a qualidade e completude dos dados disponíveis por fonte.

---

## Contribuindo

Contribuições de qualquer tamanho são bem-vindas — código, documentação, bug reports, novos adapters de CLI e traduções.

- **Good first issues:** [label:good-first-issue](https://github.com/melloxyz/sessionlens/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)
- **Guia completo do contribuidor:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Código de conduta:** este projeto segue o espírito do [Contributor Covenant](https://www.contributor-covenant.org/) (informal — sem arquivo separado por enquanto).

---

## Licença

[MIT](LICENSE)

---

<div align="center">

![Made with](https://img.shields.io/badge/made%20with-%E2%9D%A4-ff5e5e?style=for-the-badge)

<br/>

[github.com/melloxyz/sessionlens](https://github.com/melloxyz/sessionlens) · [CHANGELOG](CHANGELOG.md) · [CONTRIBUTING](CONTRIBUTING.md) · [English](README.md)

<br/>

**Sessionlens — observabilidade local-first para AI Coding CLIs.**

</div>
