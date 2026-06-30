# Noria Architectural Specifications & Domain Boundaries

This document details the architectural design patterns, dynamic validation boundaries, and decoupled event loops governing the Noria platform.

---

##  Hexagonal Architecture & Boundary Separation

Noria separates core business domains from pluggable communication protocols, enforcing absolute isolation (0 coupling, 100% cohesion).

```
           ┌─────────────────────────────────────────┐
           │            COMPOSITION ROOT             │
           │    (src/config/plugins.registry.js)     │
           └────┬───────────────┬───────────────┬────┘
                │ (wires)       │ (wires)       │ (wires)
                ▼               ▼               ▼
        ┌──────────────┐┌──────────────┐┌──────────────┐
        │INFRASTRUCTURE││     CORE     ││   DOMAINS    │
        │  (Adapters)  ││(Orchestrator)││(Business Log)│
        └──────┬───────┘└──────┬───────┘└──────────────┘
               │               │
               │ (implements   │ (uses pure
               │  adapters)    │  functions)
               ▼               ▼
               └───────────────┴───────────────────────►
```

### 1. The Core Orchestration Engine (`src/core/`)
Residing at the center of the architecture, the Core Orchestrator coordinates event transitions between stages purely by referencing abstract contracts, without retaining technical client references directly:
- **`pipeline.js`**: Resolves pipeline configurations, subscribes to standard events, and coordinates execution flow.
- **`registry.js`**: Manages functional registrations for domains and adapters, ensuring strict interface compliance.
- **`events.js`**: Defines the system event types.

### 2. Pure Business Domains (`src/domains/`)
Self-contained, highly cohesive business packages representing a specific opportunity category (e.g. `scholarships` or `jobs`). Every export is either a pure function or static data. No classes. No inheritance:
- `schema.js`: Structured JSON schemas evaluated by the AI.
- `promptBuilder.js`: Pure prompt-building functions (`buildPrompt`) and applicant profile resolvers (`resolveProfile`).
- `templateBuilder.js`: Pure template layout formatters (`buildTemplate`).
- `config.js`: Custom scoring weights and override rules.
- `index.js`: Exposes domain resources as a plain object manifest.

Domains are purely passive domain modules. They do not know *how* raw web text is scraped or *how* alerts are transmitted over the network.

### 3. Pluggable Infrastructure Adapters (`src/infrastructure/`)
Interchangeable driver adapters satisfying the domain interfaces. Grouped strictly by technical role:
- **Scrapers** (`src/infrastructure/scraper/`): Concrete crawlers (Jina, Puppeteer, resilient native fetch) translating URLs to text.
- **LLM** (`src/infrastructure/llm/`): Stateless adapters (Gemini) communicating with AI services, incorporating model fallback chains and queue managers.
- **Messaging** (`src/infrastructure/messaging/`):
  - `whatsapp-sender.js`: A stateless function module (`sendMessage`) for delivering alerts.
  - `whatsapp-listener.js`: Stateful class managing client events and pre-fetching. Keep in mind this is the only remaining class-based driver to support state preservation (session keys, WS reconnects).

---

##  Lifecycle Event Loop

Noria's execution stages are coordinated completely dynamically through decoupled events emitted via the global `broker`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NORIA LIFECYCLE LOOP                            │
┌────────────────────────────────────────────────────────────────────────┐

  [WhatsApp Listener]
         │
         │ Extracts URL
         ▼
  (Event: scraper:start)
         │
         ├──► [Pipeline Orchestrator] 
         │         │
         │         ├─► [Memory Cache Check] (evicts duplicate URLs)
         │         │
         │         ▼ (Tiered Scraping Call)
         │    [Scrapers: Jina / Puppeteer / Resilient Fetch]
         │         │
         │         ▼ (Validates content & emits scraper:success)
         │         
         │         ▼ (Resolves Domain & Profile)
         │    [Domain Prompt Builder]
         │         │
         │         ▼ (Generates structured AI response)
         │    [Gemini LLM Adapter]
         │         │
         │         ▼ (Applies validation rules)
         │         
         ▼ [If Match Score >= 50]
  (Event: analyzer:match_found)
         │
         ├──► [Domain Template Builder] (Formats text layout)
         │
         ▼ (Delivers notification message)
  [WhatsApp Sender Adapter]
         │
         ▼ (Records system statistics)
  (Event: notifier:send)
```

---

##  Resilient Gating, Scraping & Model Fallbacks

Noria incorporates advanced resilience features to handle rate limits, network synchronization, and scraping blocks:

### 1. Granular Message Source Gating & JID Resolution
Message listeners utilize decoupled origin classification and mode normalization helpers:
- **`source-mode.js`**: Normalizes source configurations (e.g. `individual`, `groups`, `channels`, or legacy arrays).
- **`source-classifier.js`**: Classifies message origins using `getMsgChatId(msg)`. By checking both `msg.from` and `msg.to`, it extracts the actual target chat JID for both incoming and outgoing (`fromMe`) messages, enabling precise whitelist checks and allowing manual self-message testing from the linked device without infinite loop feedback.

### 2. Triple-Layer Resilient Scraping
When a scraper event triggers, the core pipeline attempts a three-tier recovery:
- **Primary Scraper**: Executes Jina or other API-based scraping.
- **Fallback Scraper**: Executes Puppeteer headless scraper if the primary fails.
- **Native Fetch Recovery**: Directly requests the URL with spoofed user agents, strips HTML tags, scripts, styles, navigation, and footers, and processes the text as a final fail-safe.

### 3. Dynamic Model Fallback Chain & 429 Rate Limit Handling
To prevent quota blocks and rate limits from interrupting active scans:
- **Exact Delay Extraction**: Gemini analyzer extracts exact delay times from 429 errors (both JSON responses and textual headers) and pauses execution for the requested duration + a `1.5s` safety buffer.
- **Model Fallback**: Sequentially falls back to alternative models (e.g., `gemini-2.5-flash` -> `gemini-1.5-flash` -> `gemini-1.5-pro`) on 429 blocks and promotes the successful model to avoid subsequent blocks.

### 4. Deduplication & Cache Clearing
To allow users to force re-evaluation of URLs, a multi-level cache clearing system is implemented:
- **Profile-Level & Device-Level Clear**: Streamlit buttons write `clear-cache-{instanceId}.flag` files.
- **Backend Flag Detection**: The orchestrator checks for these flags absolutely relative to `__dirname`, flushes the in-memory URL deduplication cache (`urlCache`) when found, and deletes the flag.

---

##  Dynamic Interface Validation & Registry

To keep the application robust while supporting plug-and-play extensions, the central Registry ([registry.js](file:///p:/noria/src/core/registry.js)) bootstrapped by the Composition Root ([plugins.registry.js](file:///p:/noria/src/config/plugins.registry.js)) performs strict verification check blocks:

### 1. Domain Module Validation
Every registered domain module must export:
- `buildPrompt`: Function to generate the LLM prompt.
- `resolveProfile`: Function to map config to profiles.
- `buildTemplate`: Function to build the output template.
- `schema`: Static response schema object.

### 2. Infrastructure Adapter Validation
Infrastructure components are registered under distinct categories:
- `scraper` adapters: must implement `scrape(url)`.
- `llm` adapters: must implement `generateStructuredData(prompt, schema, options)`.
- `sender` adapters: must implement `sendMessage(client, target, message, options)`.

### 3. Listener Class Validation
Because connection listeners retain active listener hooks and WS handles, the registry enforces prototype validation. Classes must implement:
- `initialize()`
- `on()`
- `close()`

---

##  Control Center UI & Standalone Launcher (v1.0.0)

Noria ships a Streamlit-based visual Control Center alongside the core pipeline engine. Starting from v1.0.0, this is delivered as a fully standalone Windows executable.

### Launcher Architecture

```
  ┌──────────────────────────────────────────────────────┐
  │                     Noria.exe                        │
  │             (C# standalone launcher)                 │
  │                                                      │
  │  1. Resolves repo root via Assembly.GetExecutingAssembly().Location  │
  │  2. Checks Python / Node.js availability             │
  │  3. Runs: pip install -r requirements.txt            │
  │  4. Runs: npm install                                │
  │  5. Spawns: python -m streamlit run app.py           │
  │             --server.headless true                   │
  │  6. Opens: chrome --app=http://localhost:8501        │
  │            (or msedge --app=... as fallback)         │
  └──────────────────────────────────────────────────────┘
```

**Key design decisions:**
- Paths are resolved **relative to the exe** (`Assembly.GetExecutingAssembly().Location`) — not the current working directory. This eliminates the `run_noria.bat was not found` error that occurred when the exe was double-clicked from a non-repo directory.
- Streamlit is launched via `python -m streamlit run` — no shell script dependency needed.
- The browser is opened in `--app` mode, making the Control Center appear as a **native desktop window**, not a browser tab.
- The console window stays alive as long as Streamlit runs; closing it shuts down the server cleanly.

### UI Layer Architecture

```
  app.py (Streamlit entry point)
    │
    ├── ui/styles.py          ← Global CSS injection
    ├── ui/components/
    │   └── navigation.py     ← Sidebar & routing
    └── ui/views/
        ├── dashboard.py      ← Real-time scan monitor
        ├── profile_form.py   ← Applicant profile CRUD
        └── ...               ← Other views
```

---

##  Guidelines for Adding Upcoming Opportunity Categories (e.g., Real Estate)

1. Create a self-contained domain folder under `src/domains/realestate/`.
2. Define `promptBuilder.js`, `templateBuilder.js`, `schema.js`, and `config.js` with your specific opportunity prompt scoring parameters.
3. Expose them via `index.js` as a manifest plain object conforming to the Domain interface.
4. Register the new domain module inside `src/config/plugins.registry.js` using `registry.registerDomain('realestate', realEstateDomain)`.
5. Create a declarative config pipeline under `pipelines/realestate.yaml` mapping the crawl listener, scrape technology, and notifications channel.
6. Enable the pipeline by appending `realestate` to the `ACTIVE_PIPELINES` variable in your `.env` file.

With this functional decoupled architecture, **no core orchestrator engine files are touched**, and the new domain category is fully operational.
