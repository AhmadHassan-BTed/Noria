# Noria - Modern Event-Driven Pipeline Architecture

## Overview

Noria is a fully decoupled, plugin-based pipeline system for opportunity discovery and evaluation. It supports any opportunity type (scholarships, jobs, internships) through a provider system, with pluggable listeners, scrapers, analyzers, and notifiers.

**Key Design Principles**:
- ✅ **Zero Hardcoding** — Configuration-driven via YAML and `.env`
- ✅ **Fully Pluggable** — Swap any component without core changes
- ✅ **Multi-Provider** — Support multiple opportunity types simultaneously  
- ✅ **Event-Driven** — Loosely coupled services via event broker
- ✅ **Open Source Ready** — Clear interfaces, examples, and extension guides
- ✅ **Production Ready** — Resilience, retry logic, monitoring, and observability

---

## Architecture Layers

### 1. Core Layer (`src/core/`)
The orchestration and event bus layer.

- **`broker.js`** — Event emitter managing all communication between services
- **`registry.js`** — Plugin and provider registry (dependency injection)
- **`pipeline.js`** — Orchestrator that reads YAML configs and wires services
- **`events.js`** — Formalized event types and Event class

### 2. Plugin Layer (`src/plugins/`)
Reusable, composable services.

**Base Classes** (`base/`):
- `BaseListener` — Inbound message source (WhatsApp, Telegram, etc.)
- `BaseScraper` — Content extraction (Jina, Puppeteer, APIs, etc.)
- `BaseAnalyzer` — AI/ML evaluation (Gemini, OpenAI, custom logic)
- `BaseNotifier` — Message formatting and preparation

**Implementations**:
```
listeners/          → WhatsApp, future: Telegram
scrapers/           → Jina, Puppeteer, future: Generic API
analyzers/          → Gemini (generic, provider-agnostic)
notifiers/          → Placeholder (provider provides actual formatter)
```

### 3. Provider Layer (`src/providers/`)
Opportunity type specific logic.

Each provider defines:
- **`config.js`** — Scoring criteria, evaluation rules
- **`schema.js`** — Data schema (expected AI response structure)
- **`analyzer.js`** — Provider-specific analyzer (extends `BaseAnalyzer`)
- **`notifier.js`** — Provider-specific formatter (extends `BaseNotifier`)
- **`index.js`** — Exports provider class

**Example Providers**:
```
scholarships/       → Scholarships evaluation
jobs/              → Job postings evaluation
internships/       → Internship evaluation
```

### 4. Middleware Layer (`src/middleware/`)
Cross-cutting concerns wired via broker events.

- `deduplicator.js` — URL caching to prevent duplicate processing
- `validator.js` — Input/output validation middleware
- `metrics.js` — Pipeline metrics collection

### 5. Configuration Layer (`src/config/`)
Global and pipeline-specific configuration.

- `index.js` — Global config from `.env`
- `plugins.registry.js` — Register all available plugins/providers
- `schemas/` — JSON schema validators

### 6. Utilities (`src/utils/`)
Shared helper functions.

- `retry.js` — Exponential backoff retry logic
- `cache.js` — LRU cache for deduplication
- `validators.js` — Input/output validation
- `queue.js` — Dead-letter queue for failed items
- `metrics.js` — Metrics collection
- `logger.js` — Structured logging

---

## Data Flow

### Pipeline Execution

```
1. CONFIG LOADING
   └─ Load .env variables
   └─ Load pipeline YAML (e.g., scholarships.yaml)
   └─ Validate config

2. PLUGIN INITIALIZATION  
   └─ Registry loads available plugins (from plugins.registry.js)
   └─ Instantiate plugins based on YAML config
   └─ Instantiate provider based on pipeline provider name

3. SERVICE WIRING
   └─ Connect broker event listeners based on YAML stages
   └─ Inject provider into analyzer/notifier
   └─ Wire middleware (deduplicator, metrics, etc.)

4. RUNTIME
   └─ Listener emits 'link_extracted' event
   └─ Deduplicator checks cache, skips if duplicate
   └─ Broker emits 'scraper:start'
   └─ Scraper (Jina + Puppeteer fallback) extracts content
   └─ Broker emits 'scraper:success'
   └─ Analyzer loads provider config and analyzes content
   └─ Broker emits 'analyzer:match_found' or 'analyzer:no_match'
   └─ Notifier formats using provider-specific formatter
   └─ Listener sends formatted message back
```

### Event Flow

```
listener:link_extracted (url)
  ↓ [deduplicator middleware]
  ├─ Check cache: if duplicate, skip
  └─ Add to cache if fresh
  
scraper:start (url)
  ↓ [retry middleware: Jina + Puppeteer fallback]
  
scraper:success (url, text)
  ↓ [provider-specific analyzer]
  ├─ Load provider config (scholarships, jobs, etc.)
  └─ Build provider-specific prompt
  
analyzer:start (content)
  ↓ [Gemini API with retry logic]
  
analyzer:match_found (ai_data) or analyzer:no_match
  ↓ [provider-specific notifier formatter]
  
notifier:send (formatted_message)
  ↓
listener:send (message via WhatsApp/Telegram/etc.)
```

---

## Configuration

### `.env` File
```env
# API Keys
GEMINI_API_KEY=xxx
JINA_API_KEY=xxx

# Applicant Profile
APPLICANT_NAME=Jane Doe
APPLICANT_NATIONALITY=Pakistan
APPLICANT_DEGREE_TIER=MS Computer Science
APPLICANT_TARGET_FIELDS=AI, Machine Learning
APPLICANT_RESEARCH_FOCUS=Federated Learning

# Notification Target
NOTIFICATION_TARGET=+923001234567

# Resilience
MAX_RETRIES=3
RETRY_BACKOFF_MS=1000
CACHE_TTL_MS=86400000
HEALTH_CHECK_INTERVAL_MS=60000

# Active Pipelines (comma-separated)
ACTIVE_PIPELINES=scholarships,jobs
```

### YAML Pipeline Configuration
```yaml
# pipelines/scholarships.yaml
name: Scholarships Pipeline
provider: scholarships
stages:
  listen:
    plugin: whatsapp-listener
  scrape:
    primary: jina-scraper
    fallback: puppeteer-scraper
  analyze:
    plugin: gemini-analyzer
    provider: scholarships
  notify:
    plugin: whatsapp-notifier
    provider: scholarships
```

---

## Creating Custom Components

### Custom Listener
```javascript
// plugins/listeners/telegram.js
const { BaseListener } = require('../base');

class TelegramListener extends BaseListener {
  async initialize() {
    // Setup telegram client
  }

  async send(target, message) {
    // Send via telegram
  }

  on(eventName, callback) {
    // Subscribe to events
  }
}

module.exports = { TelegramListener };
```

Then register in `plugins.registry.js`:
```javascript
registry.registerPlugin('listener', 'telegram-listener', TelegramListener);
```

### Custom Provider
```javascript
// providers/jobs/index.js
const { BaseProvider } = require('../base');
const { JobAnalyzer } = require('./analyzer');
const { JobNotifier } = require('./notifier');

class JobsProvider extends BaseProvider {
  getAnalyzer() { return new JobAnalyzer(); }
  getNotifier() { return new JobNotifier(); }
  getSchema() { return JOB_RESPONSE_SCHEMA; }
}

module.exports = { JobsProvider };
```

Then register in `plugins.registry.js`:
```javascript
registry.registerProvider('jobs', JobsProvider);
```

### Custom Pipeline
```yaml
# pipelines/telegram-jobs.yaml
name: Telegram Jobs Pipeline
provider: jobs
stages:
  listen:
    plugin: telegram-listener
  scrape:
    primary: jina-scraper
  analyze:
    plugin: gemini-analyzer
    provider: jobs
  notify:
    plugin: telegram-notifier
    provider: jobs
```

---

## Extensibility

### Add a New Analyzer
1. Create `plugins/analyzers/openai.js` extending `BaseAnalyzer`
2. Implement `async analyze(content, context)`
3. Register in `plugins.registry.js`

### Add a New Opportunity Type
1. Create `providers/internships/` with:
   - `config.js` — Internship evaluation criteria
   - `schema.js` — Internship data schema  
   - `analyzer.js` — Internship analyzer
   - `notifier.js` — Internship formatter
   - `index.js` — Provider class
2. Register provider in `plugins.registry.js`
3. Create `pipelines/internships.yaml` pipeline config

### Add a New Notification Channel
1. Create `plugins/notifiers/email.js` or `slack.js`
2. Implement notification sending logic
3. Create provider-specific formatters as needed

---

## Running Multiple Pipelines

Noria supports running multiple pipelines simultaneously:

```javascript
// index.js
const orchestrator = new PipelineOrchestrator(broker);

// Load multiple pipelines
orchestrator.loadPipelineFromYAML('pipelines/scholarships.yaml');
orchestrator.loadPipelineFromYAML('pipelines/jobs.yaml');

// Initialize both
await orchestrator.initializePipeline('Scholarships Pipeline');
await orchestrator.initializePipeline('Jobs Pipeline');

// Wire events for both
orchestrator.wirePipelineEvents('Scholarships Pipeline');
orchestrator.wirePipelineEvents('Jobs Pipeline');
```

Both pipelines run independently, sharing the same event broker.

---

## File Structure Reference

```
noria/
├── src/
│   ├── core/                          # Orchestration layer
│   │   ├── broker.js                  # Event bus
│   │   ├── registry.js                # Plugin/provider registry
│   │   ├── pipeline.js                # Pipeline orchestrator
│   │   └── events.js                  # Event types
│   │
│   ├── plugins/                       # Pluggable components
│   │   ├── base/
│   │   │   └── index.js               # Base classes
│   │   ├── listeners/
│   │   │   ├── whatsapp.js
│   │   │   └── ... future: telegram
│   │   ├── scrapers/
│   │   │   ├── puppeteer.js
│   │   │   ├── jina.js
│   │   │   └── ... future: api.js
│   │   ├── analyzers/
│   │   │   ├── gemini.js
│   │   │   └── ... future: openai.js
│   │   └── notifiers/
│   │       └── ... (provider-specific)
│   │
│   ├── providers/                     # Opportunity types
│   │   ├── base/
│   │   │   └── index.js               # BaseProvider
│   │   ├── scholarships/
│   │   │   ├── config.js
│   │   │   ├── schema.js
│   │   │   ├── analyzer.js
│   │   │   ├── notifier.js
│   │   │   └── index.js
│   │   ├── jobs/
│   │   │   └── ... (same structure)
│   │   └── internships/
│   │       └── ... (same structure)
│   │
│   ├── middleware/                    # Cross-cutting concerns
│   │   ├── deduplicator.js
│   │   ├── validator.js
│   │   └── metrics.js
│   │
│   ├── utils/                         # Shared utilities
│   │   ├── retry.js
│   │   ├── cache.js
│   │   ├── validators.js
│   │   ├── queue.js
│   │   ├── metrics.js
│   │   └── logger.js
│   │
│   ├── config/                        # Configuration
│   │   ├── index.js
│   │   ├── plugins.registry.js
│   │   └── schemas/
│   │
│   └── index.js                       # Entry point
│
├── pipelines/                         # Pipeline definitions
│   ├── scholarships.yaml
│   ├── jobs.yaml
│   └── internships.yaml
│
└── docs/
    ├── ARCHITECTURE.md                # This file
    ├── PLUGINS.md                     # Plugin development guide
    ├── PROVIDERS.md                   # Provider development guide
    └── QUICKSTART.md
```

---

## Key Benefits

1. **No Hardcoding** — Everything configurable via YAML + .env
2. **Plug-and-Play** — Add components without touching core
3. **Multi-Provider** — Run scholarships + jobs + internships simultaneously
4. **Fully Testable** — Clear interfaces, mockable dependencies
5. **Observable** — Metrics, logging, dead-letter queues
6. **Production-Ready** — Retry logic, circuit breakers, health checks
7. **Open Source** — Clear documentation, examples, community-friendly

---

## Next Steps

1. ✅ Implement remaining plugin wrappers
2. ✅ Create notifier plugins (WhatsApp, Email, Slack)
3. ✅ Add jobs/internships providers
4. ✅ Update main `index.js` to use new architecture
5. ✅ Create plugin development guide (`PLUGINS.md`)
6. ✅ Create provider development guide (`PROVIDERS.md`)
7. ✅ Create quickstart guide (`QUICKSTART.md`)
8. ✅ Add comprehensive tests
