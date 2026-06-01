<p align="center">
  <img src="https://img.shields.io/badge/NORIA-v2.0.0-blue?style=for-the-badge&logo=javascript&logoColor=white" alt="Noria Version" />
  <img src="https://img.shields.io/badge/LICENSED-MIT-yellow?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/COVERAGE-92.3%25-green?style=for-the-badge" alt="Coverage" />
  <img src="https://img.shields.io/badge/TESTS-83%20PASSING-brightgreen?style=for-the-badge" alt="Tests" />
</p>

<h1 align="center">NORIA</h1>

<p align="center">
  <strong>A Decoupled, Event-Driven Pipeline Orchestrator for Opportunity Extraction & Generative Evaluation</strong>
</p>

<p align="center">
  Designed and engineered by <a href="https://github.com/AhmadHassan-BTed">Ahmad Hassan (B-Ted)</a>.
</p>

---

## 🌟 The Vision & Vibe

Opportunities define careers, yet discovery remains a chaotic manual process. Noria was created to bridge this gap. Noria connects humans to life-changing possibilities by crawling raw web pages, executing rigorous AI evaluations against human profiles, and sending real-time alerts. Whether helping students secure fully funded academic scholarships or matching developers with remote job postings, Noria converts raw internet noise into structured opportunities.

---

## 🏛️ Clean Architecture & Boundary Separation

Noria enforces strict Hexagonal Architecture principles. The core orchestrator acts as a pure coordinator, maintaining absolute isolation from external protocols, drivers, or specific AI libraries.

### Module Relationship & Boundaries

```mermaid
graph TD
    classDef core fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px;
    classDef domain fill:#efebe9,stroke:#8d6e63,stroke-width:2px;
    classDef infra fill:#f1f8e9,stroke:#7cb342,stroke-width:2px;
    classDef features fill:#fff3e0,stroke:#ffb74d,stroke-width:2px;

    subgraph Domain ["src/domain/ (Abstract Specifications)"]
        Contracts["contracts/ <br> (BaseProvider, BaseNotifier, etc.)"]:::domain
        Events["events.js <br> (Domain Events)"]:::domain
        Validators["validators.js <br> (Payload Validation)"]:::domain
    end

    subgraph Core ["src/core/ (Dynamic Event Heart)"]
        Pipeline["pipeline.js <br> (Pipeline Orchestrator)"]:::core
        Registry["registry.js <br> (Boot Verification)"]:::core
        Broker["queue/broker.js <br> (Event Coordinator)"]:::core
    end

    subgraph Infrastructure ["src/infrastructure/ (Technical Adapters)"]
        Scrapers["scrapers/ <br> (Puppeteer, Jina)"]:::infra
        Notifiers["notifiers/ <br> (WhatsApp)"]:::infra
        Listeners["listeners/ <br> (WhatsApp Listener)"]:::infra
        Queue["queue/dlq.js <br> (Retry Logic & DLQ)"]:::infra
    end

    subgraph Features ["src/providers/ (Cohesive Opportunities)"]
        Scholarships["scholarships/ <br> (Evaluation Logic)"]:::features
        Jobs["jobs/ <br> (Evaluation Logic)"]:::features
    end

    Pipeline --> Broker
    Pipeline --> Registry
    Registry --> Contracts
    Scrapers -.-> Contracts
    Notifiers -.-> Contracts
    Listeners -.-> Contracts
    Scholarships -.-> Contracts
    Jobs -.-> Contracts
```

---

## 🔄 System Lifecycle & Request Flow

Noria processes raw internet inputs and coordinates executions dynamically through standard domain events:

```mermaid
sequenceDiagram
    autonumber
    actor TargetChat as WhatsApp Group/Chat
    participant Listener as Listener Plugin
    participant Core as Pipeline Orchestrator
    participant Scraper as Scraper Adapter
    participant Cache as Memory Cache
    participant Analyzer as Gemini Analyzer
    participant Notifier as Notifier Adapter

    TargetChat->>Listener: Shares raw URL message
    Listener->>Core: Emit link_extracted (URL)
    Core->>Cache: Check for processing duplicates
    alt Cache Hit (Already Processed)
        Cache-->>Core: Skip URL evaluation
    else Cache Miss (Fresh Opportunity)
        Core->>Scraper: Emit scraper:start (URL)
        Scraper->>Scraper: Execute Scrape (Jina Reader / Puppeteer)
        Scraper-->>Core: Return extracted web text
        Core->>Core: Validate web text size & contents
        Core->>Core: Emit scraper:success
        Core->>Core: Emit analyzer:start (Text)
        Core->>Analyzer: Execute LLM scoring evaluation
        Analyzer->>Analyzer: Generate parsed JSON response
        Analyzer-->>Core: Return match results & verdict
        alt Match Score >= 50 (High Alignment)
            Core->>Core: Emit analyzer:match_found
            Core->>Notifier: Format layout & execute send
            Notifier->>TargetChat: Deliver markdown message alert
            Core->>Core: Emit notifier:send
        else Match Score < 50
            Core->>Core: Emit analyzer:no_match
        end
    end
```

---

## ⚙️ Statically Enforced Registry Validation

Dynamic verification occurs at boot-time inside the `PluginRegistry` (`src/core/registry.js`). If a class is registered without conforming to the domain specifications, Noria fails fast with an interface violation error:

<details>
<summary><b>🔍 View Enforced Interface Constraints (Collapsible)</b></summary>

| Registry Type | Target Interface Class | Mandatory Signature Methods |
| :--- | :--- | :--- |
| **Provider** | `BaseProvider` | `getAnalyzer()`, `getNotifier()`, `getSchema()`, `getMetadata()` |
| **Listener** | `BaseListener` | `initialize()`, `on(event, cb)`, `close()` |
| **Scraper** | `BaseScraper` | `scrape(url, options)` |
| **Analyzer** | `BaseAnalyzer` | `analyze(content, context)`, `setProvider(provider)` |
| **Notifier** | `BaseNotifier` | `send(target, message)`, `setProvider(provider)`, `format(data)` |

</details>

---

## 📁 Repository Structure

```
noria/
├── .github/                       # CI workflows & issue/PR templates
├── docker/                        # Multi-environment container files
├── docs/                          # Guides & system architecture docs
├── pipelines/                     # Declarative YAML workflow configurations
│   ├── jobs.yaml                  # Crawler stage coordinates for Jobs
│   └── scholarships.yaml          # Crawler stage coordinates for Scholarships
├── src/                           # Platform code
│   ├── config/                    # Environment settings loader
│   ├── core/                      # Core orchestrator and cache systems
│   ├── plugins/                   # Technical communication adapters
│   ├── providers/                 # Opportunity business rules
│   ├── queue/                     # Decoupled global event broker
│   ├── utils/                     # System-wide helper libraries
│   └── index.js                   # Main consolidated entrypoint
└── tests/                         # Unit and integration test suites
```

---

## 🚀 Installation & Quickstart

### 1. Requirements
- **Node.js**: `>=22.12.0` (LTS highly recommended)
- **NPM**: `>=10.0.0`

### 2. Setup
Install the standard dependencies:
```bash
git clone https://github.com/AhmadHassan-BTed/Noria.git
cd noria
npm install
```

### 3. Configure
Create a `.env` file from the template:
```bash
cp .env.example .env
```
Provide the required keys:
```env
GEMINI_API_KEY=your_gemini_api_key
NOTIFICATION_TARGET=your_phone_number
ACTIVE_PIPELINES=scholarships,jobs
```

### 4. Run
Start the orchestrated pipelines:
```bash
npm start
```

---

## 🧪 Developer Workflow & Commands

The project enforces strict quality gates on all contributions. Ensure all local automation checks pass cleanly:

| Command | Objective | Quality Gate Target |
| :--- | :--- | :--- |
| `npm run lint` | ESLint Code Quality | Zero errors or warnings |
| `npm run format:check` | Prettier Layout Verification | Compliant with project styles |
| `npm test` | Jest Unit Tests Execution | All 83 tests passing |
| `npm run test:coverage` | Test Coverage Telemetry | Global coverage must be > 90% |
| `npm run build` | Compile Production Bundle | Successful output in `dist/` |

---

## 🤝 Contributing

Contributions to Noria are welcomed. Please review [CONTRIBUTING.md](docs/CONTRIBUTING.md) and submit a pull request adhering to the review checklist in our [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).
