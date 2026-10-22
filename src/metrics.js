/**
 * Metrics module: Calculates token consumption, compression ratios,
 * and context footprint savings.
 */

// Average character per token ratio for source code and terminal logs (~3.8 characters per token)
const CHARS_PER_TOKEN = 3.8;

/**
 * Estimate token count based on string length.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

/**
 * Calculate token reduction metrics between raw input and sifted output.
 * @param {string} rawInput
 * @param {string} siftedOutput
 * @returns {object}
 */
export function calculateMetrics(rawInput, siftedOutput) {
  const rawStr = typeof rawInput === 'string' ? rawInput : '';
  const siftedStr = typeof siftedOutput === 'string' ? siftedOutput : '';

  const rawLines = rawStr.trim().length > 0 ? rawStr.trim().split(/\r?\n/).length : 0;
  const rawBytes = Buffer.byteLength(rawStr, 'utf8');
  const rawTokens = estimateTokens(rawStr);

  const siftedLines = siftedStr.trim().length > 0 ? siftedStr.trim().split(/\r?\n/).length : 0;
  const siftedBytes = Buffer.byteLength(siftedStr, 'utf8');
  const siftedTokens = estimateTokens(siftedStr);

  const tokensSaved = Math.max(0, rawTokens - siftedTokens);
  let reductionPercent = 0;
  if (rawTokens > 0) {
    reductionPercent = Math.max(0, Math.min(100, ((rawTokens - siftedTokens) / rawTokens) * 100));
  }

  return {
    rawLines,
    rawBytes,
    rawTokens,
    siftedLines,
    siftedBytes,
    siftedTokens,
    tokensSaved,
    reductionPercent: Number(reductionPercent.toFixed(1))
  };
}
