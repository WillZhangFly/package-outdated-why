/**
 * Package health metrics
 * Fetches download counts, last publish, deprecation status
 */

import { execSync } from 'child_process';
import { PackageHealth } from './types';

interface NpmPackageInfo {
  name: string;
  'dist-tags'?: { latest?: string };
  time?: Record<string, string>;
  deprecated?: string;
  repository?: { url?: string };
  types?: string;
  typings?: string;
}

const healthCache = new Map<string, PackageHealth>();

/**
 * Get health metrics for a package
 */
export function getPackageHealth(name: string): PackageHealth {
  if (healthCache.has(name)) {
    return healthCache.get(name)!;
  }

  const health: PackageHealth = {};

  try {
    // Get package info
    const result = execSync(`npm view ${name} --json 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    const info = JSON.parse(result) as NpmPackageInfo;

    // Check for deprecation
    if (info.deprecated) {
      health.isDeprecated = true;
    }

    // Get last publish date
    if (info.time && info['dist-tags']?.latest) {
      const latestVersion = info['dist-tags'].latest;
      if (info.time[latestVersion]) {
        health.lastPublish = new Date(info.time[latestVersion]);

        // Check if unmaintained (no updates in 2+ years)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        health.isUnmaintained = health.lastPublish < twoYearsAgo;
      }
    }

    // Check for TypeScript types
    health.hasTypes = !!(info.types || info.typings);
  } catch {
    // Ignore errors
  }

  // Get weekly downloads
  try {
    const downloads = execSync(
      `npm view ${name} --json 2>/dev/null | grep -o '"weekly":[0-9]*' | grep -o '[0-9]*'`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    if (downloads) {
      health.weeklyDownloads = parseInt(downloads, 10);
    }
  } catch {
    // Try alternative method
    try {
      const result = execSync(
        `curl -s "https://api.npmjs.org/downloads/point/last-week/${name}" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 5000 }
      );
      const data = JSON.parse(result);
      if (data.downloads) {
        health.weeklyDownloads = data.downloads;
      }
    } catch {
      // Ignore
    }
  }

  healthCache.set(name, health);
  return health;
}

/**
 * Format health status for display
 */
export function formatHealthStatus(name: string, health: PackageHealth): string[] {
  const warnings: string[] = [];

  if (health.isDeprecated) {
    warnings.push(`⛔ DEPRECATED - find an alternative`);
  }

  if (health.isUnmaintained) {
    const years = health.lastPublish
      ? Math.floor((Date.now() - health.lastPublish.getTime()) / (365 * 24 * 60 * 60 * 1000))
      : 2;
    warnings.push(`😴 Unmaintained (${years}+ years since last update)`);
  }

  if (health.weeklyDownloads !== undefined && health.weeklyDownloads < 100) {
    warnings.push(`📉 Low usage (${health.weeklyDownloads} weekly downloads)`);
  }

  return warnings;
}

/**
 * Get health summary for multiple packages
 */
export function getHealthSummary(packageNames: string[]): {
  deprecated: string[];
  unmaintained: string[];
  lowUsage: string[];
  healthy: number;
} {
  const deprecated: string[] = [];
  const unmaintained: string[] = [];
  const lowUsage: string[] = [];
  let healthy = 0;

  for (const name of packageNames) {
    const health = getPackageHealth(name);

    if (health.isDeprecated) {
      deprecated.push(name);
    } else if (health.isUnmaintained) {
      unmaintained.push(name);
    } else if (health.weeklyDownloads !== undefined && health.weeklyDownloads < 1000) {
      lowUsage.push(name);
    } else {
      healthy++;
    }
  }

  return { deprecated, unmaintained, lowUsage, healthy };
}

/**
 * Format health summary for display
 */
export function formatHealthSummary(summary: ReturnType<typeof getHealthSummary>): string {
  const lines: string[] = [];

  lines.push(`🏥 Package Health Check`);
  lines.push(``);

  if (summary.deprecated.length > 0) {
    lines.push(`   ⛔ Deprecated packages (${summary.deprecated.length}):`);
    for (const pkg of summary.deprecated) {
      lines.push(`      • ${pkg} - find alternative!`);
    }
    lines.push(``);
  }

  if (summary.unmaintained.length > 0) {
    lines.push(`   😴 Unmaintained (2+ years) (${summary.unmaintained.length}):`);
    for (const pkg of summary.unmaintained.slice(0, 5)) {
      lines.push(`      • ${pkg}`);
    }
    if (summary.unmaintained.length > 5) {
      lines.push(`      ... and ${summary.unmaintained.length - 5} more`);
    }
    lines.push(``);
  }

  if (summary.lowUsage.length > 0) {
    lines.push(`   📉 Low usage packages (${summary.lowUsage.length}):`);
    for (const pkg of summary.lowUsage.slice(0, 5)) {
      lines.push(`      • ${pkg}`);
    }
    lines.push(``);
  }

  if (summary.deprecated.length === 0 && summary.unmaintained.length === 0) {
    lines.push(`   ✅ ${summary.healthy} packages are healthy!`);
  }

  return lines.join('\n');
}
