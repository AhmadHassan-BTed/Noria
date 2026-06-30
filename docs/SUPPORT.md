# Support

Thank you for using Noria! This document explains how to get help.

## Getting Help

### Documentation

Start here:
- [README.md](README.md) — Project overview and quick start
- [docs/](docs/) — Detailed documentation
- [CONTRIBUTING.md](CONTRIBUTING.md) — Development guide
- [Troubleshooting](README.md#troubleshooting) — Common issues

### GitHub

- **Issues**: [Report bugs](https://github.com/AhmadHassan-BTed/noria/issues/new?template=bug_report.md)
- **Discussions**: [Ask questions](https://github.com/AhmadHassan-BTed/noria/discussions)
- **Security**: See [SECURITY.md](SECURITY.md)

### Discussions

Discuss on [GitHub Discussions](https://github.com/AhmadHassan-BTed/noria/discussions):

- **Ideas** — Feature requests and suggestions
- **Q&A** — Ask questions and get help
- **Show & Tell** — Share your projects using Noria
- **General** — Off-topic conversations

### Stack Overflow

Tag questions with `noria` for community visibility.

## Common Questions

**Q: How do I change which opportunities are tracked?**
A: Edit your `.env` file and change `APPLICANT_TARGET_FIELDS`.

**Q: Can I run multiple pipelines?**
A: Yes! Set `ACTIVE_PIPELINES=scholarships,jobs` in `.env`.

**Q: How do I add a custom provider?**
A: See [docs/contributing.md](CONTRIBUTING.md) and create a provider in `src/providers/`.

**Q: What if I don't have a Jina API key?**
A: It's optional. Noria will use Puppeteer fallback (slower but works).

**Q: How often does Noria check for opportunities?**
A: It listens continuously. When you send a WhatsApp message with a URL, it processes immediately.

## Troubleshooting

### WhatsApp QR Code Won't Scan

```bash
# Delete auth session and restart
rm -rf .wwebjs_auth/
npm start
```

### "GEMINI_API_KEY not set" Error

```bash
# Ensure .env exists with your API key
cat .env | grep GEMINI_API_KEY

# If not set:
echo "GEMINI_API_KEY=your_key_here" >> .env
```

### Content Not Being Extracted

- Jina might be blocked → Puppeteer fallback should trigger
- Puppeteer crash → Check logs for details
- URL might be invalid → Ensure valid HTTP/HTTPS URL

### No Matches Being Found

- Criteria too strict → Adjust `APPLICANT_TARGET_FIELDS`
- URL not relevant → Noria correctly rejected it
- AI not matching → Review scores in logs

## Reporting Bugs

### When Reporting

Include:
- **Environment**: Node.js version, OS, Noria version
- **Steps to reproduce**: Exact steps to trigger the bug
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happened
- **Logs**: Relevant error messages and logs

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what's broken.

**To Reproduce**
Steps to reproduce:
1. ...
2. ...
3. ...

**Expected behavior**
What should happen.

**Actual behavior**
What actually happened.

**Environment**
- Node.js: v18.x.x
- Noria: v2.x.x
- OS: macOS/Linux/Windows

**Logs**
[Relevant error messages]

**Additional context**
Any other info that might help.
```

## Feature Requests

Suggest improvements on [GitHub Discussions](https://github.com/AhmadHassan-BTed/noria/discussions):

- **Description**: What's the feature?
- **Problem**: What problem does it solve?
- **Benefit**: Why is it important?
- **Use case**: How would you use it?

## Contact

For security issues: See [SECURITY.md](SECURITY.md)

For other inquiries:
- **Email**: [maintainer email]
- **Twitter**: [@AhmadHassan_BTed](https://twitter.com/AhmadHassan_BTed)
- **GitHub**: [@AhmadHassan-BTed](https://github.com/AhmadHassan-BTed)

## Maintainer Response Times

- **Critical security issues**: 24 hours
- **Bugs**: 48-72 hours
- **Feature requests**: 1 week
- **Discussions**: Best effort

## Community Code of Conduct

Please see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

Thank you for being part of the Noria community! 
