import * as semver from 'semver';
import { OutdatedPackage, BreakingChangeInfo } from './types';

export interface SemverAnalysis {
  majorUpdate: boolean;
  minorUpdate: boolean;
  patchUpdate: boolean;
  currentMajor: number;
  latestMajor: number;
  versionJump: string;
}

export function analyzeSemver(pkg: OutdatedPackage): SemverAnalysis {
  const current = semver.coerce(pkg.current);
  const latest = semver.coerce(pkg.latest);

  if (!current || !latest) {
    return {
      majorUpdate: false,
      minorUpdate: false,
      patchUpdate: true,
      currentMajor: 0,
      latestMajor: 0,
      versionJump: 'unknown',
    };
  }

  const majorUpdate = semver.major(latest) > semver.major(current);
  const minorUpdate =
    !majorUpdate && semver.minor(latest) > semver.minor(current);
  const patchUpdate = !majorUpdate && !minorUpdate;

  return {
    majorUpdate,
    minorUpdate,
    patchUpdate,
    currentMajor: semver.major(current),
    latestMajor: semver.major(latest),
    versionJump: `${pkg.current} → ${pkg.latest}`,
  };
}

// Comprehensive breaking change database with effort estimates
interface BreakingChangeEntry {
  url: string;
  summary: string;
  effort: 'low' | 'medium' | 'high';
  knownIssues?: string[];
}

const BREAKING_CHANGES_DB: Record<string, Record<number, BreakingChangeEntry>> = {
  // Frontend frameworks
  react: {
    18: {
      url: 'https://react.dev/blog/2022/03/29/react-v18',
      summary: 'Concurrent rendering, automatic batching, new hooks',
      effort: 'medium',
      knownIssues: ['StrictMode double-renders', 'Suspense changes'],
    },
    19: {
      url: 'https://react.dev/blog/2024/04/25/react-19',
      summary: 'Actions, use() hook, ref as prop, async transitions',
      effort: 'medium',
      knownIssues: ['forwardRef deprecated', 'Context.Provider changes'],
    },
  },
  'react-dom': {
    18: {
      url: 'https://react.dev/blog/2022/03/29/react-v18',
      summary: 'createRoot API, hydrateRoot, concurrent features',
      effort: 'low',
      knownIssues: ['ReactDOM.render deprecated'],
    },
    19: {
      url: 'https://react.dev/blog/2024/04/25/react-19',
      summary: 'New hydration APIs, form actions',
      effort: 'low',
    },
  },
  next: {
    13: {
      url: 'https://nextjs.org/blog/next-13',
      summary: 'App Router, Server Components, Turbopack',
      effort: 'high',
      knownIssues: ['Pages Router still supported', 'New file conventions'],
    },
    14: {
      url: 'https://nextjs.org/blog/next-14',
      summary: 'Server Actions stable, partial prerendering',
      effort: 'low',
      knownIssues: ['Minimum Node.js 18 required'],
    },
    15: {
      url: 'https://nextjs.org/blog/next-15',
      summary: 'Async request APIs, caching changes',
      effort: 'medium',
      knownIssues: ['fetch caching opt-in by default'],
    },
  },
  vue: {
    3: {
      url: 'https://v3-migration.vuejs.org/',
      summary: 'Composition API, new reactivity system, Teleport',
      effort: 'high',
      knownIssues: ['Options API still works', 'Some plugins need updates'],
    },
  },
  angular: {
    17: {
      url: 'https://blog.angular.io/introducing-angular-v17-4d7c1f6d75a8',
      summary: 'New control flow, deferrable views, signals',
      effort: 'medium',
    },
    18: {
      url: 'https://blog.angular.io/angular-v18-is-now-available-e79d5fb1c4b8',
      summary: 'Zoneless change detection, Material 3',
      effort: 'medium',
    },
  },
  svelte: {
    5: {
      url: 'https://svelte.dev/blog/svelte-5-release-candidate',
      summary: 'Runes, fine-grained reactivity, snippets',
      effort: 'high',
      knownIssues: ['$: reactive statements deprecated'],
    },
  },

  // Build tools
  typescript: {
    5: {
      url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/',
      summary: 'Decorators, const type parameters, bundler resolution',
      effort: 'low',
      knownIssues: ['Some deprecated options removed'],
    },
  },
  webpack: {
    5: {
      url: 'https://webpack.js.org/migrate/5/',
      summary: 'Module federation, asset modules, persistent caching',
      effort: 'high',
      knownIssues: ['Node.js polyfills removed', 'Config changes needed'],
    },
  },
  vite: {
    5: {
      url: 'https://vitejs.dev/guide/migration.html',
      summary: 'Rollup 4, Node.js 18+, CJS deprecation',
      effort: 'low',
    },
    6: {
      url: 'https://vitejs.dev/guide/migration.html',
      summary: 'Environment API, new defaults',
      effort: 'low',
    },
  },
  esbuild: {
    0: {
      url: 'https://esbuild.github.io/',
      summary: 'Pre-1.0 - check changelog for breaking changes',
      effort: 'low',
    },
  },

  // Testing
  eslint: {
    9: {
      url: 'https://eslint.org/docs/latest/use/migrate-to-9.0.0',
      summary: 'Flat config required, Node.js 18+, removed formatters',
      effort: 'high',
      knownIssues: ['eslintrc deprecated', 'Many plugins need updates'],
    },
  },
  jest: {
    29: {
      url: 'https://jestjs.io/docs/upgrading-to-jest29',
      summary: 'Node.js 14+, snapshotFormat, JSDOM upgrade',
      effort: 'low',
    },
    30: {
      url: 'https://jestjs.io/docs/upgrading-to-jest30',
      summary: 'ESM support improvements, Node.js 18+',
      effort: 'low',
    },
  },
  vitest: {
    1: {
      url: 'https://vitest.dev/guide/migration.html',
      summary: 'Pool options, coverage changes',
      effort: 'low',
    },
    2: {
      url: 'https://vitest.dev/guide/migration.html',
      summary: 'Browser mode changes, new defaults',
      effort: 'low',
    },
  },
  playwright: {
    1: {
      url: 'https://playwright.dev/docs/release-notes',
      summary: 'Check release notes - frequent minor breaking changes',
      effort: 'low',
    },
  },

  // Backend
  express: {
    5: {
      url: 'https://expressjs.com/en/guide/migrating-5.html',
      summary: 'Promise support, removed deprecated methods',
      effort: 'medium',
      knownIssues: ['app.del() removed', 'req.param() removed'],
    },
  },
  fastify: {
    5: {
      url: 'https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/',
      summary: 'Node.js 20+, async/await improvements',
      effort: 'low',
    },
  },
  'hono': {
    4: {
      url: 'https://hono.dev/',
      summary: 'Check changelog for breaking changes',
      effort: 'low',
    },
  },

  // Database
  mongoose: {
    7: {
      url: 'https://mongoosejs.com/docs/migrating_to_7.html',
      summary: 'Strict query, removed callbacks, Node.js 14+',
      effort: 'medium',
      knownIssues: ['Callbacks removed - use async/await'],
    },
    8: {
      url: 'https://mongoosejs.com/docs/migrating_to_8.html',
      summary: 'Node.js 16+, removed deprecated methods',
      effort: 'low',
    },
  },
  prisma: {
    5: {
      url: 'https://www.prisma.io/docs/guides/upgrade-guides/upgrading-to-prisma-5',
      summary: 'JSON protocol, improved query engine',
      effort: 'low',
    },
    6: {
      url: 'https://www.prisma.io/docs/guides/upgrade-guides/upgrading-to-prisma-6',
      summary: 'Check migration guide',
      effort: 'low',
    },
  },
  sequelize: {
    7: {
      url: 'https://sequelize.org/docs/v7/other-topics/upgrade/',
      summary: 'TypeScript rewrite, new query interface',
      effort: 'high',
    },
  },
  typeorm: {
    0: {
      url: 'https://typeorm.io/',
      summary: 'Pre-1.0 - check changelog',
      effort: 'medium',
    },
  },
  drizzle: {
    0: {
      url: 'https://orm.drizzle.team/',
      summary: 'Pre-1.0 - API may change',
      effort: 'low',
    },
  },

  // UI Libraries
  tailwindcss: {
    3: {
      url: 'https://tailwindcss.com/docs/upgrade-guide',
      summary: 'JIT by default, new color palette, aspect-ratio',
      effort: 'low',
    },
    4: {
      url: 'https://tailwindcss.com/docs/upgrade-guide',
      summary: 'New engine, CSS-first config, @theme directive',
      effort: 'medium',
      knownIssues: ['tailwind.config.js format changed'],
    },
  },
  '@mui/material': {
    6: {
      url: 'https://mui.com/material-ui/migration/upgrade-to-v6/',
      summary: 'Pigment CSS, improved theming',
      effort: 'medium',
    },
  },
  'chakra-ui': {
    3: {
      url: 'https://www.chakra-ui.com/docs/get-started/migration',
      summary: 'Check migration guide',
      effort: 'medium',
    },
  },
  '@radix-ui/react-*': {
    1: {
      url: 'https://www.radix-ui.com/',
      summary: 'Check individual component changelogs',
      effort: 'low',
    },
  },

  // State management
  zustand: {
    5: {
      url: 'https://github.com/pmndrs/zustand/releases',
      summary: 'Check release notes',
      effort: 'low',
    },
  },
  redux: {
    5: {
      url: 'https://redux.js.org/introduction/why-rtk-is-redux-today',
      summary: 'Use Redux Toolkit instead',
      effort: 'low',
    },
  },
  'react-query': {
    5: {
      url: 'https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5',
      summary: 'Renamed to @tanstack/react-query, API simplification',
      effort: 'medium',
    },
  },
  '@tanstack/react-query': {
    5: {
      url: 'https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5',
      summary: 'Simplified APIs, removed callbacks',
      effort: 'low',
    },
  },

  // Utilities
  axios: {
    1: {
      url: 'https://github.com/axios/axios/blob/v1.x/CHANGELOG.md',
      summary: 'Removed deprecated methods, improved types',
      effort: 'low',
    },
  },
  lodash: {
    5: {
      url: 'https://lodash.com/',
      summary: 'ESM-first, tree-shakeable',
      effort: 'low',
    },
  },
  dayjs: {
    2: {
      url: 'https://day.js.org/',
      summary: 'Check release notes',
      effort: 'low',
    },
  },
  'date-fns': {
    3: {
      url: 'https://date-fns.org/',
      summary: 'String date parsing removed, new defaults',
      effort: 'low',
    },
    4: {
      url: 'https://date-fns.org/',
      summary: 'Check migration guide',
      effort: 'low',
    },
  },
  zod: {
    4: {
      url: 'https://zod.dev/',
      summary: 'Check release notes',
      effort: 'low',
    },
  },

  // Node.js
  node: {
    18: {
      url: 'https://nodejs.org/en/blog/announcements/v18-release-announce',
      summary: 'Fetch API, test runner, watch mode',
      effort: 'low',
    },
    20: {
      url: 'https://nodejs.org/en/blog/announcements/v20-release-announce',
      summary: 'Permission model, stable test runner',
      effort: 'low',
    },
    22: {
      url: 'https://nodejs.org/en/blog/announcements/v22-release-announce',
      summary: 'require(esm), WebSocket client',
      effort: 'low',
    },
  },
};

export function getBreakingChangeUrl(
  pkgName: string,
  targetMajor: number
): string | undefined {
  return BREAKING_CHANGES_DB[pkgName]?.[targetMajor]?.url;
}

export function getBreakingChangeInfo(
  pkgName: string,
  currentMajor: number,
  latestMajor: number
): BreakingChangeInfo | undefined {
  if (currentMajor >= latestMajor) return undefined;

  const entry = BREAKING_CHANGES_DB[pkgName]?.[latestMajor];
  if (!entry) return undefined;

  return {
    fromVersion: currentMajor,
    toVersion: latestMajor,
    migrationUrl: entry.url,
    summary: entry.summary,
    effort: entry.effort,
    knownIssues: entry.knownIssues,
  };
}

export function hasKnownBreakingChanges(
  pkgName: string,
  currentMajor: number,
  latestMajor: number
): boolean {
  if (currentMajor >= latestMajor) return false;

  const pkgBreakingChanges = BREAKING_CHANGES_DB[pkgName];
  if (!pkgBreakingChanges) return false;

  // Check if any version between current and latest has known breaking changes
  for (let v = currentMajor + 1; v <= latestMajor; v++) {
    if (pkgBreakingChanges[v]) return true;
  }

  return false;
}

export function estimateUpdateEffort(
  pkgName: string,
  currentMajor: number,
  latestMajor: number
): 'low' | 'medium' | 'high' {
  const entry = BREAKING_CHANGES_DB[pkgName]?.[latestMajor];
  if (entry) return entry.effort;

  // Default estimates based on package type
  if (pkgName.includes('eslint') || pkgName.includes('webpack')) return 'high';
  if (pkgName.includes('react') || pkgName.includes('vue') || pkgName.includes('angular')) return 'medium';

  // Major version jumps of 2+ are likely harder
  if (latestMajor - currentMajor >= 2) return 'medium';

  return 'low';
}
