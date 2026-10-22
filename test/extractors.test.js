import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLog } from '../src/cleaner.js';
import { extractCrashes } from '../src/extractors.js';

test('extractCrashes: parses Node.js TypeError with stack frames and location', () => {
  const log = `
npm test
> run tests
TypeError: Cannot read properties of undefined (reading 'jwtSecret')
    at verifyToken (/app/src/auth/jwt.js:42:15)
    at handleRequest (/app/src/server.js:88:9)
    at processTicksAndRejections (node:internal/process/task_queues:95:5)
`;
  const lines = cleanLog(log);
  const crashes = extractCrashes(lines);

  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].type, 'node');
  assert.equal(crashes[0].file, '/app/src/auth/jwt.js');
  assert.equal(crashes[0].line, 42);
  assert.equal(crashes[0].column, 15);
  assert.match(crashes[0].title, /TypeError/);
  assert.equal(crashes[0].contextBefore.includes('> run tests'), true);
});

test('extractCrashes: parses Python Traceback with exception details', () => {
  const log = `
pytest
Traceback (most recent call last):
  File "/app/tests/test_api.py", line 55, in test_login
    resp = client.post("/auth/login", json=payload)
  File "/app/src/client.py", line 12, in post
    raise ConnectionRefusedError("Database unreachable")
ConnectionRefusedError: Database unreachable
`;
  const lines = cleanLog(log);
  const crashes = extractCrashes(lines);

  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].type, 'python');
  assert.equal(crashes[0].file, '/app/src/client.py');
  assert.equal(crashes[0].line, 12);
  assert.equal(crashes[0].title, 'ConnectionRefusedError: Database unreachable');
  assert.equal(crashes[0].stack.length >= 2, true);
});

test('extractCrashes: parses Rust thread panic', () => {
  const log = `
cargo test
running 1 test
thread 'main' panicked at 'called \`Option::unwrap()\` on a \`None\` value', src/service/worker.rs:88:14
note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace
`;
  const lines = cleanLog(log);
  const crashes = extractCrashes(lines);

  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].type, 'rust');
  assert.equal(crashes[0].file, 'src/service/worker.rs');
  assert.equal(crashes[0].line, 88);
  assert.equal(crashes[0].column, 14);
  assert.match(crashes[0].title, /Rust Panic/);
});

test('extractCrashes: parses Go panic with goroutine file trace', () => {
  const log = `
go test ./...
panic: runtime error: index out of range [4] with length 2
goroutine 1 [running]:
main.processTokens(...)
\t/go/src/app/tokenizer.go:73 +0x45
`;
  const lines = cleanLog(log);
  const crashes = extractCrashes(lines);

  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].type, 'go');
  assert.equal(crashes[0].file, '/go/src/app/tokenizer.go');
  assert.equal(crashes[0].line, 73);
  assert.match(crashes[0].title, /Go Panic/);
});

test('extractCrashes: parses Jest / Vitest test failure blocks with excerpts', () => {
  const log = `
FAIL tests/unit/auth.test.ts
  ● AuthModule › should reject expired tokens
    Expected: 401
    Received: 500
      > 45 |   expect(res.status).toBe(401);
           |                      ^
`;
  const lines = cleanLog(log);
  const crashes = extractCrashes(lines);

  assert.equal(crashes.length, 1);
  assert.equal(crashes[0].type, 'test_runner');
  assert.equal(crashes[0].file, 'tests/unit/auth.test.ts');
  assert.equal(crashes[0].rawSnippet.length >= 1, true);
});
