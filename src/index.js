/**
 * Main library entry point for crash-lens.
 */

import { cleanLog, stripAnsi, stripTimestamp } from './cleaner.js';
import { extractCrashes } from './extractors.js';
import { clusterCrashes } from './cluster.js';
import { calculateMetrics, estimateTokens } from './metrics.js';
import { formatText, formatMarkdown, formatJson, enforceBudget } from './formatter.js';

/**
 * Main function to sift raw logs, extract root causes, and format the diagnostic output.
 * @param {string} rawLog
 * @param {object} options
 * @param {'text' | 'markdown' | 'json'} [options.format='text']
 * @param {number} [options.context=3]
 * @param {number} [options.budget=null]
 * @returns {{ clusters: Array<object>, metrics: object, output: string }}
 */
export function siftLogs(rawLog, options = {}) {
  const {
    format = 'text',
    context = 3,
    budget = null
  } = options;

  const cleanedLines = cleanLog(rawLog);
  const rawCrashes = extractCrashes(cleanedLines, context);
  let clusters = clusterCrashes(rawCrashes);

  if (budget && budget > 0) {
    clusters = enforceBudget(clusters, budget);
  }

  // Pre-calculate preliminary formatted output to measure final metrics
  let preliminaryOutput = '';
  const initialMetrics = calculateMetrics(rawLog, '');

  if (format === 'json') {
    preliminaryOutput = formatJson(clusters, initialMetrics);
  } else if (format === 'markdown') {
    preliminaryOutput = formatMarkdown(clusters, initialMetrics);
  } else {
    preliminaryOutput = formatText(clusters, initialMetrics);
  }

  const finalMetrics = calculateMetrics(rawLog, preliminaryOutput);

  // Render final with accurate metrics embedded
  let finalOutput = '';
  if (format === 'json') {
    finalOutput = formatJson(clusters, finalMetrics);
  } else if (format === 'markdown') {
    finalOutput = formatMarkdown(clusters, finalMetrics);
  } else {
    finalOutput = formatText(clusters, finalMetrics);
  }

  return {
    clusters,
    metrics: finalMetrics,
    output: finalOutput
  };
}

export {
  cleanLog,
  stripAnsi,
  stripTimestamp,
  extractCrashes,
  clusterCrashes,
  calculateMetrics,
  estimateTokens,
  formatText,
  formatMarkdown,
  formatJson,
  enforceBudget
};
