import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessage, makeClusterKey, clusterCrashes } from '../src/cluster.js';

test('normalizeMessage: strips memory addresses, ports, and uuids', () => {
  const raw = 'Failed to connect to 127.0.0.1:5432 at 0x7fff56a1b0 for request c4a896d0-9d2a-4a6c-9c76-2f1f3e792ef6';
  const norm = normalizeMessage(raw);
  assert.equal(norm, 'Failed to connect to 127.0.0.1:<port> at 0x<addr> for request <uuid>');
});

test('clusterCrashes: groups identical stack traces and counts occurrences', () => {
  const crashes = [
    {
      type: 'node',
      title: 'ConnectionRefusedError: port 5432 closed',
      message: 'ConnectionRefusedError: port 5432 closed',
      file: 'src/db.ts',
      line: 22,
      column: 5,
      stack: ['at connect (src/db.ts:22:5)'],
      contextBefore: ['test 1']
    },
    {
      type: 'node',
      title: 'ConnectionRefusedError: port 5432 closed',
      message: 'ConnectionRefusedError: port 5432 closed',
      file: 'src/db.ts',
      line: 22,
      column: 5,
      stack: ['at connect (src/db.ts:22:5)'],
      contextBefore: ['test 2']
    },
    {
      type: 'node',
      title: 'TypeError: Cannot read properties of null',
      message: 'TypeError: Cannot read properties of null',
      file: 'src/helper.ts',
      line: 10,
      column: 2,
      stack: ['at parse (src/helper.ts:10:2)'],
      contextBefore: ['test 3']
    }
  ];

  const clusters = clusterCrashes(crashes);
  assert.equal(clusters.length, 2);

  // Top ranked is the one with 2 occurrences
  assert.equal(clusters[0].occurrences, 2);
  assert.equal(clusters[0].file, 'src/db.ts');
  assert.equal(clusters[1].occurrences, 1);
  assert.equal(clusters[1].file, 'src/helper.ts');
});
