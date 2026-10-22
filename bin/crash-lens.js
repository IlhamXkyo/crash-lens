#!/usr/bin/env node

/**
 * CLI runner for crash-lens.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { siftLogs } from '../src/index.js';

const HELP_MESSAGE = `
CRASH-LENS :: Zero-Dependency CI/CD & Terminal Log Sifter

Usage:
  crash-lens [options] [log-file]
  cat build.log | crash-lens [options]

Options:
  -f, --format <type>   Output format: text, markdown, or json (default: text)
  -c, --context <num>   Number of context lines preceding the error (default: 3)
  -b, --budget <num>    Maximum token budget limit for LLM injection
  -s, --strict          Exit with code 1 if failures detected, 0 if clean
  -v, --version         Print version information
  -h, --help            Show this help manual

Examples:
  npm test 2>&1 | crash-lens
  crash-lens ci-error.log --format markdown
  crash-lens error.log --budget 1500 --format json
`;

function parseArgs(args) {
  const options = {
    file: null,
    format: 'text',
    context: 3,
    budget: null,
    strict: false,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '-s' || arg === '--strict') {
      options.strict = true;
    } else if (arg === '-f' || arg === '--format') {
      options.format = args[++i] || 'text';
    } else if (arg === '-c' || arg === '--context') {
      options.context = parseInt(args[++i] || '3', 10);
    } else if (arg === '-b' || arg === '--budget') {
      options.budget = parseInt(args[++i] || '0', 10);
    } else if (!arg.startsWith('-') && !options.file) {
      options.file = arg;
    }
  }

  return options;
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }

  if (options.version) {
    console.log('crash-lens v1.0.0');
    process.exit(0);
  }

  let rawLog = '';

  if (options.file) {
    try {
      const filePath = resolve(process.cwd(), options.file);
      rawLog = readFileSync(filePath, 'utf8');
    } catch (err) {
      console.error(`[crash-lens] Error reading file: ${err.message}`);
      process.exit(1);
    }
  } else if (!process.stdin.isTTY) {
    rawLog = await readStream(process.stdin);
  } else {
    console.log(HELP_MESSAGE);
    process.exit(0);
  }

  const result = siftLogs(rawLog, {
    format: options.format,
    context: options.context,
    budget: options.budget
  });

  console.log(result.output);

  if (options.strict && result.clusters.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[crash-lens] Fatal error:', err);
  process.exit(1);
});
