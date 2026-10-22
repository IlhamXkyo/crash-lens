import test from 'node:test';
import assert from 'node:assert/strict';
import { stripAnsi, stripTimestamp, isNoiseLine, cleanLog } from '../src/cleaner.js';

test('stripAnsi: removes standard color codes and cursor escape codes', () => {
  const colored = '\u001b[31mError:\u001b[39m \u001b[1mFailed\u001b[22m';
  assert.equal(stripAnsi(colored), 'Error: Failed');

  const cursorCode = '\u001b[2K\u001b[1GRunning...';
  assert.equal(stripAnsi(cursorCode), 'Running...');
});

test('stripTimestamp: removes ISO, GitHub Actions, and bracket timestamps', () => {
  const gha = '2026-10-22T21:40:15.1234567Z FAIL src/auth.test.ts';
  assert.equal(stripTimestamp(gha), 'FAIL src/auth.test.ts');

  const standardIso = '2026-10-22 21:40:15 [ERROR] database crashed';
  assert.equal(stripTimestamp(standardIso), 'database crashed');

  const brackets = '[21:40:15] build failed';
  assert.equal(stripTimestamp(brackets), 'build failed');
});

test('isNoiseLine: identifies progress bars, spinners, and routine fetch spam', () => {
  assert.equal(isNoiseLine('[===>     ] 45%'), true);
  assert.equal(isNoiseLine('45% [====>    ]'), true);
  assert.equal(isNoiseLine('⠋ downloading registry dependencies...'), true);
  assert.equal(isNoiseLine('npm http fetch GET https://registry.npmjs.org/...'), true);
  assert.equal(isNoiseLine('✓ should do something (2 ms)'), true);

  assert.equal(isNoiseLine('TypeError: Cannot read properties of undefined'), false);
  assert.equal(isNoiseLine('    at run (/app/main.js:12:4)'), false);
});

test('cleanLog: returns cleaned structured lines with original indices', () => {
  const sample = [
    '2026-10-22T21:40:15.123Z \u001b[32m[===>] 100%\u001b[0m',
    '2026-10-22T21:40:16.123Z \u001b[31mError: Boom\u001b[0m'
  ].join('\n');

  const cleaned = cleanLog(sample);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].isNoise, true);
  assert.equal(cleaned[1].isNoise, false);
  assert.equal(cleaned[1].text, 'Error: Boom');
  assert.equal(cleaned[1].rawIndex, 2);
});
