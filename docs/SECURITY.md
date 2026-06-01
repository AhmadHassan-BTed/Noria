# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x     | ✅ Yes             |
| 1.x     | ❌ No              |

## Reporting Security Vulnerabilities

**Do NOT open public GitHub issues for security vulnerabilities.**

Please report security vulnerabilities responsibly:

1. Email: [maintainer-email@example.com](mailto:maintainer-email@example.com)
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. Allow 90 days for review and fix before public disclosure

## Security Best Practices

### For Users

1. **Keep dependencies updated**: Run `npm update` regularly
2. **Never commit `.env` files**: Use `.env.example` for templates
3. **Rotate API keys** if compromised
4. **Use strong passwords** for WhatsApp accounts
5. **Monitor logs** for suspicious activity

### For Developers

1. **Never log sensitive data** (API keys, tokens, etc)
2. **Validate all user inputs**
3. **Sanitize error messages** (don't leak internal details)
4. **Use environment variables** for configuration
5. **Keep dependencies current**

## Security Checklist

Before each release:

- [ ] Update dependencies (`npm audit`)
- [ ] Run security tests
- [ ] Review error handling
- [ ] Verify no secrets in code
- [ ] Update CHANGELOG
- [ ] Test with new Node.js LTS

## Vulnerability Response Process

1. **Report received** → Confirm within 48 hours
2. **Investigation** → Understand scope and impact
3. **Fix development** → Create patch in private branch
4. **Review** → Internal security review
5. **Release** → Publish security update
6. **Disclosure** → Public announcement with details

## Known Limitations

- WhatsApp session stored in `.wwebjs_auth/` (keep secure)
- API keys required for Gemini and Jina (validate access)
- Puppeteer runs browser (ensure safe deployment)
- URL validation uses regex (not foolproof)

## Contact

Security issues: [maintainer-email@example.com]
General inquiries: See SUPPORT.md

---

Thank you for helping keep Noria secure! 🔒
