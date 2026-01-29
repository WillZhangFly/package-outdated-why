export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  location: string;
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

export interface SecurityAdvisory {
  id: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  url: string;
  vulnerableVersions: string;
  patchedVersions: string;
  cwe?: string;
}

export interface BreakingChangeInfo {
  fromVersion: number;
  toVersion: number;
  migrationUrl?: string;
  summary?: string;
  effort: 'low' | 'medium' | 'high';
  knownIssues?: string[];
}

export interface PackageHealth {
  weeklyDownloads?: number;
  lastPublish?: Date;
  isDeprecated?: boolean;
  isUnmaintained?: boolean; // No updates in 2+ years
  hasTypes?: boolean;
}

export interface PackageAnalysis {
  package: OutdatedPackage;
  priority: 'critical' | 'important' | 'safe' | 'skip';
  reason: string;
  whyItMatters: string; // Human-readable explanation
  advisories: SecurityAdvisory[];
  breakingChanges: boolean;
  breakingChangeInfo?: BreakingChangeInfo;
  majorUpdate: boolean;
  minorUpdate: boolean;
  patchUpdate: boolean;
  updateCommand: string;
  readMoreUrl?: string;
  health?: PackageHealth;
  isDevDependency: boolean;
  riskScore: number; // 0-100, higher = more urgent
  effort: 'low' | 'medium' | 'high';
}

export interface AnalysisResult {
  critical: PackageAnalysis[];
  important: PackageAnalysis[];
  safe: PackageAnalysis[];
  skip: PackageAnalysis[]; // dev deps with low risk
  timestamp: Date;
  totalPackages: number;
  securityScore: number; // 0-100, higher = healthier
  summary: AnalysisSummary;
}

export interface AnalysisSummary {
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  majorUpdatesAvailable: number;
  estimatedEffort: string; // "~2 hours" or "~1 day"
  recommendation: string;
}
