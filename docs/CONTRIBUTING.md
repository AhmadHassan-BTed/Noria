# Contributing to Noria

Thank you for interest in contributing! This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/noria.git`
3. **Create** a feature branch: `git checkout -b feature/your-feature`
4. **Setup** development environment: `npm install`
5. **Make** your changes
6. **Test** your changes: `npm test`
7. **Commit** with conventional commits
8. **Push** and create a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Install pre-commit hooks
npm run prepare

# Start in development mode (with auto-reload)
npm run dev
```

## Code Standards

### Formatting

```bash
# Format code automatically
npm run format

# Check formatting
npm run format:check
```

### Linting

```bash
# Check code quality
npm run lint

# Fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- path/to/test.js
```

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (formatting, missing semicolons, etc)
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to build process, dependencies, etc

**Examples**:
```
feat: add jobs provider
fix: handle network timeout in scraper
docs: update architecture documentation
chore: upgrade Puppeteer to v25
```

## Pull Request Process

1. **Update** documentation for any new features
2. **Add** tests for your changes
3. **Ensure** all tests pass: `npm test`
4. **Ensure** linting passes: `npm run lint`
5. **Write** a clear PR description
6. **Link** any related issues

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update

## Related Issues
Fixes #issue_number

## Testing
How to test these changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

## Architecture & Design

Before making large changes:

1. Read [docs/architecture.md](docs/architecture.md)
2. Open a Discussion or Issue for design feedback
3. Ensure your changes follow existing patterns
4. Don't introduce tight coupling between modules

## Reporting Bugs

### Security Vulnerabilities

Do **not** open public issues. See [SECURITY.md](SECURITY.md).

### Regular Bugs

1. **Check** if issue already exists
2. **Include**:
   - Node.js version (`node --version`)
   - Noria version
   - OS and platform
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Error messages/logs

## Feature Requests

1. **Check** if feature already discussed
2. **Describe** the problem it solves
3. **Explain** expected behavior
4. **Provide** use cases

## Documentation

- **README.md** — Main documentation
- **docs/architecture.md** — System design and rationale
- **docs/deployment.md** — Deployment guides
- **CONTRIBUTING.md** — This file
- **SECURITY.md** — Security policy
- **CHANGELOG.md** — Version history
- **ROADMAP.md** — Future plans

When adding features:
- Update relevant documentation
- Add inline code comments for complex logic
- Include examples in README if user-facing

## Project Structure

```
src/
├── config/       # Configuration system
├── plugins/      # Pluggable components
├── providers/    # Opportunity type providers
├── core/         # Core infrastructure
├── utils/        # Shared utilities
└── middleware/   # Cross-cutting concerns
```

Maintain this structure when adding features.

## Community

- **Discussions**: [GitHub Discussions](https://github.com/AhmadHassan-BTed/noria/discussions)
- **Issues**: [GitHub Issues](https://github.com/AhmadHassan-BTed/noria/issues)
- **Code Review**: All PRs reviewed by maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for making Noria better! 🎉
