/**
 * Formatter module: Renders structured root causes into Text, Markdown,
 * or JSON formats, with support for strict token budgets.
 */

import { estimateTokens } from './metrics.js';

/**
 * Format root cause clusters into terminal human-readable text.
 * @param {Array<object>} clusters
 * @param {object} metrics
 * @returns {string}
 */
export function formatText(clusters, metrics) {
  const lines = [];

  lines.push('================================================================');
  lines.push('  CRASH-LENS :: Failure Diagnostic Summary');
  lines.push('================================================================');

  if (clusters.length === 0) {
    lines.push('✓ No failures or stack traces detected in log stream.');
    lines.push(`  Scanned ${metrics.rawLines.toLocaleString()} lines (${metrics.rawTokens.toLocaleString()} tokens).`);
    return lines.join('\n');
  }

  const totalErrors = clusters.reduce((acc, c) => acc + c.occurrences, 0);
  lines.push(`  Detected: ${clusters.length} Root Cause(s) | ${totalErrors} Total Failure Event(s)`);
  lines.push(`  Efficiency: ${metrics.reductionPercent}% Token Reduction (Saved ${metrics.tokensSaved.toLocaleString()} tokens)`);
  lines.push(`  Lines Sifted: ${metrics.rawLines.toLocaleString()} -> ${metrics.siftedLines.toLocaleString()}`);
  lines.push('----------------------------------------------------------------\n');

  clusters.forEach((cluster, idx) => {
    const occLabel = cluster.occurrences > 1 ? ` (${cluster.occurrences} occurrences)` : '';
    lines.push(`[ROOT CAUSE #${idx + 1}] [${cluster.type.toUpperCase()}]${occLabel}`);
    lines.push(`  Title   : ${cluster.title}`);
    if (cluster.file) {
      const loc = cluster.line ? `:${cluster.line}${cluster.column ? `:${cluster.column}` : ''}` : '';
      lines.push(`  Location: ${cluster.file}${loc}`);
    }

    if (cluster.contextBefore && cluster.contextBefore.length > 0) {
      lines.push('  Context :');
      cluster.contextBefore.forEach((c) => {
        lines.push(`    > ${c}`);
      });
    }

    if (cluster.rawSnippet && cluster.rawSnippet.length > 0) {
      lines.push('  Code Excerpt:');
      cluster.rawSnippet.forEach((s) => {
        lines.push(`    ${s}`);
      });
    }

    if (cluster.stack && cluster.stack.length > 0) {
      lines.push('  Trace:');
      // Limit printed stack frames to top 5 to save space
      const frames = cluster.stack.slice(0, 5);
      frames.forEach((f) => {
        lines.push(`    ${f}`);
      });
      if (cluster.stack.length > 5) {
        lines.push(`    ... (${cluster.stack.length - 5} more frames omitted)`);
      }
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format root cause clusters into GitHub PR / LLM markdown format.
 * @param {Array<object>} clusters
 * @param {object} metrics
 * @returns {string}
 */
export function formatMarkdown(clusters, metrics) {
  const lines = [];

  lines.push('## 🔍 Crash-Lens Failure Diagnostic');
  lines.push('');

  if (clusters.length === 0) {
    lines.push('✅ **No failures or stack traces detected in log stream.**');
    lines.push(`> Scanned \`${metrics.rawLines.toLocaleString()}\` lines (\`${metrics.rawTokens.toLocaleString()}\` tokens).`);
    return lines.join('\n');
  }

  const totalErrors = clusters.reduce((acc, c) => acc + c.occurrences, 0);

  lines.push('| Metric | Value |');
  lines.push('| :--- | :--- |');
  lines.push(`| **Root Causes** | \`${clusters.length}\` |`);
  lines.push(`| **Total Failures** | \`${totalErrors}\` |`);
  lines.push(`| **Raw Footprint** | \`${metrics.rawLines.toLocaleString()} lines\` (~${metrics.rawTokens.toLocaleString()} tokens) |`);
  lines.push(`| **Sifted Footprint** | \`${metrics.siftedLines.toLocaleString()} lines\` (~${metrics.siftedTokens.toLocaleString()} tokens) |`);
  lines.push(`| **Token Reduction** | **\`${metrics.reductionPercent}%\`** (Saved **${metrics.tokensSaved.toLocaleString()}** tokens) |`);
  lines.push('');

  lines.push('### 💥 Root Causes Overview');
  lines.push('');

  clusters.forEach((cluster, idx) => {
    const loc = cluster.file
      ? `\`${cluster.file}${cluster.line ? `:${cluster.line}` : ''}\``
      : '*unknown*';
    const occ = cluster.occurrences > 1 ? ` (${cluster.occurrences}x)` : '';

    lines.push(`#### ${idx + 1}. \`${cluster.type}\` ${cluster.title}${occ}`);
    lines.push(`- **Location**: ${loc}`);
    lines.push(`- **Message**: \`${cluster.message || cluster.title}\``);

    if (cluster.contextBefore && cluster.contextBefore.length > 0) {
      lines.push('**Preceding Context:**');
      lines.push('```bash');
      cluster.contextBefore.forEach((c) => lines.push(c));
      lines.push('```');
    }

    if (cluster.rawSnippet && cluster.rawSnippet.length > 0) {
      lines.push('**Source Code Excerpt:**');
      lines.push('```');
      cluster.rawSnippet.forEach((s) => lines.push(s));
      lines.push('```');
    }

    if (cluster.stack && cluster.stack.length > 0) {
      lines.push('<details><summary>Stack Trace</summary>');
      lines.push('');
      lines.push('```');
      cluster.stack.forEach((f) => lines.push(f));
      lines.push('```');
      lines.push('</details>');
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format root cause clusters into machine-readable JSON.
 * @param {Array<object>} clusters
 * @param {object} metrics
 * @returns {string}
 */
export function formatJson(clusters, metrics) {
  const totalErrors = clusters.reduce((acc, c) => acc + c.occurrences, 0);
  const payload = {
    summary: {
      rootCausesCount: clusters.length,
      totalErrorsFound: totalErrors,
      metrics
    },
    rootCauses: clusters
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Truncate clusters to fit within a strict token budget.
 * @param {Array<object>} clusters
 * @param {number} budgetTokens
 * @returns {Array<object>}
 */
export function enforceBudget(clusters, budgetTokens) {
  if (!budgetTokens || budgetTokens <= 0) return clusters;

  const budgeted = [];
  let currentEstimated = 100; // base overhead

  for (const cluster of clusters) {
    const clusterEstimate = estimateTokens(JSON.stringify(cluster));
    if (currentEstimated + clusterEstimate <= budgetTokens) {
      budgeted.push(cluster);
      currentEstimated += clusterEstimate;
    } else {
      // Try adding trimmed version (stack capped to 2 lines)
      const trimmed = {
        ...cluster,
        stack: (cluster.stack || []).slice(0, 2),
        contextBefore: (cluster.contextBefore || []).slice(0, 2),
        rawSnippet: []
      };
      const trimmedEstimate = estimateTokens(JSON.stringify(trimmed));
      if (currentEstimated + trimmedEstimate <= budgetTokens) {
        budgeted.push(trimmed);
        currentEstimated += trimmedEstimate;
      }
      break;
    }
  }

  return budgeted;
}
