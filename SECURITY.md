<div align="center">

# 🔒 Security Policy

</div>

---

## 🛡 Supported Versions

We actively maintain security fixes for the following versions:

| Version | Supported |
|---|---|
| `1.x` (latest) | ✅ Yes |
| `< 1.0` | ❌ No |

We recommend always running the latest published version.

---

## 🚨 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please report it privately using one of these methods:

1. **GitHub Private Reporting** *(preferred)* — go to the **Security** tab on the repository and click **"Report a vulnerability"**
2. **Email** — contact the maintainers directly via the email address listed on the repository profile

Please include as much of the following as possible:

- A clear description of the vulnerability
- Steps to reproduce the issue (proof-of-concept if possible)
- The potential impact (what could an attacker do?)
- Any suggested mitigations you have in mind

You will receive an acknowledgement within **48 hours** and a more detailed response within **7 days** indicating the next steps. We aim to release a patch within **30 days** of a confirmed vulnerability.

We kindly ask that you give us reasonable time to address the issue before any public disclosure.

---

## 🔐 Security Design

Rune is a **client-side rich text editor** that accepts, renders, and outputs HTML. Here is how we handle the main attack surface:

### HTML Sanitization

All pasted HTML passes through `sanitize()` in `src/utils/html.js` before being inserted into the DOM. This function:

- **Strips all attributes** not on an explicit allowlist (`href`, `src`, `alt`, `class`, `style`, `colspan`, `rowspan`, and Rune-internal `data-*` attrs)
- **Rejects dangerous URL schemes** in `href` and `src`: `javascript:`, `vbscript:`, and `data:text/html` (with whitespace and null-byte stripping to prevent bypass)
- **Strips inline styles** that contain `javascript:` expressions (e.g. `url(javascript:...)`)

### URL Validation

The `setLink` command in `src/core/Editor.js` validates every href before touching the DOM, using the same dangerous-protocol check as the sanitizer.

The `Link` extension (`src/extensions/marks/Link.js`) also validates the URL entered via the prompt before calling `setLink`.

### Content Security

- Rune does **not** use `eval()`, `Function()`, or `innerHTML` on untrusted content without sanitization
- Rune does **not** make network requests except through user-supplied hooks (`uploadImage`)
- The `print()` method uses `document.write()` on a fresh blank window — consider a stricter CSP if this is a concern (a blob URL approach is planned)

### Known Limitations

- `style` attributes are allowed on the allowlist (required for text colour, background, etc.). Style-based injection via `expression(...)` is blocked, but complex CSS injection through allowed `style` values is a known trade-off. We do not execute server-side rendering.
- `document.execCommand()` is used for formatting — it is deprecated but remains the most reliable cross-browser approach for contenteditable. We monitor its status.

---

## 📋 Vulnerability Disclosure History

| Date | Severity | Description | Fixed in |
|---|---|---|---|
| — | — | No public CVEs to date | — |

---

## 🙏 Responsible Disclosure

We appreciate the security research community's efforts to improve the safety of open source software. Researchers who responsibly disclose valid security issues will be acknowledged in the changelog and, where appropriate, in a dedicated security hall of fame.

Thank you for helping keep Rune and its users safe.
