/**
 * Extractors module: Parses and normalizes stack traces and error blocks
 * across Node/JS/TS, Python, Rust, Go, and generic CLI/CI runners.
 */

// Node.js stack frame pattern: "    at Object.test (src/auth/jwt.ts:42:15)" or "    at src/auth/jwt.ts:42:15"
const NODE_STACK_LINE_REGEX = /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))/;

// Node.js error header: "TypeError: Cannot read properties of undefined (reading 'token')"
const NODE_ERROR_HEADER_REGEX = /^(?:[A-Za-z_$][A-Za-z0-9_$]*Error|Error|AssertionError|Uncaught\s+[A-Za-z0-9_$]+)(?:(?:\s*\[[A-Za-z0-9_]+\])?:|\s*:)\s*(.*)/;

// Python traceback header
const PY_TRACEBACK_HEADER_REGEX = /^Traceback\s+\(most\s+recent\s+call\s+last\):/;
// Python stack frame: '  File "/app/tests/test_api.py", line 45, in test_login'
const PY_STACK_LINE_REGEX = /^\s*File\s+"(.+?)",\s+line\s+(\d+)(?:,\s+in\s+(.+))?/;
// Python exception line: 'AssertionError: expected 200, got 500'
const PY_EXCEPTION_REGEX = /^([a-zA-Z_][a-zA-Z0-9_]*(?:Error|Exception|Warning|Interrupt|Exit)):\s*(.*)/;

// Rust panic: "thread 'main' panicked at 'called `Option::unwrap()` on a `None` value', src/lib.rs:42:10"
const RUST_PANIC_REGEX = /thread\s+'(.+?)'\s+panicked\s+at\s+'(.+?)',\s+(.+?):(\d+):(\d+)/;
// Rust compiler error: "error[E0308]: mismatched types"
const RUST_COMPILER_REGEX = /^error(?:\[E\d+\])?:\s*(.*)/;
const RUST_LOCATION_REGEX = /^\s*-->\s+(.+?):(\d+):(\d+)/;

// Go panic: "panic: runtime error: index out of range [3] with length 2"
const GO_PANIC_REGEX = /^panic:\s*(.*)/;
// Go stack line: "main.main()\n\t/app/main.go:12 +0x24"
const GO_STACK_FILE_REGEX = /^\s*(.+?\.(?:go)):(\d+)(?:\s+\+0x[0-9a-f]+)?/;

// Jest / Vitest markers
const JEST_FAIL_HEADER_REGEX = /^(?:FAIL|✕|●)\s+(.+)/;
// Pytest marker: "FAILED tests/test_auth.py::test_login - AssertionError"
const PYTEST_FAIL_REGEX = /^FAILED\s+([^\s:]+)(?:::([^\s]+))?(?:\s+-\s+(.*))?/;

/**
 * Parses cleaned log lines into structured CrashReport items.
 * @param {Array<{ rawIndex: number, text: string, isNoise: boolean }>} lines
 * @param {number} contextWindow - lines of preceding context to capture
 * @returns {Array<CrashReport>}
 */
export function extractCrashes(lines, contextWindow = 3) {
  const crashes = [];
  const total = lines.length;
  let i = 0;

  function getBreadcrumbs(startIndex, count) {
    const crumbs = [];
    let idx = startIndex - 1;
    while (idx >= 0 && crumbs.length < count) {
      if (!lines[idx].isNoise && lines[idx].text.trim().length > 0) {
        crumbs.unshift(lines[idx].text);
      }
      idx--;
    }
    return crumbs;
  }

  while (i < total) {
    if (lines[i].isNoise) {
      i++;
      continue;
    }

    const currentText = lines[i].text;

    // 1. Rust Panic Check
    const rustPanicMatch = currentText.match(RUST_PANIC_REGEX);
    if (rustPanicMatch) {
      const thread = rustPanicMatch[1];
      const message = rustPanicMatch[2];
      const file = rustPanicMatch[3];
      const lineNum = parseInt(rustPanicMatch[4], 10);
      const colNum = parseInt(rustPanicMatch[5], 10);

      crashes.push({
        id: `rust_panic:${file}:${lineNum}:${message.slice(0, 50)}`,
        type: 'rust',
        title: `Rust Panic (thread '${thread}'): ${message}`,
        message,
        file,
        line: lineNum,
        column: colNum,
        stack: [currentText],
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: []
      });
      i++;
      continue;
    }

    // 2. Rust Compiler Error Check
    const rustCompMatch = currentText.match(RUST_COMPILER_REGEX);
    if (rustCompMatch) {
      const message = rustCompMatch[1];
      let file = null;
      let lineNum = null;
      let colNum = null;
      const snippet = [];

      let j = i + 1;
      while (j < total && j < i + 12) {
        const nextText = lines[j].text;
        const locMatch = nextText.match(RUST_LOCATION_REGEX);
        if (locMatch && !file) {
          file = locMatch[1];
          lineNum = parseInt(locMatch[2], 10);
          colNum = parseInt(locMatch[3], 10);
        }
        if (/^\s*\d+\s*\|/.test(nextText) || /^\s*\|\s*\^/.test(nextText)) {
          snippet.push(nextText);
        }
        if (nextText.trim().length === 0 || RUST_COMPILER_REGEX.test(nextText)) {
          break;
        }
        j++;
      }

      crashes.push({
        id: `rust_compile:${file || 'unknown'}:${lineNum || 0}:${message.slice(0, 50)}`,
        type: 'rust',
        title: `Rust Error: ${message}`,
        message,
        file,
        line: lineNum,
        column: colNum,
        stack: file ? [`--> ${file}:${lineNum}:${colNum}`] : [],
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: snippet
      });
      i = j;
      continue;
    }

    // 3. Python Traceback Check
    if (PY_TRACEBACK_HEADER_REGEX.test(currentText)) {
      const stack = [];
      let file = null;
      let lineNum = null;
      let excMessage = 'Python Exception';
      let excType = 'Exception';
      let j = i + 1;

      while (j < total) {
        const lineStr = lines[j].text;
        const frameMatch = lineStr.match(PY_STACK_LINE_REGEX);
        if (frameMatch) {
          file = frameMatch[1];
          lineNum = parseInt(frameMatch[2], 10);
          const func = frameMatch[3] ? ` in ${frameMatch[3]}` : '';
          stack.push(`  File "${file}", line ${lineNum}${func}`);
        } else {
          const excMatch = lineStr.match(PY_EXCEPTION_REGEX);
          if (excMatch) {
            excType = excMatch[1];
            excMessage = excMatch[2] ? `${excType}: ${excMatch[2]}` : excType;
            j++;
            break;
          } else if (lineStr.trim().length === 0 || j > i + 50) {
            break;
          }
        }
        j++;
      }

      crashes.push({
        id: `python:${file || 'unknown'}:${lineNum || 0}:${excMessage.slice(0, 50)}`,
        type: 'python',
        title: excMessage,
        message: excMessage,
        file,
        line: lineNum,
        column: null,
        stack,
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: []
      });
      i = j;
      continue;
    }

    // 4. Pytest Failure Summary Check
    const pytestMatch = currentText.match(PYTEST_FAIL_REGEX);
    if (pytestMatch) {
      const file = pytestMatch[1];
      const testName = pytestMatch[2] || '';
      const reason = pytestMatch[3] || 'Test assertion failed';

      crashes.push({
        id: `pytest:${file}:${testName}`,
        type: 'python',
        title: `Pytest Failure: ${testName || file}`,
        message: reason,
        file,
        line: null,
        column: null,
        stack: [currentText],
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: []
      });
      i++;
      continue;
    }

    // 5. Go Panic Check
    const goPanicMatch = currentText.match(GO_PANIC_REGEX);
    if (goPanicMatch) {
      const message = goPanicMatch[1];
      let file = null;
      let lineNum = null;
      const stack = [];
      let j = i + 1;

      while (j < total && j < i + 30) {
        const lineStr = lines[j].text;
        const goFileMatch = lineStr.match(GO_STACK_FILE_REGEX);
        if (goFileMatch) {
          if (!file) {
            file = goFileMatch[1];
            lineNum = parseInt(goFileMatch[2], 10);
          }
          stack.push(lineStr.trim());
        }
        if (lineStr.trim().length === 0 && stack.length > 0) {
          break;
        }
        j++;
      }

      crashes.push({
        id: `go_panic:${file || 'unknown'}:${lineNum || 0}:${message.slice(0, 50)}`,
        type: 'go',
        title: `Go Panic: ${message}`,
        message,
        file,
        line: lineNum,
        column: null,
        stack,
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: []
      });
      i = j;
      continue;
    }

    // 6. Node.js / V8 Error Header Check
    const nodeErrMatch = currentText.match(NODE_ERROR_HEADER_REGEX);
    if (nodeErrMatch) {
      const title = currentText.trim();
      const message = nodeErrMatch[1] || title;
      const stack = [];
      let file = null;
      let lineNum = null;
      let colNum = null;
      let j = i + 1;

      while (j < total && j < i + 35) {
        const lineStr = lines[j].text;
        const stackMatch = lineStr.match(NODE_STACK_LINE_REGEX);
        if (stackMatch) {
          const fn = stackMatch[1] || '';
          const f = stackMatch[2] || stackMatch[5];
          const l = parseInt(stackMatch[3] || stackMatch[6], 10);
          const c = parseInt(stackMatch[4] || stackMatch[7], 10);

          if (!file && !f.includes('node:internal') && !f.includes('node_modules')) {
            file = f;
            lineNum = l;
            colNum = c;
          }
          stack.push(lineStr.trim());
        } else if (lineStr.trim().length === 0 || lines[j].isNoise) {
          if (stack.length > 0) break;
        } else if (!lineStr.startsWith('    ') && stack.length > 0) {
          break;
        }
        j++;
      }

      if (stack.length > 0 || file) {
        crashes.push({
          id: `node:${file || 'unknown'}:${lineNum || 0}:${title.slice(0, 50)}`,
          type: 'node',
          title,
          message,
          file,
          line: lineNum,
          column: colNum,
          stack,
          contextBefore: getBreadcrumbs(i, contextWindow),
          rawSnippet: []
        });
        i = j;
        continue;
      }
    }

    // 7. Jest / Vitest Fail Header Check
    const jestMatch = currentText.match(JEST_FAIL_HEADER_REGEX);
    if (jestMatch) {
      const testTarget = jestMatch[1].trim();
      const snippet = [];
      let message = 'Test failed';
      let j = i + 1;

      while (j < total && j < i + 20) {
        const nextStr = lines[j].text;
        if (/^\s*Expected:/.test(nextStr) || /^\s*Received:/.test(nextStr) || /^\s*Error:/.test(nextStr)) {
          message = nextStr.trim();
        }
        if (/^\s*>\s*\d+\s*\|/.test(nextStr) || /^\s*\|\s*\^/.test(nextStr)) {
          snippet.push(nextStr);
        }
        if (JEST_FAIL_HEADER_REGEX.test(nextStr)) {
          break;
        }
        j++;
      }

      crashes.push({
        id: `test_runner:${testTarget}:${message.slice(0, 50)}`,
        type: 'test_runner',
        title: `Test Suite Failure: ${testTarget}`,
        message,
        file: testTarget.split(/\s+/)[0],
        line: null,
        column: null,
        stack: [],
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: snippet
      });
      i = j;
      continue;
    }

    // 8. General Fatal Exit / Process Failure Check
    if (/Process completed with exit code [1-9]\d*/i.test(currentText) ||
        /Command failed with exit code [1-9]\d*/i.test(currentText) ||
        /npm ERR! code/i.test(currentText)) {
      crashes.push({
        id: `ci_exit:${i}:${currentText.slice(0, 40)}`,
        type: 'generic',
        title: 'CI Exit Code Failure',
        message: currentText.trim(),
        file: null,
        line: null,
        column: null,
        stack: [currentText.trim()],
        contextBefore: getBreadcrumbs(i, contextWindow),
        rawSnippet: []
      });
    }

    i++;
  }

  return crashes;
}
