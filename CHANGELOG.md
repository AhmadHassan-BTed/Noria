# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

