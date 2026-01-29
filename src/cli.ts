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

program.parse();
