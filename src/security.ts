import { execSync } from 'child_process';
import { SecurityAdvisory } from './types';

interface AuditVulnerability {
  name: string;
  severity: string;
  via: Array<{
    source?: number;
    name?: string;
    title?: string;
    url?: string;
    severity?: string;
    range?: string;
  } | string>;
  effects: string[];
  range: string;
  fixAvailable: boolean | { name: string; version: string };
}

export function getSecurityAdvisories(): Map<string, SecurityAdvisory[]> {
  const advisoriesMap = new Map<string, SecurityAdvisory[]>();

  try {
    const output = execSync('npm audit --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const auditResult = JSON.parse(output);
    processAuditResult(auditResult, advisoriesMap);
  } catch (error: any) {
    // npm audit exits with non-zero when vulnerabilities exist
    if (error.stdout) {
      try {
        const auditResult = JSON.parse(error.stdout);
        processAuditResult(auditResult, advisoriesMap);
      } catch {
        // JSON parse failed, ignore
      }
    }
  }

  return advisoriesMap;
}

function processAuditResult(
  auditResult: any,
  advisoriesMap: Map<string, SecurityAdvisory[]>
): void {
  const vulnerabilities = auditResult.vulnerabilities || {};

  for (const [pkgName, vuln] of Object.entries(vulnerabilities)) {
    const vulnerability = vuln as AuditVulnerability;
    const advisories: SecurityAdvisory[] = [];

    for (const via of vulnerability.via) {
      if (typeof via === 'object' && via.source) {
        advisories.push({
          id: `GHSA-${via.source}`,
          severity: normalizeSeverity(via.severity || vulnerability.severity),
          title: via.title || 'Security vulnerability',
          url: via.url || `https://github.com/advisories/GHSA-${via.source}`,
          vulnerableVersions: via.range || vulnerability.range,
          patchedVersions: getFixedVersion(vulnerability.fixAvailable),
        });
      }
    }

    if (advisories.length > 0) {
      advisoriesMap.set(pkgName, advisories);
    } else if (vulnerability.severity) {
      // Add a generic advisory if we have severity but no specific via
      advisoriesMap.set(pkgName, [
        {
          id: 'unknown',
          severity: normalizeSeverity(vulnerability.severity),
          title: 'Security vulnerability detected',
          url: `https://www.npmjs.com/advisories?search=${pkgName}`,
          vulnerableVersions: vulnerability.range,
          patchedVersions: getFixedVersion(vulnerability.fixAvailable),
        },
      ]);
    }
  }
}

function normalizeSeverity(
  severity: string
): 'critical' | 'high' | 'moderate' | 'low' {
  const s = severity?.toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate' || s === 'medium') return 'moderate';
  return 'low';
}

function getFixedVersion(
  fixAvailable: boolean | { name: string; version: string }
): string {
  if (typeof fixAvailable === 'object' && fixAvailable.version) {
    return fixAvailable.version;
  }
  return 'unknown';
}
