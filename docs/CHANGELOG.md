# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-05  ← **First Stable Public Release**

### Added
- Standalone Windows Executable (`Noria.exe`) — resolves all paths from the exe's own directory, eliminating path-not-found errors when double-clicked
- Control Center opens as a **dedicated app window** (Chrome/Edge `--app` mode) instead of a browser tab, providing a native desktop feel
- Streamlit launched directly via `python -m streamlit run` — no bat file dependency at runtime
- Automatic dependency installation (pip + npm) on first launch from the exe
- Unified dark UI — all input fields, textareas, dropdowns, and password fields use consistent dark backgrounds with clean single borders
- Direct-child CSS selectors (`> div`) in `ui/styles.py` to prevent styling artifacts on eye-toggle and dropdown icon elements
- Guided API key helper banners in the profile form with links to Gemini, Groq, and Jina Reader consoles
- `Connect Local Agent` section on landing page for linking the local scanning engine
- Release notes document (`docs/RELEASE_NOTES_v1.0.0.md`)

### Fixed
- `[ERROR] run_noria.bat was not found` — launcher now resolves bat and app paths relative to the exe location
- Double border on password field eye-toggle icon caused by overriding the inner `div` background
- Grey/black mixed input field backgrounds caused by wide CSS selectors affecting BaseWeb sub-elements
- Dropdown selects appearing grey while other fields were dark

### Changed
- Version badge updated to `v1.0.0` in README
- README launcher section rewritten to clearly distinguish standalone exe vs developer bat launcher
- `ARCHITECTURE.md` now includes a Control Center UI & Standalone Launcher section documenting path resolution strategy and app-mode window design

---

## [2.1.0] - 2026-06-03


### Added
- Created a live Control Center Dashboard using Streamlit (`app.py`) for management and evaluation execution
- Styled dashboard with a premium WhatsApp dark-theme aesthetic using HSL-tailored slate-charcoal backdrops and WhatsApp green highlights
- Implemented collapsible phone applicant cards with multi-level shaded styling and warnings/logs toggling
- Optimized layout and visibility in light/dark system themes to prevent element invisibility or settings icon artifacts
- Formulated professional typography hierarchy using Outfit and Inter font families

### Refactored
- Implemented Clean Hexagonal Architecture separating infrastructure from business rules
- Extracted pure domain modules (`src/domains/`) containing stateless prompt builders and notification layout templates
- Converted technical drivers into stateless adapters (`src/infrastructure/`) for Gemini, Scrapers, and WhatsApp Sender
- Redesigned core registry (`src/core/registry.js`) from class-prototype matching to function-based and adapter-interface validation
- Rewrote the core orchestrator (`src/core/pipeline.js`) to sequential data-coupling logic
- Re-routed all test suites to verify new paths and stateless logic
- Removed legacy coupled code, OOP base classes, and outdated providers/plugins directories

## [2.0.0] - 2026-06-01

### Added
- Complete architectural redesign for production-grade quality
- Plugin system for extensible components
- Provider pattern for multiple opportunity types (scholarships, jobs, internships)
- Fully decoupled architecture with zero coupling
- Configuration-driven pipeline system (YAML)
- Professional CI/CD setup (GitHub Actions)
- Comprehensive test suite (unit + integration)
- Docker support (Dockerfile + docker-compose)
- Structured logging system
- Security hardening and validation
- Professional documentation (architecture, deployment, contributing guides)
- Environment-based configuration management
- Pre-commit hooks (Husky + lint-staged)

### Changed
- Migrated from monolithic v1 to modular v2 architecture
- Consolidated duplicated code and files
- Reorganized folder structure for clarity
- Updated all dependencies to latest versions
- Improved type safety throughout codebase
- Enhanced error handling and validation

### Removed
- Deleted v1 monolithic code
- Removed duplicate files and folders
- Removed empty/unused files
- Removed hardcoded values

### Fixed
- Fixed configuration duplication issues
- Fixed import/export consistency
- Fixed event system unification

## [1.0.0] - 2026-05-15

### Added
- Initial release (monolithic version)
- Event-driven scholarship evaluation pipeline
- WhatsApp integration
- Gemini AI analysis
- Puppeteer-based content scraping
- Jina AI fallback for scraping
- Retry logic with exponential backoff
- URL deduplication cache
- Dead-letter queue for failed items
- Metrics collection

---

## Version Policy

- **Latest**: 2.x (production-ready, fully supported)
- **Maintenance**: 1.x (no longer supported)

## Upgrade Guide

### From v1 to v2

v2 is a complete rewrite with a new architecture. Migration guide:

1. Update environment variables (see `.env.example`)
2. Update pipeline configurations (new YAML format)
3. Refactor custom plugins to extend new base classes
4. Test thoroughly before production deployment

See [docs/migration.md](docs/migration.md) for detailed instructions.

## Release Schedule

- **Minor releases**: Approximately every 2-4 weeks
- **Patch releases**: As needed for bug fixes and security updates
- **Major releases**: Annually or when major architectural changes occur

## Support

- **Active support**: Current release (2.x)
- **Security fixes**: Current + 1 previous major version
- **Bug fixes**: Current release only

