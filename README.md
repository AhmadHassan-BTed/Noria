# Noria — Event-Driven Opportunity Discovery Pipeline

<p align="center">
  <b>A production-ready, fully-decoupled event-driven pipeline for discovering, evaluating, and notifying scholarship, job, and internship opportunities — 24/7.</b>
</p>

<p align="center">
  <a href="https://github.com/AhmadHassan-BTed/noria/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License"/></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node >=18"/></a>
  <a href=""><img src="https://img.shields.io/badge/status-production_ready-brightgreen?style=flat-square" alt="Production Ready"/></a>
  <a href=""><img src="https://img.shields.io/badge/architecture-fully_decoupled-blue?style=flat-square" alt="Architecture"/></a>
</p>

---

## Overview

**Noria** is a fully decoupled, plugin-based, event-driven pipeline system designed for discovering and evaluating opportunities (scholarships, jobs, internships) based on user profiles. It runs 24/7, listens for opportunities via WhatsApp, evaluates them using AI (Google Gemini), and delivers notifications.

### Why Noria?

Named after the Persian water wheel — symbolizing continuous, reliable flow — Noria provides a continuous stream of curated opportunities through a decoupled, scalable, and maintainable architecture.

### Key Features

✅ **Fully Decoupled** — Swap any component (listener, scraper, analyzer, notifier)  
✅ **Plugin System** — Add custom components without touching core  
✅ **Multi-Provider** — Support scholarships, jobs, internships simultaneously  
✅ **Configuration-Driven** — YAML pipelines, zero hardcoding  
✅ **Production-Ready** — Retry logic, caching, dead-letter queues, metrics  
✅ **Open Source Ready** — Clear interfaces, comprehensive documentation  
✅ **Type-Safe** — Strong typing and validation throughout  
✅ **Well-Tested** — Unit and integration tests included  

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key ([get here](https://aistudio.google.com/))
- WhatsApp account for receiving notifications

### Installation

```bash
# Clone repository
git clone https://github.com/AhmadHassan-BTed/noria.git
cd noria

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys and preferences
nano .env

# Run
npm start
```

### First Run

1. Scan the QR code displayed in terminal with WhatsApp
2. Send a message with a scholarship/job URL to the authenticated number
3. Noria evaluates it and sends back matching results

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────┐
│        WhatsApp / Telegram / Discord        │
│       (Inbound opportunity notifications)   │
└────────────────┬────────────────────────────┘
                 │
        ┌────────▼────────┐
        │  URL Extraction │
        │  & Validation   │
        └────────┬────────┘
                 │
        ┌────────▼──────────┐
        │  Deduplication    │
        │  Cache (24h TTL)  │
        └────────┬──────────┘
                 │
    ┌────────────▼───────────────┐
    │  Hybrid Content Scraper    │
    │  ┌─ Jina AI (fast-path)   │
    │  └─ Puppeteer (fallback)   │
    └────────────┬───────────────┘
                 │
    ┌────────────▼──────────────────┐
    │  AI Evaluation (Gemini 2.5)   │
    │  • Provider-specific scoring  │
    │  • Criteria matching          │
    │  • Response validation        │
    └────────────┬──────────────────┘
                 │
    ┌────────────▼──────────────────┐
    │  Provider-Specific Formatter  │
    │  (Scholarships/Jobs/etc)      │
    └────────────┬──────────────────┘
                 │
┌────────────────▼────────────────────┐
│  WhatsApp / Telegram / Email / Slack  │
│  (Send formatted match notification)  │
└──────────────────────────────────────┘
```

### Folder Structure

```
noria/
├── src/                        # Source code
│   ├── index.js                # Single entry point
│   ├── config/                 # Configuration system
│   │   ├── config.js           # Config loader from .env
│   │   ├── plugins.registry.js # Plugin registration
│   │   └── constants.js        # Global constants
│   ├── plugins/                # Pluggable components
│   │   ├── registry.js         # Plugin management
│   │   ├── base/               # Base classes
│   │   ├── listeners/          # Message sources
│   │   ├── scrapers/           # Content extraction
│   │   ├── analyzers/          # AI evaluation
│   │   └── notifiers/          # Message formatters
│   ├── providers/              # Opportunity types
│   │   ├── base/               # Provider interface
│   │   └── scholarships/       # Scholarship provider
│   ├── core/                   # Core infrastructure
│   │   ├── broker.js           # Event bus
│   │   ├── pipeline.js         # Pipeline orchestrator
│   │   ├── events.js           # Event types
│   │   └── logger.js           # Structured logging
│   ├── utils/                  # Utilities
│   │   ├── retry.js            # Exponential backoff
│   │   ├── cache.js            # LRU cache
│   │   ├── validators.js       # Input/output validation
│   │   ├── queue.js            # Dead-letter queue
│   │   └── metrics.js          # Metrics collection
│   └── middleware/             # Cross-cutting concerns
│       ├── deduplicator.js
│       ├── validator.js
│       └── metrics.js
├── pipelines/                  # Pipeline definitions
│   ├── scholarships.yaml       # Scholarships pipeline
│   └── jobs.yaml               # Jobs pipeline (template)
├── docs/                       # Documentation
│   ├── architecture.md
│   ├── deployment.md
│   ├── contributing.md
│   └── security.md
├── tests/                      # Test suite
│   ├── unit/
│   └── integration/
├── docker/                     # Docker configs
│   ├── Dockerfile
│   └── docker-compose.yml
├── scripts/                    # Build/deploy scripts
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
└── package.json                # Dependencies
```

---

## Features

### 1. Plugin System

Swap any component without core changes:

```javascript
// Add custom listener (Telegram, Discord, etc)
class TelegramListener extends BaseListener {
  async initialize() { /* ... */ }
  async send(target, message) { /* ... */ }
}

// Register in config/plugins.registry.js
registry.registerPlugin('listener', 'telegram', TelegramListener);

// Use in pipeline
stages:
  listen:
    plugin: telegram-listener
```

### 2. Multi-Provider Support

Add new opportunity types (jobs, internships, grants):

```javascript
// Create provider
class JobsProvider extends BaseProvider {
  getAnalyzer() { return new JobAnalyzer(); }
  getNotifier() { return new JobNotifier(); }
  getSchema() { return JOB_SCHEMA; }
}

// Register and use in pipeline
ACTIVE_PIPELINES=scholarships,jobs
```

### 3. Resilience & Reliability

- ✅ **Retry Logic** — Exponential backoff for transient failures
- ✅ **Content Caching** — 24-hour LRU cache prevents duplicate processing
- ✅ **Dead-Letter Queue** — Failed items automatically retried, logged if final failure
- ✅ **Health Checks** — WhatsApp connection monitoring
- ✅ **Metrics** — 60s reporting of pipeline health
- ✅ **Graceful Shutdown** — Clean process termination

### 4. Configuration-Driven

No hardcoding — everything via `.env` and YAML:

```env
# .env
GEMINI_API_KEY=xxx
APPLICANT_NATIONALITY=Pakistan
ACTIVE_PIPELINES=scholarships,jobs
MAX_RETRIES=3
```

```yaml
# pipelines/scholarships.yaml
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

## Deployment

### Local Development

```bash
npm install
cp .env.example .env
# Edit .env
npm start
```

### Docker

```bash
docker-compose up -d
# View logs
docker-compose logs -f noria
```

### Production

See [docs/deployment.md](docs/deployment.md) for:
- PM2 setup
- Systemd service
- Kubernetes deployment
- Environment management
- Monitoring and alerting

---

## Configuration

### Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Key variables:

- `GEMINI_API_KEY` — Google Gemini API key (required)
- `NOTIFICATION_TARGET` — WhatsApp number (required)
- `APPLICANT_NATIONALITY` — Your nationality (hard constraint)
- `APPLICANT_TARGET_FIELDS` — Your target fields (for matching)
- `MAX_RETRIES` — Retry attempts (default: 3)
- `ACTIVE_PIPELINES` — Which pipelines to run (default: scholarships)

### Pipeline Configuration

Define pipelines in `pipelines/` directory as YAML:

```yaml
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

## Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Install pre-commit hooks
npm run prepare

# Start development server with auto-reload
npm run dev
```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm test -- --testPathPattern=integration

# With coverage
npm test -- --coverage
```

### Linting & Formatting

```bash
# Check code quality
npm run lint

# Format code
npm run format

# Fix linting issues
npm run lint:fix
```

### Building

```bash
# Build for production
npm run build

# Start production build
npm start
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- PR process
- Commit conventions
- Testing requirements
- Documentation standards

### Quick Contribution Steps

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests
5. Run linting and tests
6. Commit with conventional commits (`git commit -m "feat: add amazing feature"`)
7. Push to branch
8. Open Pull Request

---

## Architecture Decisions

See [docs/architecture.md](docs/architecture.md) for detailed rationale on:
- Plugin system design
- Event-driven architecture
- Provider pattern
- Resilience strategies
- Security model

---

## Security

### Reporting Vulnerabilities

Do **not** open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for responsible disclosure.

### Security Practices

- ✅ No secrets in code
- ✅ Environment-based configuration
- ✅ Input validation on all boundaries
- ✅ Error messages don't leak sensitive info
- ✅ Regular dependency updates
- ✅ Security-focused code review

---

## Performance

### Scalability

- Single instance handles ~50 opportunities/day
- Horizontal scaling via multiple instances
- Stateless design (session persisted in `.wwebjs_auth/`)
- Efficient caching (24h TTL, max 500 URLs)

### Optimization Tips

1. **Adjust cache settings** — Tune `CACHE_TTL_MS` and `CACHE_MAX_SIZE`
2. **Retry configuration** — Balance `MAX_RETRIES` vs cost
3. **Metrics interval** — Reduce `METRICS_INTERVAL_MS` for more data
4. **Pipeline configuration** — Use fast-path scraper (Jina) where possible

---

## Troubleshooting

### WhatsApp Connection Issues

**Problem**: QR code not scanning
- Solution: Delete `.wwebjs_auth/` folder, restart, rescan QR code

**Problem**: Messages not being received
- Solution: Ensure `NOTIFICATION_TARGET` is correctly formatted (+CC + number)

### Scraper Issues

**Problem**: Content not being extracted
- Solution: Jina might be blocked, Puppeteer fallback should trigger

**Problem**: Puppeteer crashes on Raspberry Pi
- Solution: Ensure chromium is installed (`sudo apt install chromium-browser`)

### Analyzer Issues

**Problem**: Gemini API errors
- Solution: Check `GEMINI_API_KEY`, ensure API is enabled in Google Cloud

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features:
- [ ] Additional opportunity types (grants, fellowships)
- [ ] More scraper backends (RSS, APIs)
- [ ] Alternative notifiers (Email, Slack, Telegram)
- [ ] Web UI for configuration
- [ ] Database integration
- [ ] Advanced analytics
- [ ] Team collaboration features

---

## Support

- 📖 [Documentation](docs/)
- 🐛 [Report Issues](https://github.com/AhmadHassan-BTed/noria/issues)
- 💬 [Discussions](https://github.com/AhmadHassan-BTed/noria/discussions)
- 📧 Contact: See [SUPPORT.md](SUPPORT.md)

---

## License

MIT — See [LICENSE](LICENSE) file

---

## Acknowledgments

- Built with Node.js, Puppeteer, and Google Generative AI
- Inspired by event-driven architecture patterns
- Thanks to the open-source community

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/AhmadHassan-BTed">Ahmad Hassan (B-Ted)</a>
  <br>
  <i>Noria — continuous flow of opportunity</i>
</p>
