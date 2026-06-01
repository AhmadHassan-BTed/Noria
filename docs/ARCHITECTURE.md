# Noria Architectural Specifications & Domain Boundaries

This document details the architectural design patterns, dynamic validation boundaries, and decoupled event loops governing the Noria platform.

---

## 📐 Hexagonal Architecture & Boundary Separation

Noria separates core business domains from pluggable communication protocols, enforcing absolute isolation (0 coupling, 100% cohesion).

### 1. The Core Orchestration Engine (`src/core/`)
Residing at the center of the architecture, the Core Orchestrator has zero dependencies on technical libraries (such as WhatsApp, Puppeteer, or Gemini). It coordinates event transitions between stages purely by referencing abstract contracts:
- **`pipeline.js`**: Resolves declarative stages (crawler, extract, evaluate, notify), subscribes to standard events, and coordinates execution flow.
- **`registry.js`**: Enforces strict class signature compliance at boot.

### 2. Opportunity Providers (`src/providers/`)
Self-contained, highly cohesive business packages representing a specific opportunity category (e.g. `scholarships` or `jobs`):
- `schema.js`: Structured JSON schemas evaluated by the AI.
- `analyzer.js`: Custom scoring prompts based on applicant profiles.
- `notifier.js`: Custom message templates.
- `config.js`: Custom scoring weights and override rules.

Providers are purely passive domain modules. They do not know *how* raw web text is scraped or *how* alerts are transmitted over the network.

### 3. Pluggable Technical Plugins (`src/plugins/`)
Interchangeable driver adapters satisfying the domain interfaces. Grouped strictly by technical role:
- **Scrapers** (`src/plugins/scrapers/`): concrete crawlers (Jina, Puppeteer) translating URLs to text.
- **Notifiers** (`src/plugins/notifiers/`): concrete networks (WhatsApp, WeChat) delivering alerts.
- **Listeners** (`src/plugins/listeners/`): concrete protocols listening for user input.

---

## 🔄 Lifecycle Event Loop

Noria's execution stages are coordinated completely dynamically through decoupled events emitted via the global `broker`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NORIA LIFECYCLE LOOP                            │
└────────────────────────────────────────────────────────────────────────┘

  [WhatsApp Listener]
         │
         │ Extracts url
         ▼
  (Event: scraper:start)
         │
         ▼
  [Scraper Plugin] ──(Checks cache/duplicates)──► [LRU Cache]
         │
         ├─► Primary: [Jina Reader API]
         └─► Fallback: [Puppeteer Scraper]
         │
         ▼ (Extracts text & validates)
  (Event: scraper:success)
         │
         ▼
  (Event: analyzer:start)
         │
         ▼
  [Gemini Analyzer Plugin] ──► [Scholarships / Jobs provider] (builds prompt)
         │
         ▼ (Executes Gemini generation & validates response)
  (Event: analyzer:match_found)  [If Match Score >= 50]
         │
         ▼
  [WhatsApp Notifier Plugin] ──► [Scholarships / Jobs provider] (formats layout)
         │
         ▼ (Delivers alert message)
  (Event: notifier:send)
```

---

## 🔍 Dynamic Interface Validation & Statically Enforced Registry

To keep the application robust while supporting plug-and-play extensions, the `PluginRegistry` (`src/core/registry.js`) performs strict dynamic prototype checks upon registration:

### 1. Provider Contract Enforcements
Any registered opportunity provider class must implement:
- `getAnalyzer()`: Returns the opportunity analyzer prompt builder.
- `getNotifier()`: Returns the layout notifier formatter.
- `getSchema()`: Returns the structured response schema.
- `getMetadata()`: Returns module description metadata.

### 2. Plugin Contract Enforcements
Plugins are checked against their specific type constraints:
- `listener` plugins: Must implement `initialize()`, `on()`, and `close()`.
- `scraper` plugins: Must implement `scrape(url, options)`.
- `analyzer` plugins: Must implement `analyze(content, context)` and `setProvider(provider)`.
- `notifier` plugins: Must implement `send(target, message)`, `setProvider(provider)`, and `format(data)`.

If any signature is missing, the registration fast-fails during boot to avoid runtime errors.

---

## 🚀 Guidelines for Adding Upcoming Opportunity Categories (e.g., Real Estate)

1. Create a self-contained provider package under `src/providers/realestate/`.
2. Define `index.js` extending `BaseProvider`, and export your provider class.
3. Define `schema.js`, `analyzer.js`, `notifier.js`, and `config.js` with your specific prompt scoring parameters.
4. Register the new provider class inside `src/config/plugins.registry.js` using `registry.registerProvider('realestate', RealEstateProvider)`.
5. Create a declarative config pipeline under `pipelines/realestate.yaml` mapping the crawl listener, scrape technology, and notifications channel.
6. Enable the pipeline by appending `realestate` to the `ACTIVE_PIPELINES` variable in your `.env` file.

With this intuitive decoupled architecture, **no core engine files are touched**, and the new opportunity is fully operational.
