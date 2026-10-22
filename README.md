# crash-lens

> Zero-dependency CI/CD and terminal log sifter that isolates root-cause stack traces, strips build spam, and generates token-optimized failure diagnostics for developers and AI agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Tests: Passing](https://img.shields.io/badge/tests-19%20passing-brightgreen.svg)](test/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/IlhamXkyo/crash-lens)

---

## The Problem

When tests fail in CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins) or local terminals, developers and autonomous AI agents (Claude Code, Cursor, Aider, Antigravity) are bombarded with **5,000 to 50,000 lines of raw log spam**:
- Megabytes of repetitive dependency progress bars (`[===> ] 45%`, `downloading...`, `npm http fetch`).
- Ansi escape codes (`\x1b[31m`) and timestamp noise (`2026-10-22T10:15:23.1234567Z`) corrupting tokenizers.
- Identical error cascades: when a test database or server is unreachable, 80 tests fail with the identical error, burying the real root cause under hundreds of duplicate stack traces.

Pasting raw terminal dumps into LLMs wastes up to **98% of your context window** and causes severe context degradation. Traditional `grep ERROR` fails because it cuts off surrounding code frames, test names, and multi-line stack traces.

**`crash-lens` bridges this gap.** It consumes any raw log stream, purges build spam, clusters duplicate failures into unified root causes, extracts preceding breadcrumb context, and computes token savings in real time.

---

## Quickstart

Run directly without installation via `npx`:

```bash
# Sift failing test suite in real-time
npm test 2>&1 | npx crash-lens

# Inspect CI log output formatted as Markdown for PR comments or LLM prompt injection
npx crash-lens ci.log --format markdown

# Enforce a strict token budget for AI coding agents
npx crash-lens build-failure.log --budget 1500 --format json
```

Or install globally:

```bash
npm install -g crash-lens
```

---

## Key Features

- **Zero Dependencies**: Pure standard Node.js ESM runtime. No bloat, no supply-chain risks.
- **Polyglot Stack Trace Parser**:
  - **JavaScript / TypeScript**: Node.js, Vitest, Jest, Mocha, Playwright, V8 assertions.
  - **Python**: Tracebacks, Pytest summaries, Unittest failures, nested exceptions.
  - **Rust**: Cargo panics, compiler error diagnostics (`error[E0308]`), source arrows (`--> src/lib.rs:42:15`).
  - **Go**: Goroutine runtime panics, `--- FAIL:` test runners.
  - **CI & Containers**: Exit codes, Docker build crashes, `npm ERR!`.
- **Intelligent Error Clustering**: Groups 50 repeated failures from a single database timeout into 1 primary root cause with occurrence metrics.
- **Automated ANSI & Timestamp Scrubbing**: Removes ISO timestamps, syslog brackets, and terminal escape colors while keeping code alignment intact.
- **Token Budget Guard (`--budget`)**: Ensures diagnostics never exceed your agent context limit.
- **Multi-Format Output**: Text, Markdown (with collapsible stack traces), and schema-validated JSON.

---

## Command-Line Usage

```text
Usage:
  crash-lens [options] [log-file]
  cat build.log | crash-lens [options]

Options:
  -f, --format <type>   Output format: text, markdown, or json (default: text)
  -c, --context <num>   Number of context lines preceding the error (default: 3)
  -b, --budget <num>    Maximum token budget limit for LLM injection
  -s, --strict          Exit with code 1 if failures detected, 0 if clean
  -v, --version         Print version information
  -h, --help            Show this manual
```

### Example: CI / CD Workflow Integration

Add `crash-lens` to your GitHub Actions workflow to post instant root-cause summaries on failure:

```yaml
- name: Run Test Suite
  id: tests
  run: npm test 2>&1 | tee test.log

- name: Diagnostic Report on Failure
  if: failure()
  run: |
    npx crash-lens test.log --format markdown >> $GITHUB_STEP_SUMMARY
```

---

## Programmatic API

`crash-lens` can be used directly as an ESM library inside your own tools and agent runners:

```javascript
import { siftLogs } from 'crash-lens';

const rawLog = await fetchCiLog();

const { clusters, metrics, output } = siftLogs(rawLog, {
  format: 'markdown', // 'text' | 'markdown' | 'json'
  context: 3,         // preceding breadcrumb lines
  budget: 2000        // max token budget
});

console.log(`Saved ${metrics.tokensSaved} tokens (${metrics.reductionPercent}% reduction)`);
console.log(output);
```

---

## Diagnostic Output Example

### Markdown Output (`--format markdown`)

```markdown
## 🔍 Crash-Lens Failure Diagnostic

| Metric | Value |
| :--- | :--- |
| **Root Causes** | `1` |
| **Total Failures** | `14` |
| **Raw Footprint** | `12,840 lines` (~34,200 tokens) |
| **Sifted Footprint** | `28 lines` (~420 tokens) |
| **Token Reduction** | **`98.8%`** (Saved **33,780** tokens) |

### 💥 Root Causes Overview

#### 1. `node` TypeError: Cannot read properties of undefined (reading 'jwtSecret') (14x)
- **Location**: `src/auth/jwt.ts:42:15`
- **Message**: `Cannot read properties of undefined (reading 'jwtSecret')`

**Preceding Context:**
```bash
> jest --runInBand
PASS src/utils/math.test.ts
FAIL src/auth/jwt.test.ts
```

<details><summary>Stack Trace</summary>

```
at verifyToken (src/auth/jwt.ts:42:15)
at handleAuth (src/server/routes.ts:18:5)
```
</details>
```

---

## Benchmark

| Raw Input Type | Original Lines | Sifted Lines | Token Reduction | Execution Time |
| :--- | :--- | :--- | :--- | :--- |
| Vitest 200-test run with 5 DB failures | 4,820 lines | 31 lines | **98.4%** | ~14ms |
| Cargo test with compiler error cascade | 2,150 lines | 24 lines | **97.6%** | ~9ms |
| Pytest multi-file run with assertion errors | 3,900 lines | 35 lines | **98.1%** | ~12ms |

---

## License

MIT © [ilhamxkyo](https://github.com/IlhamXkyo)
