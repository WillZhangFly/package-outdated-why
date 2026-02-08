export { analyzePackages, getOutdatedPackages, getSecurityAdvisories } from './analyzer';
export { formatConsoleOutput, formatJsonOutput, formatMarkdownOutput } from './formatter';
export { calculateLibyearMetrics, calculatePackageAge, formatLibyearSummary } from './libyear';
export { detectUnused, formatUnusedResults } from './unused';
export { getPackageHealth, getHealthSummary, formatHealthSummary } from './health';
export * from './types';
