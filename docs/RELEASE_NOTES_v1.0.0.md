# Noria v1.0.0 — First Public Release 

**Tag:** `v1.0.0`  
**Release Date:** 2026-06-05  
**Release Type:** Stable  

---

##  What's New in v1.0.0

This is the **first stable, public release** of Noria — a private, on-device agentic system for automated opportunity extraction, AI evaluation, and WhatsApp notification delivery.

### Highlights

- **Standalone Windows Executable** — `Noria.exe` now works from any folder. No bat file, no manual setup. Double-click and you're running.
- **App-Mode UI** — The Control Center no longer opens as a browser tab. It launches as its own **dedicated application window** (via Chrome/Edge `--app` mode), so it feels like a native desktop app.
- **Unified Dark UI** — All input fields, textareas, dropdowns, and password fields now render with consistent dark backgrounds and clean borders — both locally and on Streamlit Community Cloud.
- **Agentic Control Center (Streamlit)** — Fully functional visual dashboard for managing applicant profiles, scanning QR codes, configuring pipelines, and monitoring results in real time.
- **Hexagonal Architecture** — Clean separation of core orchestrator, pure domain logic, and pluggable infrastructure adapters.
- **Triple-Layer Resilient Scraping** — Jina → Puppeteer → Native Fetch fallback chain for maximum scraping reliability.
- **Dynamic Model Fallback** — Automatic Gemini model promotion/demotion to handle 429 rate limits without interruption.
- **WhatsApp Integration** — Link your phone by scanning a QR code. Noria listens to group/channel messages and sends match alerts automatically.

---

##  Release Assets

| Asset | Description |
|:---|:---|
| `Noria.exe` | **Windows Standalone Executable** — double-click to start |
| `run_noria.bat` | Developer launcher for running from source |
| `run_noria.sh` | macOS/Linux launcher for running from source |

### 🟢 Download & Run (Windows)

1. Download `Noria.exe` from the assets below.
2. Place it in a folder **alongside the repo files** (or clone the repo and use `dist/Noria.exe`).
3. Double-click `Noria.exe` — it auto-installs Python & Node dependencies, then opens the Control Center as a standalone app.

---

##  Features

### Core Engine
- Event-driven pipeline orchestrator (`src/core/pipeline.js`)
- Functional domain registry with interface validation (`src/core/registry.js`)
- Decoupled global event broker (`src/queue/`)
- URL deduplication cache with profile-level and device-level clearing

### Domains
- **Scholarships** pipeline — AI prompt, scoring schema, and WhatsApp notification template
- **Jobs** pipeline — AI prompt, scoring schema, and WhatsApp notification template

### Infrastructure
- **Scrapers**: Jina Reader API, Puppeteer headless browser, resilient native fetch
- **LLM**: Gemini adapter with structured generation, fallback model chain, exact 429 delay extraction
- **Messaging**: WhatsApp listener (session-persistent) + stateless WhatsApp sender

### Control Center UI
- Profile management (create, edit, delete applicant profiles)
- Real-time scan monitoring and logs
- QR code display for WhatsApp device linking
- API key configuration with guided helper links
- Premium dark theme with WhatsApp green highlights

---

##  Technical Changes (since pre-release)

- Rewrote `scripts/launcher.cs` to resolve paths relative to the executable's own directory — eliminates `run_noria.bat was not found` error
- Launcher now invokes `python -m streamlit run` directly, removing bat-file dependency entirely
- Launcher opens UI in Chrome/Edge `--app` mode as a standalone window; falls back to default browser if neither is found
- Fixed CSS selectors in `ui/styles.py` using direct child selectors (`> div`) to eliminate stray borders on password eye toggle and dropdown elements
- Unified background color for all form inputs, textareas, and selectboxes

---

##  Requirements

| Requirement | Version |
|:---|:---|
| Windows | 10 / 11 (for exe launcher) |
| Python | >= 3.9 |
| Node.js | >= 22.12.0 |
| NPM | >= 10.0.0 |
| Chrome or Edge | Any modern version (for app-mode window) |

---

##  Configuration

Copy `.env.example` to `.env`. The minimum required keys are:

```env
# Pick one or both LLM providers
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key

# WhatsApp number for opportunity alerts
NOTIFICATION_TARGET=+923001234567

# Which pipelines to run
ACTIVE_PIPELINES=scholarships,jobs
```

**Optional — Multi-LLM fallback chain** (overrides the single keys above):
```env
LLM_CHAIN=[{"provider":"gemini","apiKey":"key1","model":"Auto"},{"provider":"groq","apiKey":"key2","model":"Auto"}]
```

> **Note:** Applicant profiles (name, nationality, degree, fields of study, etc.) are configured visually inside the **Control Center UI** — not in `.env`. The env file only holds infrastructure keys and pipeline settings.

---

##  Documentation

- [README](../README.md) — Setup and quickstart guide
- [ARCHITECTURE.md](ARCHITECTURE.md) — Hexagonal design patterns and system boundaries
- [CHANGELOG.md](CHANGELOG.md) — Full history of changes
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute

---

##  Credits

Designed and engineered by [Ahmad Hassan (B-Ted)](https://github.com/AhmadHassan-BTed).

---

*Noria is private, on-device, and always running for you.*
