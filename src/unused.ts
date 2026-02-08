/**
 * Unused dependency detection
 * Finds packages in package.json that aren't imported anywhere
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface UnusedResult {
  unused: string[];           // Dependencies not imported anywhere
  missing: string[];          // Imported but not in package.json
  devInDeps: string[];        // Dev packages in dependencies
  depsInDev: string[];        // Prod packages in devDependencies
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

// Packages that are used implicitly (configs, plugins, etc)
const IMPLICIT_PACKAGES = new Set([
  // Build tools
  'typescript', 'ts-node', 'tsx', 'esbuild', 'webpack', 'vite', 'rollup', 'parcel',
  // Linting
  'eslint', 'prettier', 'stylelint', 'husky', 'lint-staged',
  // Testing
  'jest', 'vitest', 'mocha', 'chai', 'nyc', 'c8', 'playwright', 'cypress',
  // Types
  '@types/node', '@types/jest', '@types/mocha', '@types/react', '@types/express',
  // Babel
  '@babel/core', '@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript',
  // PostCSS
  'postcss', 'autoprefixer', 'tailwindcss',
  // Misc
  'dotenv', 'cross-env', 'concurrently', 'nodemon', 'pm2',
]);

// Patterns that indicate a package is used implicitly
const IMPLICIT_PATTERNS = [
  /^@types\//,
  /^eslint-plugin-/,
  /^eslint-config-/,
  /^@eslint\//,
  /^prettier-plugin-/,
  /^babel-plugin-/,
  /^@babel\/plugin-/,
  /^postcss-/,
  /^@vitejs\//,
  /^vite-plugin-/,
  /^webpack-/,
  /^@swc\//,
];

function isImplicitPackage(name: string): boolean {
  if (IMPLICIT_PACKAGES.has(name)) return true;
  return IMPLICIT_PATTERNS.some(pattern => pattern.test(name));
}

/**
 * Get all source files in the project
 */
function getSourceFiles(dir: string, extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']): string[] {
  const files: string[] = [];
  const ignore = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt'];

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!ignore.includes(entry.name) && !entry.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  walk(dir);
  return files;
}

/**
 * Extract package names from import/require statements
 */
function extractImports(content: string): Set<string> {
  const imports = new Set<string>();

  // Match various import patterns
  const patterns = [
    // ES imports: import x from 'pkg', import 'pkg', import { x } from 'pkg'
    /import\s+(?:[\w\s{},*]+\s+from\s+)?['"]([^'"./][^'"]*)['"]/g,
    // Require: require('pkg'), require("pkg")
    /require\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
    // Dynamic import: import('pkg')
    /import\s*\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let pkg = match[1];
      // Handle scoped packages: @scope/pkg -> @scope/pkg
      // Handle subpaths: pkg/subpath -> pkg
      if (pkg.startsWith('@')) {
        const parts = pkg.split('/');
        pkg = parts.slice(0, 2).join('/');
      } else {
        pkg = pkg.split('/')[0];
      }
      imports.add(pkg);
    }
  }

  return imports;
}

/**
 * Detect unused dependencies
 */
export function detectUnused(cwd = process.cwd()): UnusedResult {
  const pkgPath = path.join(cwd, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    return { unused: [], missing: [], devInDeps: [], depsInDev: [] };
  }

  const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const dependencies = Object.keys(pkg.dependencies || {});
  const devDependencies = Object.keys(pkg.devDependencies || {});
  const allDeps = new Set([...dependencies, ...devDependencies]);

  // Get all imports from source files
  const sourceFiles = getSourceFiles(cwd);
  const usedPackages = new Set<string>();

  for (const file of sourceFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const imports = extractImports(content);
      imports.forEach(pkg => usedPackages.add(pkg));
    } catch {
      // Ignore read errors
    }
  }

  // Find unused dependencies
  const unused: string[] = [];
  for (const dep of dependencies) {
    if (!usedPackages.has(dep) && !isImplicitPackage(dep)) {
      unused.push(dep);
    }
  }

  // Find missing dependencies (imported but not declared)
  const missing: string[] = [];
  for (const pkg of usedPackages) {
    if (!allDeps.has(pkg) && !pkg.startsWith('.') && !isBuiltin(pkg)) {
      missing.push(pkg);
    }
  }

  // Find dev packages incorrectly in dependencies
  const devInDeps: string[] = [];
  const devPatterns = [/^@types\//, /-loader$/, /^eslint/, /^prettier/, /^jest/, /^vitest/];
  for (const dep of dependencies) {
    if (devPatterns.some(p => p.test(dep))) {
      devInDeps.push(dep);
    }
  }

  // Find prod packages incorrectly in devDependencies
  const depsInDev: string[] = [];
  for (const dep of devDependencies) {
    if (usedPackages.has(dep) && !isImplicitPackage(dep)) {
      // This might be a runtime dependency incorrectly in devDeps
      // Only flag common ones
      const prodPatterns = [/^react$/, /^vue$/, /^express$/, /^next$/, /^nuxt$/];
      if (prodPatterns.some(p => p.test(dep))) {
        depsInDev.push(dep);
      }
    }
  }

  return { unused, missing, devInDeps, depsInDev };
}

/**
 * Check if a module is a Node.js builtin
 */
function isBuiltin(name: string): boolean {
  const builtins = [
    'fs', 'path', 'os', 'crypto', 'http', 'https', 'url', 'util', 'events',
    'stream', 'buffer', 'child_process', 'cluster', 'net', 'dns', 'tls',
    'assert', 'querystring', 'readline', 'repl', 'vm', 'zlib', 'worker_threads',
    'perf_hooks', 'async_hooks', 'string_decoder', 'timers', 'console',
    'module', 'process',
  ];
  return builtins.includes(name) || name.startsWith('node:');
}

/**
 * Format unused detection results
 */
export function formatUnusedResults(result: UnusedResult): string {
  const lines: string[] = [];

  lines.push(`🔍 Dependency Analysis`);
  lines.push(``);

  if (result.unused.length > 0) {
    lines.push(`   ⚠️  Potentially unused (${result.unused.length}):`);
    for (const pkg of result.unused.slice(0, 10)) {
      lines.push(`      • ${pkg}`);
    }
    if (result.unused.length > 10) {
      lines.push(`      ... and ${result.unused.length - 10} more`);
    }
    lines.push(``);
  }

  if (result.missing.length > 0) {
    lines.push(`   ❌ Missing from package.json (${result.missing.length}):`);
    for (const pkg of result.missing.slice(0, 5)) {
      lines.push(`      • ${pkg}`);
    }
    lines.push(``);
  }

  if (result.devInDeps.length > 0) {
    lines.push(`   📦 Dev packages in dependencies:`);
    for (const pkg of result.devInDeps) {
      lines.push(`      • ${pkg} → move to devDependencies`);
    }
    lines.push(``);
  }

  if (result.unused.length === 0 && result.missing.length === 0 && result.devInDeps.length === 0) {
    lines.push(`   ✅ All dependencies look good!`);
  }

  return lines.join('\n');
}
