# Noria

[![CI](https://github.com/AhmadHassan-BTed/Noria/actions/workflows/ci.yml/badge.svg)](https://github.com/AhmadHassan-BTed/Noria/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=22.12.0](https://img.shields.io/badge/Node->=22.12.0-blue.svg)](https://nodejs.org/)

Noria is a highly modular, decoupled, event-driven pipeline orchestrator designed for opportunity crawling, extraction, generative evaluation, and real-time alerts delivery. By utilizing statically enforced dynamic plugins, Noria achieves 0 coupling and 100% cohesion.

---

## 🏗️ Architecture & Core Design

Noria is built upon three strictly separated architectural layers:

```
                  ┌───────────────────────────────┐
                  │       Active Pipelines        │
                  │   (declarative YAML configs)   │
                  └───────────────┬───────────────┘
                                  │ loads
                                  ▼
                  ┌───────────────────────────────┐
                  │    Core Pipeline Engine       │
                  │      (src/core/pipeline)      │
                  └──────┬─────────────────┬──────┘
                         │                 │
            instantiates │                 │ instantiates
                         ▼                 ▼
  ┌──────────────────────────────┐ ┌──────────────────────────────┐
  │     Opportunity Providers    │ │      Technical Plugins       │
  │      (src/providers/)        │ │       (src/plugins/)         │
  ├──────────────────────────────┤ ├──────────────────────────────┤
  │ Decoupled Business Domains   │ │ Pluggable Protocols/Drivers  │
  │ • scholarships/              │ │ • scrapers/ (Puppeteer/Jina)│
  │ • jobs/                      │ │ • listeners/ (WhatsApp)      │
  │ • (future extensions...)     │ │ • analyzers/ (Gemini AI)     │
  └──────────────────────────────┘ └──────────────────────────────┘
```

1. **Core Orchestration Engine (`src/core/`)**: Standardizes the coordinates of event-driven steps. It functions as a pure stage coordinator with zero dependencies or knowledge of specific delivery channels (WhatsApp) or generative libraries (Gemini).
2. **Opportunity Providers (`src/providers/`)**: Represents self-contained domain business modules. Each provider encapsulates prompt schemas, Layout templates, scoring rules, and criteria configs for a specific opportunity category (e.g. `scholarships` or `jobs`).
3. **Pluggable Technical Adapters (`src/plugins/`)**: Interchangeable driver integrations grouped purely by technical role. They implement standardized interfaces and can be hot-swapped dynamically without touching core orchestration logic.

---

## 🛠️ Dynamic Enforced Modularity

Noria implements a strict runtime verification engine (`src/core/registry.js`). Any registered plugin or provider is validated against its abstract base contract at startup:

- **Provider contract**: Must implement `getAnalyzer()`, `getNotifier()`, `getSchema()`, and `getMetadata()`.
- **Listener plugin contract**: Must implement `initialize()`, `on()`, and `close()`.
- **Scraper plugin contract**: Must implement `scrape(url, options)`.
- **Analyzer plugin contract**: Must implement `analyze(content, context)` and `setProvider(provider)`.
- **Notifier plugin contract**: Must implement `send(target, message)`, `setProvider(provider)`, and `format(data)`.

This ensures that adding any new opportunity category or delivery protocol (such as WeChat, Discord, or Telegram) is immediately checked for contract compliance at startup.

---

## 📂 Repository Blueprint

```
noria/
├── .github/                       # GitHub Automation & Templates
│   ├── ISSUE_TEMPLATE/            # Standardized bug/feature templates
│   ├── PULL_REQUEST_TEMPLATE.md   # Pull request review checklist
│   └── workflows/                 # CI/CD runners (Tests, Formatting, Releases)
├── docker/                        # Multi-environment container configurations
│   ├── docker-compose.yml
│   └── Dockerfile
├── docs/                          # Detailed designs & release logs
│   ├── ARCHITECTURE.md            # Clean Architecture flow
│   └── CONTRIBUTING.md            # Contributor guide
├── pipelines/                     # YAML pipeline configurations
│   ├── jobs.yaml                  # Jobs crawler configuration
│   └── scholarships.yaml          # Scholarships crawler configuration
├── src/                           # Source Code Root
│   ├── config/                    # Unified app loaders & registries
│   ├── core/                      # Pipeline event engine & caches
│   ├── plugins/                   # Technical plugin adapters
│   ├── providers/                 # Opportunity domain packages
│   ├── queue/                     # Global event broker
│   ├── utils/                     # Metrics, caching, and DLQ persistence
│   └── index.js                   # Consolidated main bootstrapper
└── tests/                         # Comprehensive unit test suites
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: `>=22.12.0` (LTS is highly recommended)
- **NPM**: `>=10.0.0`

### 2. Installation
Clone the repository and install the standard dependencies:
```bash
git clone https://github.com/AhmadHassan-BTed/Noria.git
cd noria
npm install
```

### 3. Environment Configuration
Create a `.env` file at the root directory based on the template:
```bash
cp .env.example .env
```
Populate the necessary credentials:
```env
# Essential Keys
GEMINI_API_KEY=your_gemini_api_key
NOTIFICATION_TARGET=your_phone_number

# Optional Configuration
ACTIVE_PIPELINES=scholarships,jobs
ENABLE_QUEUE_RETRY=true
```

### 4. Running the Engine
Start the unified application bootstrapper:
```bash
npm start
```

---

## 🧪 Developer Workflow & Automation

We enforce strict quality-gates via ESLint, Prettier, and Jest. Ensure all checks are green before submitting pull requests:

- **Lint Static Analysis**:
  ```bash
  npm run lint
  ```
- **Code Formatting Conformity**:
  ```bash
  npm run format:check
  ```
- **Jest Unit Test Suites**:
  ```bash
  npm run test
  ```
- **Test Coverage Analysis** (enforces standard coverage thresholds):
  ```bash
  npm run test:coverage
  ```
- **Production Build Packaging**:
  ```bash
  npm run build
  ```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
