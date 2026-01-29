# package-outdated-why

**`npm outdated` shows 50 packages. Which ones MATTER?**

The only tool that combines **outdated packages** + **security vulnerabilities** + **breaking change context** into one prioritized view.

[![npm version](https://img.shields.io/npm/v/package-outdated-why.svg)](https://www.npmjs.com/package/package-outdated-why)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Original Repository:** [WillZhangFly/package-outdated-why](https://github.com/WillZhangFly/package-outdated-why)

---

## The Problem

You run `npm outdated` and get this:

```
Package          Current  Wanted  Latest
lodash           4.17.20  4.17.21 4.17.21
react            17.0.2   17.0.2  18.2.0
axios            1.6.0    1.6.7   1.6.7
eslint           8.56.0   8.57.0  9.0.0
# ... 45 more packages 😱
```

**Now what?**
- Which ones have security issues? 🔒
- Which ones will break my code? 💥
- Which ones are safe to update? ✅
- Where do I even start? 🤷

---

## The Solution

```bash
npx package-outdated-why
```

```
╭─────────────────────────────────────────╮
│   📦 package-outdated-why               │
│   Know which updates actually matter    │
│                                         │
│   Security Score: 65/100                │
╰─────────────────────────────────────────╯

📊 Summary:
   Total outdated: 50
   🔴 Critical: 2  🟡 Important: 8  🟢 Safe: 35  ⏭️ Skip: 5

💡 Recommendation:
   🚨 Fix 2 critical vulnerabilities immediately!
   Estimated effort: ~4 hours

🔴 CRITICAL - Update immediately:
   Security vulnerabilities that need fixing NOW

   • lodash: 4.17.20 → 4.17.21 [EASY]
     Security vulnerability (high): Prototype Pollution
     Why it matters: This package has a known security flaw that attackers
     could exploit. High severity issues can compromise your application security.
     ⚠️  [HIGH] CVE-2021-23337
        → https://github.com/advisories/GHSA-35jh-r3h4-6jhm
     → npm install lodash@latest

🟡 IMPORTANT - Review before updating:
   Breaking changes or security advisories

   • react: 17.0.2 → 18.2.0 [MEDIUM]
     Major update: Concurrent rendering, automatic batching, new hooks
     Why it matters: Version 18 includes breaking changes. Watch out for:
     StrictMode double-renders, Suspense changes.
     📚 Migration guide: https://react.dev/blog/2022/03/29/react-v18
     → npm install react@latest

   • eslint: 8.57.0 → 9.0.0 [HIGH EFFORT]
     Major update: Flat config required, Node.js 18+, removed formatters
     Why it matters: Version 9 includes breaking changes. Watch out for:
     eslintrc deprecated, Many plugins need updates.
     📚 Migration guide: https://eslint.org/docs/latest/use/migrate-to-9.0.0
     → npm install eslint@latest

🟢 SAFE - Update anytime:
   • axios: 1.6.0 → 1.6.7 (Patch update - bug fixes only)
   • chalk: 5.3.0 → 5.4.0 (Minor update - new features)

⏭️ SKIP - Low priority (5 dev deps):
   @types/node, @types/jest, prettier, husky, lint-staged

⚡ Quick Commands:

   # Fix security issues:
   npm audit fix --force

   # Update safe packages:
   npm update
```

---

## Why This Tool?

| Tool | Outdated | Security | Breaking Changes | Migration Guides | Effort Estimate |
|------|----------|----------|------------------|------------------|-----------------|
| `npm outdated` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `npm audit` | ❌ | ✅ | ❌ | ❌ | ❌ |
| `npm-check-updates` | ✅ | ❌ | Color only | ❌ | ❌ |
| `npm-check` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Snyk | ❌ | ✅ | ❌ | ❌ | ❌ |
| **package-outdated-why** | ✅ | ✅ | ✅ | ✅ | ✅ |

**We're the only tool that tells you WHY each update matters.**

---

## Installation

**No installation needed!** Use with `npx`:

```bash
npx package-outdated-why
```

Or install globally:

```bash
npm install -g package-outdated-why
```

---

## Commands

### `analyze` (default)

Full analysis with prioritized updates:

```bash
# Run analysis
npx package-outdated-why

# Save as markdown report
npx package-outdated-why -f markdown -o report.md

# JSON output for CI/CD
npx package-outdated-why -f json

# CI mode - exit 1 if critical vulnerabilities
npx package-outdated-why --ci
```

### `quick`

Just the numbers:

```bash
npx package-outdated-why quick
```

```
📊 Quick Summary:

   Security Score: 65/100

   🔴 Critical: 2
   🟡 Important: 8
   🟢 Safe: 35
   ⏭️ Skip: 5
   Total: 50

   🚨 Fix 2 critical vulnerabilities immediately!
   Effort: ~4 hours
```

### `fix`

Get commands in order of priority:

```bash
npx package-outdated-why fix
```

```
🔧 Fix Commands (in order of priority):

1. Critical security fixes:
   npm install lodash@latest
   npm install minimist@latest

2. Important updates (one at a time):
   npm install react@latest
   # See: https://react.dev/blog/2022/03/29/react-v18

3. Safe updates (batch):
   npm update
```

### `why <package>`

Deep dive into a specific package:

```bash
npx package-outdated-why why react
```

```
📦 react

   Version: 17.0.2 → 18.2.0
   Priority: IMPORTANT
   Type: dependency
   Effort: medium
   Risk Score: 50/100

   Why update?
   Major update: Concurrent rendering, automatic batching, new hooks

   Why it matters:
   Version 18 includes breaking changes. Watch out for:
   StrictMode double-renders, Suspense changes.

   Known issues:
   - StrictMode double-renders
   - Suspense changes

   📚 Migration guide: https://react.dev/blog/2022/03/29/react-v18

   Update: npm install react@latest
```

---

## How It Works

### 🔴 Critical (Update Immediately)

**Security vulnerabilities** from `npm audit`:
- CVE/GHSA advisories
- Known exploits
- Data exposure risks

### 🟡 Important (Review First)

**Breaking changes** with context:
- Major version updates
- Migration guide links for 40+ popular packages
- Known issues to watch for
- Effort estimate (low/medium/high)

### 🟢 Safe (Update Anytime)

**Backward-compatible** changes:
- Minor: New features
- Patch: Bug fixes

### ⏭️ Skip (Low Priority)

**Dev dependencies** with low risk:
- Won't affect production
- Update when convenient

---

## Supported Packages

Migration guides and effort estimates for **40+ popular packages**:

| Category | Packages |
|----------|----------|
| **Frontend** | React, Vue, Angular, Svelte, Next.js |
| **Build** | TypeScript, Webpack, Vite, esbuild |
| **Testing** | ESLint, Jest, Vitest, Playwright |
| **Backend** | Express, Fastify, Hono |
| **Database** | Mongoose, Prisma, Sequelize, TypeORM |
| **UI** | Tailwind CSS, MUI, Chakra UI |
| **State** | Zustand, Redux, TanStack Query |
| **Utils** | Axios, Lodash, date-fns, Zod |

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check dependencies
  run: npx package-outdated-why --ci
```

The `--ci` flag exits with code 1 if critical vulnerabilities are found.

### Generate Report

```yaml
- name: Generate dependency report
  run: npx package-outdated-why -f markdown -o deps-report.md

- name: Upload report
  uses: actions/upload-artifact@v3
  with:
    name: dependency-report
    path: deps-report.md
```

---

## Programmatic Usage

```typescript
import { analyzePackages } from 'package-outdated-why';

const result = analyzePackages();

console.log(`Security Score: ${result.securityScore}/100`);
console.log(`Critical: ${result.critical.length}`);
console.log(`Effort: ${result.summary.estimatedEffort}`);

// Get details on each package
for (const pkg of result.critical) {
  console.log(`${pkg.package.name}: ${pkg.whyItMatters}`);
}
```

---

## Support This Tool ☕

**100% free and open source.**

If it saved you time, consider:

💚 **[Buy Me a Coffee](https://buymeacoffee.com/gooselanding)**

---

## License

MIT

---

## Contributing

Contributions welcome! [GitHub](https://github.com/gooselanding/package-outdated-why)

**PRs especially welcome for:**
- Adding migration guides for more packages
- Improving effort estimates
- Better security advisory detection

---

**Stop guessing. Know which updates actually matter.**
