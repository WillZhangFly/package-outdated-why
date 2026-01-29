import { execSync } from 'child_process';
import { OutdatedPackage } from './types';

export function getOutdatedPackages(): OutdatedPackage[] {
  try {
    // Run npm outdated with JSON output
    const output = execSync('npm outdated --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!output.trim()) {
      return [];
    }

    const outdatedJson = JSON.parse(output);
    const packages: OutdatedPackage[] = [];

    for (const [name, info] of Object.entries(outdatedJson)) {
      const pkgInfo = info as any;
      packages.push({
        name,
        current: pkgInfo.current || 'N/A',
        wanted: pkgInfo.wanted || pkgInfo.current,
        latest: pkgInfo.latest || pkgInfo.wanted,
        location: pkgInfo.location || 'node_modules/' + name,
        type: pkgInfo.type || 'dependencies',
      });
    }

    return packages;
  } catch (error: any) {
    // npm outdated exits with code 1 when packages are outdated
    if (error.stdout) {
      try {
        const outdatedJson = JSON.parse(error.stdout);
        const packages: OutdatedPackage[] = [];

        for (const [name, info] of Object.entries(outdatedJson)) {
          const pkgInfo = info as any;
          packages.push({
            name,
            current: pkgInfo.current || 'N/A',
            wanted: pkgInfo.wanted || pkgInfo.current,
            latest: pkgInfo.latest || pkgInfo.wanted,
            location: pkgInfo.location || 'node_modules/' + name,
            type: pkgInfo.type || 'dependencies',
          });
        }

        return packages;
      } catch {
        // JSON parse failed
      }
    }

    // No outdated packages or error
    return [];
  }
}
