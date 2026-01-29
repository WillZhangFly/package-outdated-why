import {
  OutdatedPackage,
  PackageAnalysis,
  AnalysisResult,
  SecurityAdvisory,
  AnalysisSummary,
} from './types';
import { getOutdatedPackages } from './outdated';
import { getSecurityAdvisories } from './security';
import {
  analyzeSemver,
  getBreakingChangeUrl,
  getBreakingChangeInfo,
  hasKnownBreakingChanges,
  estimateUpdateEffort,
} from './semver';

export function analyzePackages(): AnalysisResult {
  const outdated = getOutdatedPackages();
  const advisories = getSecurityAdvisories();

  const analyses: PackageAnalysis[] = outdated.map((pkg) =>
    analyzePackage(pkg, advisories.get(pkg.name) || [])
  );

  // Sort by risk score (highest first within each category)
  const sortByRisk = (a: PackageAnalysis, b: PackageAnalysis) =>
    b.riskScore - a.riskScore;

  const critical = analyses.filter((a) => a.priority === 'critical').sort(sortByRisk);
  const important = analyses.filter((a) => a.priority === 'important').sort(sortByRisk);
  const safe = analyses.filter((a) => a.priority === 'safe').sort(sortByRisk);
  const skip = analyses.filter((a) => a.priority === 'skip').sort(sortByRisk);

  // Calculate summary
  const summary = calculateSummary(analyses);
  const securityScore = calculateSecurityScore(analyses);

  return {
    critical,
    important,
    safe,
    skip,
    timestamp: new Date(),
    totalPackages: analyses.length,
    securityScore,
    summary,
  };
}

function analyzePackage(
  pkg: OutdatedPackage,
  advisories: SecurityAdvisory[]
): PackageAnalysis {
  const semverInfo = analyzeSemver(pkg);
  const hasSecurityIssues = advisories.length > 0;
  const hasCriticalSecurity = advisories.some(
    (a) => a.severity === 'critical' || a.severity === 'high'
  );
  const isDevDep = pkg.type === 'devDependencies';

  // Get breaking change info if available
  const breakingChangeInfo = semverInfo.majorUpdate
    ? getBreakingChangeInfo(pkg.name, semverInfo.currentMajor, semverInfo.latestMajor)
    : undefined;

  // Calculate effort
  const effort = semverInfo.majorUpdate
    ? estimateUpdateEffort(pkg.name, semverInfo.currentMajor, semverInfo.latestMajor)
    : 'low';

  // Calculate risk score (0-100)
  let riskScore = 0;

  // Security issues are highest priority
  if (hasCriticalSecurity) riskScore += 80;
  else if (hasSecurityIssues) riskScore += 50;

  // Major updates add risk
  if (semverInfo.majorUpdate) {
    riskScore += hasKnownBreakingChanges(pkg.name, semverInfo.currentMajor, semverInfo.latestMajor)
      ? 30
      : 20;
  } else if (semverInfo.minorUpdate) {
    riskScore += 5;
  }

  // Reduce risk for dev dependencies
  if (isDevDep && !hasSecurityIssues) {
    riskScore = Math.floor(riskScore * 0.5);
  }

  // Determine priority and reason
  let priority: 'critical' | 'important' | 'safe' | 'skip';
  let reason: string;
  let whyItMatters: string;

  if (hasSecurityIssues && hasCriticalSecurity) {
    priority = 'critical';
    const highestSeverity = advisories[0].severity;
    reason = `Security vulnerability (${highestSeverity}): ${advisories[0].title}`;
    whyItMatters = `This package has a known security flaw that attackers could exploit. ${
      highestSeverity === 'critical'
        ? 'Critical vulnerabilities can lead to remote code execution or data breaches.'
        : 'High severity issues can compromise your application security.'
    }`;
  } else if (hasSecurityIssues) {
    priority = 'important';
    reason = `Security advisory: ${advisories[0].title}`;
    whyItMatters = `There's a known security issue, though lower severity. Worth fixing to reduce your attack surface.`;
  } else if (semverInfo.majorUpdate) {
    const hasKnownBreaking = hasKnownBreakingChanges(
      pkg.name,
      semverInfo.currentMajor,
      semverInfo.latestMajor
    );

    if (isDevDep && !hasKnownBreaking) {
      priority = 'skip';
      reason = `Dev dependency major update (v${semverInfo.currentMajor} → v${semverInfo.latestMajor})`;
      whyItMatters = `This is a dev-only tool with a major update. Lower priority since it doesn't affect production.`;
    } else {
      priority = 'important';
      if (breakingChangeInfo) {
        reason = `Major update: ${breakingChangeInfo.summary}`;
        whyItMatters = `Version ${semverInfo.latestMajor} includes breaking changes. ${
          breakingChangeInfo.knownIssues
            ? `Watch out for: ${breakingChangeInfo.knownIssues.join(', ')}.`
            : 'Review the migration guide before updating.'
        }`;
      } else {
        reason = `Major version update (v${semverInfo.currentMajor} → v${semverInfo.latestMajor})`;
        whyItMatters = `Major versions often include breaking changes. Check the changelog before updating.`;
      }
    }
  } else if (semverInfo.minorUpdate) {
    if (isDevDep) {
      priority = 'skip';
      reason = 'Dev dependency minor update - new features';
      whyItMatters = `New features available, but this is a dev tool. Update when convenient.`;
    } else {
      priority = 'safe';
      reason = 'Minor update - new features, backward compatible';
      whyItMatters = `New features added without breaking existing code. Safe to update.`;
    }
  } else {
    if (isDevDep) {
      priority = 'skip';
      reason = 'Dev dependency patch - bug fixes';
      whyItMatters = `Bug fixes for a dev tool. Low priority but good to stay current.`;
    } else {
      priority = 'safe';
      reason = 'Patch update - bug fixes only';
      whyItMatters = `Bug fixes and small improvements. Very safe to update.`;
    }
  }

  // Generate update command
  let updateCommand: string;
  if (semverInfo.patchUpdate || semverInfo.minorUpdate) {
    updateCommand = `npm update ${pkg.name}`;
  } else {
    updateCommand = `npm install ${pkg.name}@latest`;
  }

  // Get read more URL for major updates
  const readMoreUrl = semverInfo.majorUpdate
    ? getBreakingChangeUrl(pkg.name, semverInfo.latestMajor)
    : undefined;

  return {
    package: pkg,
    priority,
    reason,
    whyItMatters,
    advisories,
    breakingChanges: semverInfo.majorUpdate,
    breakingChangeInfo,
    majorUpdate: semverInfo.majorUpdate,
    minorUpdate: semverInfo.minorUpdate,
    patchUpdate: semverInfo.patchUpdate,
    updateCommand,
    readMoreUrl,
    isDevDependency: isDevDep,
    riskScore,
    effort,
  };
}

function calculateSummary(analyses: PackageAnalysis[]): AnalysisSummary {
  const totalVulnerabilities = analyses.reduce(
    (sum, a) => sum + a.advisories.length,
    0
  );
  const criticalVulnerabilities = analyses.reduce(
    (sum, a) =>
      sum +
      a.advisories.filter((adv) => adv.severity === 'critical').length,
    0
  );
  const highVulnerabilities = analyses.reduce(
    (sum, a) =>
      sum + a.advisories.filter((adv) => adv.severity === 'high').length,
    0
  );
  const majorUpdatesAvailable = analyses.filter((a) => a.majorUpdate).length;

  // Estimate effort
  const highEffortCount = analyses.filter((a) => a.effort === 'high').length;
  const mediumEffortCount = analyses.filter((a) => a.effort === 'medium').length;
  const lowEffortCount = analyses.filter((a) => a.effort === 'low').length;

  const totalHours =
    highEffortCount * 4 + mediumEffortCount * 1 + lowEffortCount * 0.25;

  let estimatedEffort: string;
  if (totalHours < 1) {
    estimatedEffort = '< 1 hour';
  } else if (totalHours < 4) {
    estimatedEffort = `~${Math.ceil(totalHours)} hours`;
  } else if (totalHours < 8) {
    estimatedEffort = '~1 day';
  } else {
    estimatedEffort = `~${Math.ceil(totalHours / 8)} days`;
  }

  // Generate recommendation
  let recommendation: string;
  if (criticalVulnerabilities > 0) {
    recommendation = `🚨 Fix ${criticalVulnerabilities} critical vulnerabilities immediately!`;
  } else if (highVulnerabilities > 0) {
    recommendation = `⚠️ Address ${highVulnerabilities} high severity issues soon.`;
  } else if (majorUpdatesAvailable > 3) {
    recommendation = `📦 ${majorUpdatesAvailable} major updates available. Consider updating one at a time.`;
  } else if (analyses.length === 0) {
    recommendation = '✅ All packages are up to date!';
  } else {
    recommendation = '👍 No urgent updates. Run `npm update` for safe updates.';
  }

  return {
    totalVulnerabilities,
    criticalVulnerabilities,
    highVulnerabilities,
    majorUpdatesAvailable,
    estimatedEffort,
    recommendation,
  };
}

function calculateSecurityScore(analyses: PackageAnalysis[]): number {
  if (analyses.length === 0) return 100;

  let deductions = 0;

  for (const analysis of analyses) {
    for (const advisory of analysis.advisories) {
      switch (advisory.severity) {
        case 'critical':
          deductions += 25;
          break;
        case 'high':
          deductions += 15;
          break;
        case 'moderate':
          deductions += 5;
          break;
        case 'low':
          deductions += 2;
          break;
      }
    }
  }

  return Math.max(0, 100 - deductions);
}

export { getOutdatedPackages, getSecurityAdvisories };
