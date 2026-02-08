#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import * as fs from 'fs';
import { analyzePackages } from './analyzer';
import {
  formatConsoleOutput,
  formatJsonOutput,
  formatMarkdownOutput,
} from './formatter';
import { calculateLibyearMetrics, formatLibyearSummary } from './libyear';
import { detectUnused, formatUnusedResults } from './unused';
import { getHealthSummary, formatHealthSummary } from './health';
import { getOutdatedPackages } from './outdated';

const program = new Command();

program
  .name('package-outdated-why')
  .description(
    'Know which npm updates actually matter. Combines npm outdated + npm audit + breaking change context into one prioritized view.'
  )
  .version('0.1.0');

program
  .command('analyze', { isDefault: true })
  .alias('a')
  .description('Analyze outdated packages and prioritize by risk (default command)')
  .option('-f, --format <format>', 'Output format (console, json, markdown)', 'console')
  .option('-o, --output <file>', 'Save report to file')
  .option('--ci', 'CI mode: exit with code 1 if critical vulnerabilities found')
  .action(async (options) => {
    const spinner = ora('Analyzing packages...').start();

    try {
      // Check if package.json exists
      if (!fs.existsSync('package.json')) {
        spinner.fail(chalk.red('No package.json found in current directory'));
        process.exit(1);
      }

      spinner.text = 'Checking outdated packages...';
      const result = analyzePackages();

      spinner.succeed('Analysis complete');

      let output: string;
      switch (options.format) {
        case 'json':
          output = formatJsonOutput(result);
          break;
        case 'markdown':
        case 'md':
          output = formatMarkdownOutput(result);
          break;
        default:
          output = formatConsoleOutput(result);
      }

      if (options.output) {
        fs.writeFileSync(options.output, output);
        console.log(chalk.green(`\n✅ Report saved to ${options.output}`));
      } else {
        console.log(output);
      }

      // CI mode: exit with error if critical issues
      if (options.ci && result.critical.length > 0) {
        console.log(chalk.red(`\n❌ CI check failed: ${result.critical.length} critical vulnerabilities found`));
        process.exit(1);
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('quick')
  .alias('q')
  .description('Quick summary - just the numbers')
  .action(async () => {
    const spinner = ora('Checking packages...').start();

    try {
      const result = analyzePackages();
      spinner.stop();

      const scoreColor =
        result.securityScore >= 80
          ? chalk.green
          : result.securityScore >= 50
          ? chalk.yellow
          : chalk.red;

      console.log(chalk.bold('\n📊 Quick Summary:\n'));
      console.log(`   Security Score: ${scoreColor.bold(result.securityScore + '/100')}`);
      console.log('');
      console.log(`   ${chalk.red('🔴 Critical:')} ${result.critical.length}`);
      console.log(`   ${chalk.yellow('🟡 Important:')} ${result.important.length}`);
      console.log(`   ${chalk.green('🟢 Safe:')} ${result.safe.length}`);
      console.log(`   ${chalk.gray('⏭️  Skip:')} ${result.skip.length}`);
      console.log(`   ${chalk.gray('Total:')} ${result.totalPackages}`);
      console.log('');
      console.log(`   ${result.summary.recommendation}`);
      console.log(`   Effort: ${chalk.cyan(result.summary.estimatedEffort)}`);

      if (result.critical.length > 0) {
        console.log(chalk.red('\n⚠️  Run `npx @gooselanding/package-outdated-why` for details'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Check failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('fix')
  .alias('f')
  .description('Show commands to fix issues by priority')
  .action(async () => {
    const spinner = ora('Analyzing...').start();

    try {
      const result = analyzePackages();
      spinner.stop();

      console.log(chalk.bold('\n🔧 Fix Commands (in order of priority):\n'));

      if (result.critical.length > 0) {
        console.log(chalk.red.bold('1. Critical security fixes:'));
        console.log(chalk.gray('   Run these first!\n'));
        for (const pkg of result.critical) {
          console.log(`   ${chalk.white(pkg.updateCommand)}`);
        }
        console.log('');
      }

      if (result.important.length > 0) {
        console.log(chalk.yellow.bold('2. Important updates (one at a time):'));
        console.log(chalk.gray('   Review migration guides before updating\n'));
        for (const pkg of result.important.slice(0, 5)) {
          console.log(`   ${chalk.white(pkg.updateCommand)}`);
          if (pkg.readMoreUrl) {
            console.log(`   ${chalk.gray('# See:')} ${chalk.cyan(pkg.readMoreUrl)}`);
          }
        }
        if (result.important.length > 5) {
          console.log(chalk.gray(`   ... and ${result.important.length - 5} more`));
        }
        console.log('');
      }

      if (result.safe.length > 0 || result.skip.length > 0) {
        console.log(chalk.green.bold('3. Safe updates (batch):'));
        console.log(chalk.white('   npm update'));
        console.log('');
      }

      if (result.totalPackages === 0) {
        console.log(chalk.green('✅ Nothing to fix - all packages are up to date!'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('why <package>')
  .description('Explain why a specific package needs updating')
  .action(async (packageName) => {
    const spinner = ora(`Checking ${packageName}...`).start();

    try {
      const result = analyzePackages();
      const allPackages = [
        ...result.critical,
        ...result.important,
        ...result.safe,
        ...result.skip,
      ];

      const pkg = allPackages.find(
        (p) => p.package.name.toLowerCase() === packageName.toLowerCase()
      );

      spinner.stop();

      if (!pkg) {
        console.log(chalk.yellow(`\n📦 ${packageName} is up to date or not in your dependencies.\n`));
        return;
      }

      const priorityColor =
        pkg.priority === 'critical'
          ? chalk.red
          : pkg.priority === 'important'
          ? chalk.yellow
          : pkg.priority === 'skip'
          ? chalk.gray
          : chalk.green;

      console.log(chalk.bold(`\n📦 ${pkg.package.name}\n`));
      console.log(`   Version: ${chalk.gray(pkg.package.current)} → ${chalk.white(pkg.package.latest)}`);
      console.log(`   Priority: ${priorityColor(pkg.priority.toUpperCase())}`);
      console.log(`   Type: ${pkg.isDevDependency ? 'devDependency' : 'dependency'}`);
      console.log(`   Effort: ${pkg.effort}`);
      console.log(`   Risk Score: ${pkg.riskScore}/100`);
      console.log('');
      console.log(chalk.bold('   Why update?'));
      console.log(`   ${pkg.reason}`);
      console.log('');
      console.log(chalk.bold('   Why it matters:'));
      console.log(`   ${pkg.whyItMatters}`);

      if (pkg.advisories.length > 0) {
        console.log('');
        console.log(chalk.bold('   Security advisories:'));
        for (const adv of pkg.advisories) {
          console.log(`   - [${adv.severity.toUpperCase()}] ${adv.title}`);
        }
      }

      if (pkg.breakingChangeInfo?.knownIssues) {
        console.log('');
        console.log(chalk.bold('   Known issues:'));
        for (const issue of pkg.breakingChangeInfo.knownIssues) {
          console.log(`   - ${issue}`);
        }
      }

      if (pkg.readMoreUrl) {
        console.log('');
        console.log(`   📚 Migration guide: ${chalk.cyan(pkg.readMoreUrl)}`);
      }

      console.log('');
      console.log(`   ${chalk.bold('Update:')} ${pkg.updateCommand}`);
      console.log('');
    } catch (error: any) {
      spinner.fail(chalk.red('Check failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('libyear')
  .alias('age')
  .description('Show dependency freshness metrics (libyear)')
  .action(async () => {
    const spinner = ora('Calculating dependency age...').start();

    try {
      const outdated = getOutdatedPackages();
      spinner.text = `Analyzing ${outdated.length} outdated packages...`;

      const metrics = calculateLibyearMetrics(outdated);
      spinner.stop();

      console.log('');
      console.log(formatLibyearSummary(metrics));
      console.log('');

      if (metrics.totalLibyears > 5) {
        console.log(chalk.yellow('   💡 Tip: Consider updating packages that are > 1 year behind'));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('unused')
  .alias('u')
  .description('Detect unused dependencies')
  .action(async () => {
    const spinner = ora('Scanning for unused dependencies...').start();

    try {
      const result = detectUnused();
      spinner.stop();

      console.log('');
      console.log(formatUnusedResults(result));
      console.log('');

      if (result.unused.length > 0) {
        console.log(chalk.gray('   💡 Remove unused: npm uninstall ' + result.unused.slice(0, 3).join(' ')));
        console.log('');
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Scan failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('health')
  .alias('h')
  .description('Check package health (deprecated, unmaintained)')
  .action(async () => {
    const spinner = ora('Checking package health...').start();

    try {
      // Get all deps from package.json
      const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const deps = Object.keys(pkgJson.dependencies || {});
      const devDeps = Object.keys(pkgJson.devDependencies || {});

      spinner.text = `Checking ${deps.length + devDeps.length} packages...`;

      const summary = getHealthSummary([...deps, ...devDeps]);
      spinner.stop();

      console.log('');
      console.log(formatHealthSummary(summary));
      console.log('');
    } catch (error: any) {
      spinner.fail(chalk.red('Health check failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program
  .command('full')
  .description('Run all checks (outdated + libyear + unused + health)')
  .option('-o, --output <file>', 'Save report to file')
  .action(async (options) => {
    const spinner = ora('Running full analysis...').start();

    try {
      // Run all analyses
      spinner.text = 'Checking outdated packages...';
      const result = analyzePackages();

      spinner.text = 'Calculating dependency age...';
      const outdated = getOutdatedPackages();
      const libyear = calculateLibyearMetrics(outdated);

      spinner.text = 'Detecting unused dependencies...';
      const unused = detectUnused();

      spinner.text = 'Checking package health...';
      const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      const allDeps = [
        ...Object.keys(pkgJson.dependencies || {}),
        ...Object.keys(pkgJson.devDependencies || {}),
      ];
      const health = getHealthSummary(allDeps);

      spinner.succeed('Analysis complete');

      // Output
      console.log(formatConsoleOutput(result));
      console.log('');
      console.log(formatLibyearSummary(libyear));
      console.log('');
      console.log(formatUnusedResults(unused));
      console.log('');
      console.log(formatHealthSummary(health));

      if (options.output) {
        const fullReport = [
          formatMarkdownOutput(result),
          '## Libyear Metrics',
          formatLibyearSummary(libyear),
          '## Unused Dependencies',
          formatUnusedResults(unused),
          '## Package Health',
          formatHealthSummary(health),
        ].join('\n\n');
        fs.writeFileSync(options.output, fullReport);
        console.log(chalk.green(`\n✅ Full report saved to ${options.output}`));
      }
    } catch (error: any) {
      spinner.fail(chalk.red('Analysis failed'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();
