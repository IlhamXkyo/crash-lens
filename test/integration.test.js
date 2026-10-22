import test from 'node:test';
import assert from 'node:assert/strict';
import { siftLogs } from '../src/index.js';

test('integration: end-to-end sifting with mixed logs, ANSI codes, and noise', () => {
  const noiseLines = Array.from({ length: 60 }, (_, i) => `2026-10-22T10:00:00.000Z \u001b[32m[===>       ] ${i}% downloaded pkg-${i}\u001b[0m`).join('\n');
  const rawLog = `
${noiseLines}
2026-10-22T10:00:03.000Z > test:integration
2026-10-22T10:00:04.000Z executing suite: auth_test
2026-10-22T10:00:05.000Z \u001b[31mTypeError: Cannot read properties of undefined (reading 'verify')\u001b[0m
2026-10-22T10:00:06.000Z     at Object.testAuth (/app/src/auth.js:25:10)
2026-10-22T10:00:07.000Z     at runner (/app/src/runner.js:100:5)
2026-10-22T10:00:08.000Z ✓ passing test A (1 ms)
2026-10-22T10:00:09.000Z ✓ passing test B (2 ms)
2026-10-22T10:00:10.000Z Process completed with exit code 1.
`;

  const result = siftLogs(rawLog, { format: 'markdown' });

  assert.equal(result.clusters.length >= 1, true);
  assert.equal(result.clusters[0].file, '/app/src/auth.js');
  assert.equal(result.clusters[0].line, 25);
  assert.equal(result.metrics.reductionPercent > 40, true);
  assert.match(result.output, /## 🔍 Crash-Lens Failure Diagnostic/);
  assert.match(result.output, /\/app\/src\/auth\.js:25/);
});

test('integration: clean log returns zero root causes', () => {
  const clean = `
npm test
✓ test 1 passed
✓ test 2 passed
All 2 tests passed!
`;
  const result = siftLogs(clean, { format: 'text' });
  assert.equal(result.clusters.length, 0);
  assert.match(result.output, /No failures or stack traces detected/);
});
