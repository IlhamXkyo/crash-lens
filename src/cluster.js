/**
 * Clustering module: Groups repetitive errors, deduplicates stack traces,
 * and ranks root causes by impact and frequency.
 */

/**
 * Normalizes an error message by stripping volatile tokens like memory addresses,
 * random timestamps, temporary ports, and IDs.
 * @param {string} msg
 * @returns {string}
 */
export function normalizeMessage(msg) {
  if (!msg) return '';
  return msg
    .replace(/0x[0-9a-fA-F]+/g, '0x<addr>')
    .replace(/:\d{4,5}\b/g, ':<port>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<date>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Creates a unique clustering key for an error report.
 * @param {object} crash
 * @returns {string}
 */
export function makeClusterKey(crash) {
  const normMsg = normalizeMessage(crash.message || crash.title);
  const fileKey = crash.file ? crash.file.toLowerCase() : 'unknown';
  const lineKey = crash.line ? String(crash.line) : '0';
  return `${crash.type}::${fileKey}::${lineKey}::${normMsg}`;
}

/**
 * Clusters an array of CrashReport items into deduplicated Root Causes.
 * @param {Array<object>} crashes
 * @returns {Array<object>}
 */
export function clusterCrashes(crashes) {
  if (!Array.isArray(crashes) || crashes.length === 0) return [];

  const map = new Map();

  for (const crash of crashes) {
    const key = makeClusterKey(crash);

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        type: crash.type,
        title: crash.title,
        message: crash.message,
        file: crash.file,
        line: crash.line,
        column: crash.column,
        occurrences: 1,
        occurrencesList: [
          {
            contextBefore: crash.contextBefore,
            rawIndex: crash.rawIndex || null
          }
        ],
        stack: crash.stack || [],
        rawSnippet: crash.rawSnippet || [],
        contextBefore: crash.contextBefore || []
      });
    } else {
      const existing = map.get(key);
      existing.occurrences += 1;
      existing.occurrencesList.push({
        contextBefore: crash.contextBefore,
        rawIndex: crash.rawIndex || null
      });

      // Prefer stack or snippet if earlier was empty
      if (existing.stack.length === 0 && (crash.stack || []).length > 0) {
        existing.stack = crash.stack;
      }
      if (existing.rawSnippet.length === 0 && (crash.rawSnippet || []).length > 0) {
        existing.rawSnippet = crash.rawSnippet;
      }
      if (!existing.file && crash.file) {
        existing.file = crash.file;
        existing.line = crash.line;
        existing.column = crash.column;
      }
    }
  }

  const clusters = Array.from(map.values());

  // Rank: highest occurrences first; then file-located before generic
  clusters.sort((a, b) => {
    if (b.occurrences !== a.occurrences) {
      return b.occurrences - a.occurrences;
    }
    const aHasLoc = a.file && a.line ? 1 : 0;
    const bHasLoc = b.file && b.line ? 1 : 0;
    return bHasLoc - aHasLoc;
  });

  return clusters;
}
