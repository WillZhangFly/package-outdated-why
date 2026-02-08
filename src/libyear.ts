/**
 * Libyear metrics - measure dependency freshness
 * Inspired by https://libyear.com/
 */

import { execSync } from 'child_process';
import { OutdatedPackage } from './types';

export interface LibyearMetrics {
  totalLibyears: number;           // Total years behind across all deps
  avgLibyears: number;             // Average years behind per dep
  maxLibyears: number;             // Most outdated single dep
  mostOutdated?: string;           // Name of most outdated package
  driftDays: number;               // Total days behind
  pulse: number;                   // Days since latest release (staleness)
  releasesBehind: number;          // Total releases behind
  majorsBehind: number;            // Major versions behind
  minorsBehind: number;            // Minor versions behind
  patchesBehind: number;           // Patches behind
  freshnessScore: number;          // 0-100 score (100 = all up to date)
}

export interface PackageAge {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  currentPublishDate?: Date;
  latestPublishDate?: Date;
  daysOutdated: number;
  yearsOutdated: number;
  releasesBehind: number;
}

interface NpmViewResult {
  time?: Record<string, string>;
  versions?: string[];
}

/**
 * Get publish dates for a package version
 */
function getPackagePublishDate(name: string, version: string): Date | undefined {
  try {
    const result = execSync(`npm view ${name} time --json 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const times = JSON.parse(result) as Record<string, string>;
    if (times[version]) {
      return new Date(times[version]);
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Get all version publish times for a package (cached)
 */
const packageTimeCache = new Map<string, Record<string, string>>();

function getPackageTimes(name: string): Record<string, string> {
  if (packageTimeCache.has(name)) {
    return packageTimeCache.get(name)!;
  }

  try {
    const result = execSync(`npm view ${name} time --json 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    const times = JSON.parse(result) as Record<string, string>;
    packageTimeCache.set(name, times);
    return times;
  } catch {
    return {};
  }
}

/**
 * Count releases between two versions
 */
function countReleasesBetween(name: string, current: string, latest: string): number {
  try {
    const result = execSync(`npm view ${name} versions --json 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const versions = JSON.parse(result) as string[];

    const currentIdx = versions.indexOf(current);
    const latestIdx = versions.indexOf(latest);

    if (currentIdx === -1 || latestIdx === -1) return 0;
    return Math.max(0, latestIdx - currentIdx);
  } catch {
    return 0;
  }
}

/**
 * Calculate age for a single package
 */
export function calculatePackageAge(pkg: OutdatedPackage): PackageAge {
  const times = getPackageTimes(pkg.name);

  const currentPublishDate = times[pkg.current] ? new Date(times[pkg.current]) : undefined;
  const latestPublishDate = times[pkg.latest] ? new Date(times[pkg.latest]) : undefined;

  let daysOutdated = 0;
  if (currentPublishDate && latestPublishDate) {
    daysOutdated = Math.floor(
      (latestPublishDate.getTime() - currentPublishDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const releasesBehind = countReleasesBetween(pkg.name, pkg.current, pkg.latest);

  return {
    packageName: pkg.name,
    currentVersion: pkg.current,
    latestVersion: pkg.latest,
    currentPublishDate,
    latestPublishDate,
    daysOutdated: Math.max(0, daysOutdated),
    yearsOutdated: Math.max(0, daysOutdated / 365),
    releasesBehind,
  };
}

/**
 * Calculate libyear metrics for all outdated packages
 */
export function calculateLibyearMetrics(packages: OutdatedPackage[]): LibyearMetrics {
  if (packages.length === 0) {
    return {
      totalLibyears: 0,
      avgLibyears: 0,
      maxLibyears: 0,
      driftDays: 0,
      pulse: 0,
      releasesBehind: 0,
      majorsBehind: 0,
      minorsBehind: 0,
      patchesBehind: 0,
      freshnessScore: 100,
    };
  }

  const ages = packages.map(calculatePackageAge);

  const totalDays = ages.reduce((sum, a) => sum + a.daysOutdated, 0);
  const totalLibyears = totalDays / 365;
  const maxAge = ages.reduce((max, a) =>
    a.yearsOutdated > max.yearsOutdated ? a : max
  );

  // Count version types behind
  let majorsBehind = 0;
  let minorsBehind = 0;
  let patchesBehind = 0;

  for (const pkg of packages) {
    const [currMajor, currMinor] = pkg.current.split('.').map(Number);
    const [latMajor, latMinor] = pkg.latest.split('.').map(Number);

    if (latMajor > currMajor) majorsBehind++;
    else if (latMinor > currMinor) minorsBehind++;
    else patchesBehind++;
  }

  // Calculate pulse (days since any update was available)
  const latestDates = ages
    .filter(a => a.latestPublishDate)
    .map(a => a.latestPublishDate!.getTime());

  const mostRecentUpdate = latestDates.length > 0
    ? new Date(Math.max(...latestDates))
    : new Date();

  const pulse = Math.floor(
    (Date.now() - mostRecentUpdate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Calculate freshness score (100 = all current, 0 = very outdated)
  // Deduct points based on libyears
  const freshnessScore = Math.max(0, Math.min(100,
    100 - (totalLibyears * 10) - (majorsBehind * 5)
  ));

  return {
    totalLibyears: Math.round(totalLibyears * 100) / 100,
    avgLibyears: Math.round((totalLibyears / packages.length) * 100) / 100,
    maxLibyears: Math.round(maxAge.yearsOutdated * 100) / 100,
    mostOutdated: maxAge.packageName,
    driftDays: totalDays,
    pulse,
    releasesBehind: ages.reduce((sum, a) => sum + a.releasesBehind, 0),
    majorsBehind,
    minorsBehind,
    patchesBehind,
    freshnessScore: Math.round(freshnessScore),
  };
}

/**
 * Get human-readable libyear summary
 */
export function formatLibyearSummary(metrics: LibyearMetrics): string {
  const lines: string[] = [];

  lines.push(`📅 Dependency Freshness (Libyear Metrics)`);
  lines.push(``);
  lines.push(`   Total drift: ${metrics.totalLibyears.toFixed(1)} libyears`);
  lines.push(`   Average age: ${metrics.avgLibyears.toFixed(2)} years per dependency`);

  if (metrics.mostOutdated && metrics.maxLibyears > 0) {
    lines.push(`   Most outdated: ${metrics.mostOutdated} (${metrics.maxLibyears.toFixed(1)} years)`);
  }

  lines.push(``);
  lines.push(`   📊 Version breakdown:`);
  lines.push(`      Major: ${metrics.majorsBehind} behind`);
  lines.push(`      Minor: ${metrics.minorsBehind} behind`);
  lines.push(`      Patch: ${metrics.patchesBehind} behind`);
  lines.push(``);
  lines.push(`   Freshness Score: ${metrics.freshnessScore}/100`);

  return lines.join('\n');
}
