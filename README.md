# package-outdated-why

**`npm outdated` shows 50 packages. Which ones MATTER?**

The only tool that combines **outdated packages** + **security vulnerabilities** + **breaking change context** + **dependency freshness** into one prioritized view.

[![npm version](https://img.shields.io/npm/v/package-outdated-why.svg)](https://www.npmjs.com/package/package-outdated-why)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## What's New in v0.2.0

- **Libyear Metrics** - Track how "stale" your dependencies are (inspired by [libyear.com](https://libyear.com))
- **Unused Detection** - Find dependencies you're not actually using
- **Health Check** - Identify deprecated and unmaintained packages
- **Full Analysis** - Run all checks at once with `full` command

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
- How old are my dependencies? 📅
- Am I using all of them? 🔍

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
│   Freshness Score: 72/100               │
╰─────────────────────────────────────────╯

📊 Summary:
   Total outdated: 50
   🔴 Critical: 2  🟡 Important: 8  🟢 Safe: 35  ⏭️ Skip: 5

📅 Dependency Freshness:
   Total drift: 3.2 libyears
   Most outdated: lodash (1.5 years)

🔴 CRITICAL - Update immediately:
   • lodash: 4.17.20 → 4.17.21 [EASY]
     Security vulnerability (high): Prototype Pollution
     ⚠️  [HIGH] CVE-2021-23337

🟡 IMPORTANT - Review before updating:
   • react: 17.0.2 → 18.2.0 [MEDIUM]
     Major update: Concurrent rendering, automatic batching
     📚 Migration guide: https://react.dev/blog/2022/03/29/react-v18
```

---

## Why This Tool?

| Tool | Outdated | Security | Breaking Changes | Libyear | Unused | Health |
|------|----------|----------|------------------|---------|--------|--------|
| `npm outdated` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `npm audit` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `npm-check-updates` | ✅ | ❌ | Color only | ❌ | ❌ | ❌ |
| `npm-check` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `libyear` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `depcheck` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **package-outdated-why** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**We're the only tool that combines everything into one command.**

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

### `libyear`

Measure dependency freshness:

```bash
npx package-outdated-why libyear
```

```
📅 Dependency Freshness (Libyear Metrics)

   Total drift: 3.2 libyears
   Average age: 0.15 years per dependency
   Most outdated: lodash (1.5 years)

   📊 Version breakdown:
      Major: 5 behind
      Minor: 12 behind
      Patch: 8 behind

   Freshness Score: 72/100
```

### `unused`

Find unused dependencies:

```bash
npx package-outdated-why unused
```

```
🔍 Dependency Analysis

   ⚠️  Potentially unused (3):
      • lodash
      • moment
      • underscore

   📦 Dev packages in dependencies:
      • @types/node → move to devDependencies
```

### `health`

Check package health:

```bash
npx package-outdated-why health
```

```
🏥 Package Health Check

   ⛔ Deprecated packages (1):
      • request - find alternative!

   😴 Unmaintained (2+ years) (2):
      • moment
      • node-uuid

   ✅ 45 packages are healthy!
```

### `full`

Run all checks at once:

```bash
npx package-outdated-why full

# Save comprehensive report
npx package-outdated-why full -o full-report.md
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

### `why <package>`

Deep dive into a specific package:

```bash
npx package-outdated-why why react
```

---

## Programmatic Usage

```typescript
import {
  analyzePackages,
  calculateLibyearMetrics,
  detectUnused,
  getHealthSummary
} from 'package-outdated-why';

// Full analysis
const result = analyzePackages();
console.log(`Security Score: ${result.securityScore}/100`);
console.log(`Critical: ${result.critical.length}`);

// Libyear metrics
const libyear = calculateLibyearMetrics(outdated);
console.log(`Total drift: ${libyear.totalLibyears} libyears`);
console.log(`Freshness: ${libyear.freshnessScore}/100`);

// Unused detection
const unused = detectUnused();
console.log(`Unused: ${unused.unused.join(', ')}`);

// Health check
const health = getHealthSummary(packageNames);
console.log(`Deprecated: ${health.deprecated.join(', ')}`);
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Check dependencies
  run: npx package-outdated-why --ci

- name: Generate full report
  run: npx package-outdated-why full -o deps-report.md

- name: Upload report
  uses: actions/upload-artifact@v3
  with:
    name: dependency-report
    path: deps-report.md
```

---

## How It Works

### 🔴 Critical (Update Immediately)
**Security vulnerabilities** from `npm audit`

### 🟡 Important (Review First)
**Breaking changes** with migration guides for 40+ packages

### 🟢 Safe (Update Anytime)
**Backward-compatible** patch/minor updates

### ⏭️ Skip (Low Priority)
**Dev dependencies** with low risk

### 📅 Libyear Metrics
- **Total drift**: Sum of years each package is behind
- **Freshness Score**: 0-100 (100 = all current)
- **Pulse**: Days since latest update available

---

## Changelog

### v0.2.0
- Added `libyear` command for dependency freshness metrics
- Added `unused` command to detect unused dependencies
- Added `health` command to check for deprecated/unmaintained packages
- Added `full` command to run all analyses
- Added freshness score to summary
- Improved TypeScript types and exports

### v0.1.0
- Initial release
- Outdated package analysis
- Security vulnerability detection
- Breaking change context with migration guides
- Effort estimation

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

---

## Support This Tool ☕

**100% free and open source.**

If it saved you time, consider:

💚 **[Buy Me a Coffee](https://buymeacoffee.com/willzhangfly)**

---

## License

MIT

---

## Contributing

Contributions welcome! [GitHub](https://github.com/willzhangfly/package-outdated-why)

**PRs especially welcome for:**
- Adding migration guides for more packages
- Improving effort estimates
- Better security advisory detection
- Unused detection improvements

---

**Stop guessing. Know which updates actually matter.**
