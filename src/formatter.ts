import chalk from 'chalk';
import boxen from 'boxen';
import { AnalysisResult, PackageAnalysis } from './types';

export function formatConsoleOutput(result: AnalysisResult): string {
  const lines: string[] = [];

  // Header with security score
  const scoreColor =
    result.securityScore >= 80
      ? chalk.green
      : result.securityScore >= 50
      ? chalk.yellow
      : chalk.red;

  const header = boxen(
    chalk.bold.white('📦 package-outdated-why') +
      '\n' +
      chalk.gray('Know which updates actually matter') +
      '\n\n' +
      `Security Score: ${scoreColor.bold(result.securityScore + '/100')}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1, left: 0, right: 0 },
      borderStyle: 'round',
      borderColor: result.securityScore >= 80 ? 'green' : result.securityScore >= 50 ? 'yellow' : 'red',
    }
  );
  lines.push(header);

  // Summary
  lines.push(chalk.bold('\n📊 Summary:'));
  lines.push(`   Total outdated: ${chalk.yellow(result.totalPackages)}`);
  lines.push(
    `   ${chalk.red('🔴 Critical')}: ${result.critical.length}  ` +
      `${chalk.yellow('🟡 Important')}: ${result.important.length}  ` +
      `${chalk.green('🟢 Safe')}: ${result.safe.length}  ` +
      `${chalk.gray('⏭️  Skip')}: ${result.skip.length}`
  );
  lines.push('');

  // Recommendation
  lines.push(chalk.bold('💡 Recommendation:'));
  lines.push(`   ${result.summary.recommendation}`);
  lines.push(`   Estimated effort: ${chalk.cyan(result.summary.estimatedEffort)}`);
  lines.push('');

  // Critical packages
  if (result.critical.length > 0) {
    lines.push(chalk.red.bold('\n🔴 CRITICAL - Update immediately:'));
    lines.push(chalk.red('   Security vulnerabilities that need fixing NOW\n'));

    for (const pkg of result.critical) {
      lines.push(formatPackageDetailed(pkg, 'critical'));
    }
  }

  // Important packages
  if (result.important.length > 0) {
    lines.push(chalk.yellow.bold('\n🟡 IMPORTANT - Review before updating:'));
    lines.push(chalk.yellow('   Breaking changes or security advisories\n'));

    for (const pkg of result.important) {
      lines.push(formatPackageDetailed(pkg, 'important'));
    }
  }

  // Safe packages
  if (result.safe.length > 0) {
    lines.push(chalk.green.bold('\n🟢 SAFE - Update anytime:'));
    lines.push(chalk.green('   Backward-compatible changes\n'));

    for (const pkg of result.safe) {
      lines.push(formatPackageCompact(pkg));
    }
    lines.push('');
  }

  // Skip packages (collapsed)
  if (result.skip.length > 0) {
    lines.push(chalk.gray.bold(`\n⏭️  SKIP - Low priority (${result.skip.length} dev deps):`));
    const skipNames = result.skip.map((p) => p.package.name).join(', ');
    lines.push(chalk.gray(`   ${skipNames}`));
    lines.push('');
  }

  // Quick commands
  if (result.totalPackages > 0) {
    lines.push(chalk.bold('\n⚡ Quick Commands:\n'));

    if (result.critical.length > 0) {
      lines.push(chalk.gray('   # Fix security issues:'));
      lines.push(chalk.white('   npm audit fix --force\n'));
    }

    if (result.safe.length > 0 || result.skip.length > 0) {
      lines.push(chalk.gray('   # Update safe packages:'));
      lines.push(chalk.white('   npm update\n'));
    }

    if (result.important.length > 0) {
      lines.push(chalk.gray('   # Update one major version at a time:'));
      const firstImportant = result.important[0];
      lines.push(chalk.white(`   ${firstImportant.updateCommand}\n`));
    }
  }

  // No updates needed
  if (result.totalPackages === 0) {
    lines.push(
      boxen(chalk.green.bold('✅ All packages are up to date!'), {
        padding: 1,
        borderStyle: 'round',
        borderColor: 'green',
      })
    );
  }

  // Footer
  lines.push(chalk.gray('\n─────────────────────────────────────────'));
  lines.push(
    chalk.gray('Saved time? ') +
      chalk.cyan('☕ https://buymeacoffee.com/gooselanding')
  );

  return lines.join('\n');
}

function formatPackageDetailed(
  analysis: PackageAnalysis,
  level: 'critical' | 'important'
): string {
  const pkg = analysis.package;
  const lines: string[] = [];

  const colorFn = level === 'critical' ? chalk.red : chalk.yellow;
  const effortBadge =
    analysis.effort === 'high'
      ? chalk.red('[HIGH EFFORT]')
      : analysis.effort === 'medium'
      ? chalk.yellow('[MEDIUM]')
      : chalk.green('[EASY]');

  // Package name, version, and effort
  lines.push(
    `   ${colorFn('•')} ${chalk.bold(pkg.name)}: ${chalk.gray(pkg.current)} → ${chalk.white(pkg.latest)} ${effortBadge}`
  );

  // Reason
  lines.push(`     ${colorFn(analysis.reason)}`);

  // Why it matters (the key differentiator!)
  lines.push(`     ${chalk.cyan('Why it matters:')} ${analysis.whyItMatters}`);

  // Security advisories
  if (analysis.advisories.length > 0) {
    for (const advisory of analysis.advisories.slice(0, 2)) {
      const severityColor =
        advisory.severity === 'critical' || advisory.severity === 'high'
          ? chalk.red
          : chalk.yellow;
      lines.push(
        `     ${severityColor(`⚠️  [${advisory.severity.toUpperCase()}]`)} ${advisory.title}`
      );
      if (advisory.url && advisory.url !== 'unknown') {
        lines.push(`        ${chalk.gray('→')} ${chalk.cyan(advisory.url)}`);
      }
    }
  }

  // Breaking change info
  if (analysis.breakingChangeInfo) {
    if (analysis.breakingChangeInfo.knownIssues) {
      lines.push(
        `     ${chalk.yellow('⚠️  Known issues:')} ${analysis.breakingChangeInfo.knownIssues.join(', ')}`
      );
    }
  }

  // Migration guide URL
  if (analysis.readMoreUrl) {
    lines.push(`     ${chalk.gray('📚 Migration guide:')} ${chalk.cyan(analysis.readMoreUrl)}`);
  }

  // Update command
  lines.push(`     ${chalk.gray('→')} ${chalk.white(analysis.updateCommand)}`);
  lines.push('');

  return lines.join('\n');
}

function formatPackageCompact(analysis: PackageAnalysis): string {
  const pkg = analysis.package;
  return `   ${chalk.green('•')} ${chalk.bold(pkg.name)}: ${chalk.gray(pkg.current)} → ${chalk.white(pkg.latest)} ${chalk.gray(`(${analysis.reason})`)}`;
}

export function formatJsonOutput(result: AnalysisResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatMarkdownOutput(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('# Package Update Report\n');
  lines.push(`Generated: ${result.timestamp.toISOString()}\n`);
  lines.push(`**Security Score: ${result.securityScore}/100**\n`);

  lines.push('## Summary\n');
  lines.push(`- **Total outdated packages:** ${result.totalPackages}`);
  lines.push(`- **Critical (security):** ${result.critical.length}`);
  lines.push(`- **Important (breaking changes):** ${result.important.length}`);
  lines.push(`- **Safe (minor/patch):** ${result.safe.length}`);
  lines.push(`- **Skip (low priority dev deps):** ${result.skip.length}`);
  lines.push(`- **Estimated effort:** ${result.summary.estimatedEffort}\n`);
  lines.push(`> ${result.summary.recommendation}\n`);

  if (result.critical.length > 0) {
    lines.push('## 🔴 Critical (Update Immediately)\n');
    for (const pkg of result.critical) {
      lines.push(formatMarkdownPackageDetailed(pkg));
    }
  }

  if (result.important.length > 0) {
    lines.push('## 🟡 Important (Review Before Updating)\n');
    for (const pkg of result.important) {
      lines.push(formatMarkdownPackageDetailed(pkg));
    }
  }

  if (result.safe.length > 0) {
    lines.push('## 🟢 Safe (Update Anytime)\n');
    lines.push('| Package | Current | Latest | Type |');
    lines.push('|---------|---------|--------|------|');
    for (const pkg of result.safe) {
      lines.push(
        `| ${pkg.package.name} | ${pkg.package.current} | ${pkg.package.latest} | ${pkg.patchUpdate ? 'Patch' : 'Minor'} |`
      );
    }
    lines.push('');
  }

  if (result.skip.length > 0) {
    lines.push('## ⏭️ Skip (Low Priority)\n');
    lines.push('Dev dependencies with low risk:\n');
    lines.push(result.skip.map((p) => `- ${p.package.name}`).join('\n'));
    lines.push('');
  }

  return lines.join('\n');
}

function formatMarkdownPackageDetailed(analysis: PackageAnalysis): string {
  const pkg = analysis.package;
  const lines: string[] = [];

  const effortEmoji =
    analysis.effort === 'high' ? '🔴' : analysis.effort === 'medium' ? '🟡' : '🟢';

  lines.push(`### ${pkg.name} ${effortEmoji}\n`);
  lines.push(`- **Current:** ${pkg.current}`);
  lines.push(`- **Latest:** ${pkg.latest}`);
  lines.push(`- **Reason:** ${analysis.reason}`);
  lines.push(`- **Effort:** ${analysis.effort}`);
  lines.push(`\n> **Why it matters:** ${analysis.whyItMatters}\n`);

  if (analysis.advisories.length > 0) {
    lines.push('**Security Advisories:**\n');
    for (const advisory of analysis.advisories) {
      lines.push(`- [${advisory.severity.toUpperCase()}] ${advisory.title}`);
      if (advisory.url) lines.push(`  - ${advisory.url}`);
    }
    lines.push('');
  }

  if (analysis.breakingChangeInfo?.knownIssues) {
    lines.push('**Known Issues:**\n');
    for (const issue of analysis.breakingChangeInfo.knownIssues) {
      lines.push(`- ${issue}`);
    }
    lines.push('');
  }

  if (analysis.readMoreUrl) {
    lines.push(`**Migration guide:** ${analysis.readMoreUrl}\n`);
  }

  lines.push(`**Update:** \`${analysis.updateCommand}\`\n`);

  return lines.join('\n');
}
