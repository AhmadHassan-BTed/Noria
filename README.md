<p align="center">
  <img src="docs/images/hero-banner.svg" alt="Noria Hero Banner" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NORIA-v2.1.0-blue?style=for-the-badge&logo=javascript&logoColor=white" alt="Noria Version" />
  <img src="https://img.shields.io/badge/LICENSED-MIT-yellow?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/TESTS-224%20PASSING-brightgreen?style=for-the-badge" alt="Tests" />
</p>


<h1 align="center">NORIA</h1>

<p align="center">
  <strong>A Decoupled, Hexagonal Pipeline Orchestrator for Opportunity Extraction & Generative Evaluation</strong>
</p>

<p align="center">
  Designed and engineered by <a href="https://github.com/AhmadHassan-BTed">Ahmad Hassan (B-Ted)</a>.
</p>

---

## 🌟 The Vision

Opportunities define careers, yet discovery remains a chaotic manual process. Noria was created to bridge this gap. Noria connects humans to life-changing possibilities by crawling raw web pages, executing rigorous AI evaluations against human profiles, and sending real-time alerts. Whether helping students secure fully funded academic scholarships or matching developers with remote job postings, Noria converts raw internet noise into structured opportunities.

---

## 🏛️ Clean Architecture & Boundary Separation

Noria enforces strict Hexagonal Architecture principles, separating core business domains from pluggable technical infrastructure. Dependencies flow strictly inward: `Infrastructure → Core → Domain`.

### Module Relationship & Boundaries

```mermaid
graph TD
    classDef core fill:#e1f5fe,stroke:#03a9f4,stroke-width:2px;
    classDef domain fill:#efebe9,stroke:#8d6e63,stroke-width:2px;
    classDef infra fill:#f1f8e9,stroke:#7cb342,stroke-width:2px;

    subgraph Domains ["src/domains/ (Pure Business Logic)"]
        Scholarships["scholarships/ <br> (Evaluation Prompt & Layout Template)"]:::domain
        Jobs["jobs/ <br> (Evaluation Prompt & Layout Template)"]:::domain
    end

    subgraph Core ["src/core/ (Pipeline Orchestrator)"]
        Pipeline["pipeline.js <br> (Sequential Orchestrator)"]:::core
        Registry["registry.js <br> (Functional Registry)"]:::core
        Events["events.js <br> (Domain Events)"]:::core
    end

    subgraph Infrastructure ["src/infrastructure/ (Stateless Adapters)"]
        Scrapers["scraper/ <br> (Jina, Puppeteer, Resilient Fetch)"]:::infra
        LLM["llm/ <br> (Gemini Adapter & Request Queue)"]:::infra
        Messaging["messaging/ <br> (WhatsApp Sender & Listener)"]:::infra
    end

    Pipeline --> Registry
    Pipeline --> Events
    Registry --> Domains
    Registry --> Infrastructure
```

---

## 🔄 System Lifecycle & Request Flow

Noria processes raw internet inputs and coordinates executions dynamically through standard domain events:

```mermaid
sequenceDiagram
    autonumber
    actor TargetChat as WhatsApp Group/Chat
    participant Listener as WhatsApp Listener
    participant Core as Pipeline Orchestrator
    participant Scraper as Scraper Adapter
    participant Cache as Memory Cache
    participant Analyzer as Gemini Adapter
    participant Sender as WhatsApp Sender

    TargetChat->>Listener: Shares raw URL message
    Listener->>Core: Emit link_extracted (URL)
    Core->>Cache: Check for processing duplicates
    alt Cache Hit (Already Processed)
        Cache-->>Core: Skip URL evaluation
    else Cache Miss (Fresh Opportunity)
        Core->>Scraper: Execute Scrape (Jina / Puppeteer)
        Scraper-->>Core: Return extracted web text
        Core->>Core: Validate web text size & contents
        Core->>Core: Emit scraper:success
        Core->>Core: Build Prompt (Domain promptBuilder)
        Core->>Analyzer: Call Gemini structured generation
        Analyzer-->>Core: Return match results & verdict
        alt Match Score >= 50 (High Alignment)
            Core->>Core: Emit analyzer:match_found
            Core->>Core: Format Template (Domain templateBuilder)
            Core->>Sender: sendMessage (whatsapp-sender)
            Sender->>TargetChat: Deliver markdown message alert
            Core->>Core: Emit notifier:send
        else Match Score < 50
            Core->>Core: Emit analyzer:no_match
        end
    end
```

---

## ⚙️ Registry Validation

Dynamic verification occurs at boot-time inside the `PluginRegistry` (`src/core/registry.js`). Registered modules are validated functionally:

<details>
<summary><b>🔍 View Enforced Interface Constraints (Collapsible)</b></summary>

| Registry Category | Target Registration | Mandatory Signature / Keys |
| :--- | :--- | :--- |
| **Domain** | Plain Domain Object | `buildPrompt`, `resolveProfile`, `buildTemplate`, `schema` |
| **Adapter (scraper)** | Plain Scraper Object | `scrape` |
| **Adapter (llm)** | Plain LLM Object | `generateStructuredData` |
| **Adapter (sender)** | Plain Sender Object | `sendMessage` |
| **Listener** | Constructor Class | `initialize()`, `on(event, cb)`, `close()` |

</details>

---

## 📁 Repository Structure

```
noria/
├── docs/                          # Guides & system architecture docs
│   └── ARCHITECTURE.md            # Detailed Hexagonal Architecture specifications
├── pipelines/                     # Declarative YAML workflow configurations
│   ├── jobs.yaml                  # Crawler stage coordinates for Jobs
│   └── scholarships.yaml          # Crawler stage coordinates for Scholarships
├── src/                           # Platform code
│   ├── config/                    # Environment settings loader & registry wiring
│   ├── core/                      # Pipeline orchestrator, event types, registry
│   ├── domains/                   # Pure business logic prompts & notification templates
│   ├── infrastructure/            # Stateless adapters (LLM, Scraper, WhatsApp)
│   ├── queue/                     # Decoupled global event broker
│   ├── utils/                     # System-wide helper libraries (Retry, Cache)
│   └── index.js                   # Boot entrypoint
└── tests/                         # Unit test suite mirroring src/
```

---

## 🚀 Installation & Quickstart

### 1. Requirements
- **Node.js**: `>=22.12.0` (LTS highly recommended)
- **NPM**: `>=10.0.0`

### 2. Setup
Install dependencies:
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

Ensure all local verification checks pass cleanly:

| Command | Objective | Quality Gate Target |
| :--- | :--- | :--- |
| `npm run lint` | ESLint Code Quality | Zero errors or warnings |
| `npm run format:check` | Prettier Layout Verification | Compliant with project styles |
| `npm test` | Jest Unit Tests Execution | All 223 tests passing |
| `npm run test:coverage` | Test Coverage Telemetry | Global coverage must be > 90% |
