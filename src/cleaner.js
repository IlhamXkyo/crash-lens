/**
 * Cleaner module: Strips ANSI codes, CI timestamps, and repetitive progress/download noise.
 */

// Regular expression matching ANSI escape sequences (colors, cursor movements, erase line)
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// Regular expression matching common CI and logger timestamps at line starts
const TIMESTAMP_REGEXES = [
  // GitHub Actions format: 2026-10-22T21:40:15.1234567Z
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/,
  // Standard ISO date: 2026-10-22 21:40:15 or 2026-10-22 21:40:15.123
  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:\s*\[[A-Z]+\])?\s*/,
  // Brackets time: [21:40:15] or [21:40:15.123]
  /^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*/,
  // Simple time: 21:40:15 or 21:40:15.123
  /^\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+/
];

// Patterns representing noise lines that can safely be suppressed
const NOISE_LINE_PATTERNS = [
  // Download progress bars and spinners
  /^\s*\[[=>\-\s]+\]\s*\d+%/i,
  /^\s*\d+%\s*\[[=>\-\s]+\]/i,
  /^\s*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+downloading/i,
  /^\s*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s+resolving/i,
  /^\s*downloading\s+.+\.\.\.\s*\(\d+%\)/i,
  /^\s*fetched\s+\d+\s+packages/i,
  // Routine package manager outputs
  /^\s*npm\s+http\s+fetch\s+GET\s+https/i,
  /^\s*pip\s+download\s+.+\(\d+\.?\d*\s*[kM]B\)/i,
  /^\s*downloading\s+crates\.\.\./i,
  // Empty git hash progress
  /^\s*checking\s+out\s+files:\s+\d+%/i,
  /^\s*updating\s+crates\.io\s+index/i,
  // Success lines in huge test outputs that drown errors
  /^\s*✓\s+.+\(\d+\s*ms\)$/,
  /^\s*PASS\s+.+$/
];

/**
 * Remove all ANSI escape codes from a string.
 * @param {string} str
 * @returns {string}
 */
export function stripAnsi(str) {
  if (typeof str !== 'string') return '';
  return str.replace(ANSI_REGEX, '');
}

/**
 * Remove CI and logger timestamps from the beginning of a line.
 * @param {string} line
 * @returns {string}
 */
export function stripTimestamp(line) {
  if (typeof line !== 'string') return '';
  let cleaned = line;
  for (const regex of TIMESTAMP_REGEXES) {
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, '');
      break;
    }
  }
  return cleaned;
}

/**
 * Check if a line contains only disposable progress noise.
 * @param {string} line
 * @returns {boolean}
 */
export function isNoiseLine(line) {
  if (typeof line !== 'string') return false;
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Clean and normalize a raw log string into structured line objects.
 * @param {string} rawLog
 * @returns {Array<{ rawIndex: number, text: string, isNoise: boolean }>}
 */
export function cleanLog(rawLog) {
  if (typeof rawLog !== 'string') return [];
  const rawLines = rawLog.split(/\r?\n/);
  const result = [];

  for (let i = 0; i < rawLines.length; i++) {
    const withoutAnsi = stripAnsi(rawLines[i]);
    const withoutTimestamp = stripTimestamp(withoutAnsi);
    const noise = isNoiseLine(withoutTimestamp);

    result.push({
      rawIndex: i + 1,
      text: withoutTimestamp,
      isNoise: noise
    });
  }

  return result;
}
