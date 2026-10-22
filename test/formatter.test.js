import test from 'node:test';
import assert from 'node:assert/strict';
import { formatText, formatMarkdown, formatJson, enforceBudget } from '../src/formatter.js';

const mockClusters = [
  {
    type: 'node',
    title: 'TypeError: undefined is not a function',
    message: 'undefined is not a function',
    file: 'src/index.js',
    line: 50,
    column: 12,
    occurrences: 3,
    contextBefore: ['npm test'],
    rawSnippet: ['> 50 | func()'],
    stack: ['at Object.run (src/index.js:50:12)']
  }
];

const mockMetrics = {
  rawLines: 1000,
  rawTokens: 4000,
  siftedLines: 20,
  siftedTokens: 80,
  tokensSaved: 3920,
  reductionPercent: 98.0
};

test('formatText: produces formatted terminal summary', () => {
  const text = formatText(mockClusters, mockMetrics);
  assert.match(text, /CRASH-LENS :: Failure Diagnostic Summary/);
  assert.match(text, /98% Token Reduction/);
  assert.match(text, /ROOT CAUSE #1/);
  assert.match(text, /src\/index\.js:50:12/);
});

test('formatMarkdown: produces GitHub markdown with table and collapsible stack', () => {
  const md = formatMarkdown(mockClusters, mockMetrics);
  assert.match(md, /## 🔍 Crash-Lens Failure Diagnostic/);
  assert.match(md, /<details><summary>Stack Trace<\/summary>/);
  assert.match(md, /`src\/index\.js:50`/);
});

test('formatJson: outputs valid JSON payload with summary and root causes', () => {
  const jsonStr = formatJson(mockClusters, mockMetrics);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.summary.rootCausesCount, 1);
  assert.equal(parsed.summary.totalErrorsFound, 3);
  assert.equal(parsed.rootCauses[0].file, 'src/index.js');
});

test('enforceBudget: caps clusters within given token limits', () => {
  const bigClusters = Array.from({ length: 10 }, (_, i) => ({
    ...mockClusters[0],
    id: `c_${i}`,
    title: `Error #${i}`
  }));

  const budgeted = enforceBudget(bigClusters, 200);
  assert.equal(budgeted.length < 10, true);
});
