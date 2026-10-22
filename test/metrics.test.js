import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, calculateMetrics } from '../src/metrics.js';

test('estimateTokens: returns proportional token counts', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 2); // 4 / 3.8 = ceil(1.05) -> 2
  const longText = 'a'.repeat(380);
  assert.equal(estimateTokens(longText), 100);
});

test('calculateMetrics: calculates reduction percentages and tokens saved', () => {
  const rawInput = 'line of text\n'.repeat(500); // 500 lines
  const siftedOutput = 'Error at src/file.js:10\n';

  const m = calculateMetrics(rawInput, siftedOutput);
  assert.equal(m.rawLines, 500);
  assert.equal(m.siftedLines, 1);
  assert.equal(m.tokensSaved > 0, true);
  assert.equal(m.reductionPercent > 90, true);
});
