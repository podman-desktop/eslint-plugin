/*******************************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 *******************************************************************************/

import type { Rule } from 'eslint';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let gitFileYears: Map<string, number> | undefined;
let gitDirtyFiles: Set<string> | undefined;
let gitRepoRoot: string | undefined;
let gitAvailable: boolean | undefined;
let prMode: boolean = false;
let prChangedFiles: Set<string> | undefined;

function isGitHubPR(): boolean {
  return process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'pull_request';
}

function getPRNumber(): string | undefined {
  // Extract PR number from GITHUB_REF (refs/pull/<number>/merge)
  const ref = process.env.GITHUB_REF;
  if (ref) {
    const match = /^refs\/pull\/(\d+)\/merge$/.exec(ref);
    if (match) return match[1];
  }
  // Fallback: read from event payload
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const event = JSON.parse(readFileSync(eventPath, 'utf-8'));
      if (event?.pull_request?.number) return String(event.pull_request.number);
    } catch {
      // ignore
    }
  }
  return undefined;
}

function loadPRChangedFiles(root: string): boolean {
  if (!isGitHubPR()) return false;

  const prNumber = getPRNumber();
  if (!prNumber) return false;

  const repo = process.env.GITHUB_REPOSITORY;
  try {
    const args = ['pr', 'view', prNumber, '--json', 'files'];
    if (repo) {
      args.push('--repo', repo);
    }
    const output = execFileSync('gh', args, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    const data = JSON.parse(output);
    const changedSet = new Set<string>();
    if (Array.isArray(data.files)) {
      for (const file of data.files) {
        if (file.path) {
          changedSet.add(resolve(root, file.path));
        }
      }
    }
    prChangedFiles = changedSet;
    prMode = true;
    return true;
  } catch {
    return false;
  }
}

function loadGitFileYears(): void {
  if (gitAvailable !== undefined) return;
  try {
    gitRepoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
    gitAvailable = true;
  } catch {
    gitAvailable = false;
    return;
  }

  // In GitHub Actions PR mode, use gh to get changed files and skip git log
  if (loadPRChangedFiles(gitRepoRoot)) {
    return;
  }

  const map = new Map<string, number>();
  gitFileYears = map;
  const root = gitRepoRoot;
  try {
    const output = execFileSync(
      'git',
      ['log', '--format=format:COMMIT:%ad', '--date=format:%Y', '--name-only', '--diff-filter=ACDMRT'],
      { stdio: 'pipe', encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
    );
    let currentYear: number | undefined;
    for (const line of output.split('\n')) {
      if (!line) continue;
      if (line.startsWith('COMMIT:')) {
        currentYear = Number(line.slice(7));
        continue;
      }
      if (currentYear !== undefined) {
        const absPath = resolve(root, line);
        if (!map.has(absPath)) {
          map.set(absPath, currentYear);
        }
      }
    }
  } catch {
    gitAvailable = false;
  }

  const dirtySet = new Set<string>();
  gitDirtyFiles = dirtySet;
  try {
    const statusOutput = execFileSync('git', ['status', '--porcelain'], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    for (const statusLine of statusOutput.split('\n')) {
      if (!statusLine || statusLine.length < 4) continue;
      const filePart = statusLine.slice(3);
      const arrowIndex = filePart.indexOf(' -> ');
      const file = arrowIndex !== -1 ? filePart.slice(arrowIndex + 4) : filePart;
      dirtySet.add(resolve(root, file));
    }
  } catch {
    // If status fails, treat all files as clean
  }
}

export function _resetGitRepoCache(): void {
  gitFileYears = undefined;
  gitDirtyFiles = undefined;
  gitRepoRoot = undefined;
  gitAvailable = undefined;
  prMode = false;
  prChangedFiles = undefined;
}

const TEMPLATE_LINES = [
  'Copyright (C) {year} Red Hat, Inc.',
  '',
  'Licensed under the Apache License, Version 2.0 (the "License");',
  'you may not use this file except in compliance with the License.',
  'You may obtain a copy of the License at',
  '',
  '    http://www.apache.org/licenses/LICENSE-2.0',
  '',
  'Unless required by applicable law or agreed to in writing, software',
  'distributed under the License is distributed on an "AS IS" BASIS,',
  'WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
  'See the License for the specific language governing permissions and',
  'limitations under the License.',
  '',
  'SPDX-License-Identifier: Apache-2.0',
];

const COPYRIGHT_REGEX = /Copyright \(C\) (\d{4})(?:[-,\s]+(\d{4}))* (.+)/;

function getFileYear(filename: string): number {
  loadGitFileYears();
  // In PR mode, all checked files must have current year
  if (prMode) {
    return new Date().getFullYear();
  }
  const absPath = resolve(filename);
  if (gitDirtyFiles?.has(absPath)) {
    return new Date().getFullYear();
  }
  const gitYear = gitFileYears?.get(absPath);
  if (gitYear !== undefined) {
    return gitYear;
  }
  const stats = lstatSync(filename, { throwIfNoEntry: false });
  return stats ? stats.mtime.getFullYear() : new Date().getFullYear();
}

function isYmlFile(filename: string): boolean {
  return /\.ya?ml$/i.test(filename);
}

const SKIPPED_EXTENSIONS = /\.(svelte|md)$/i;

function isSkippedFile(filename: string): boolean {
  return SKIPPED_EXTENSIONS.test(filename);
}

function formatHeader(year: string, filename: string): string {
  const lines = TEMPLATE_LINES.map(line => line.replace('{year}', year));

  if (isYmlFile(filename)) {
    const separator = '#' + '*'.repeat(79);
    const content = lines.map(line => (line === '' ? '#' : `# ${line}`)).join('\n');
    return `${separator}\n${content}\n${separator}\n\n`;
  }

  const separator = '*'.repeat(79);
  const content = lines.map(line => (line === '' ? ' *' : ` * ${line}`)).join('\n');
  return `/${separator}\n${content}\n ${separator}/\n\n`;
}

const copyrightRule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require Apache 2.0 copyright header in source files',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingHeader: 'Missing copyright header.',
      outdatedYear: 'Copyright year is outdated.',
    },
  },

  create(context) {
    const filename = context.filename;

    // Fix 1: Skip files before any I/O
    if (isSkippedFile(filename)) {
      return {};
    }

    // In PR mode, skip files not modified in the PR
    loadGitFileYears();
    if (prMode && !prChangedFiles?.has(resolve(filename))) {
      return {};
    }

    // Fix 2: Defer filesystem I/O — only resolve when needed
    let expectedYear: number | undefined;
    function resolveExpectedYear(): number {
      if (expectedYear === undefined) {
        expectedYear = getFileYear(filename);
      }
      return expectedYear;
    }

    return {
      Program(node) {
        const sourceCode = context.sourceCode;
        const text = sourceCode.getText();

        // Only scan first ~30 lines for copyright header
        const firstLines = text.split('\n').slice(0, 30).join('\n');

        const match = COPYRIGHT_REGEX.exec(firstLines);

        if (!match) {
          // No copyright header found — fix uses current year since the fix itself modifies the file
          context.report({
            node,
            messageId: 'missingHeader',
            fix(fixer) {
              const header = formatHeader(String(new Date().getFullYear()), filename);
              return fixer.insertTextBeforeRange([0, 0], header);
            },
          });
          return;
        }

        const startYear = Number.parseInt(match[1], 10);
        const endYear = match[2] ? Number.parseInt(match[2], 10) : null;
        const latestYear = endYear ?? startYear;

        // Short-circuit: if header year is current or future, no git lookup needed
        const thisYear = new Date().getFullYear();
        if (latestYear >= thisYear) {
          return;
        }

        const fileYear = resolveExpectedYear();

        // Check if year already matches or exceeds the file's modification year
        if (latestYear >= fileYear) {
          return; // Already up to date
        }

        // Year is outdated — fix it
        const fullTextMatchIndex = text.indexOf(match[0]);
        if (fullTextMatchIndex === -1) return;

        // Extract the actual year portion from the match (handles spaces around dash)
        const yearPartOffset = 'Copyright (C) '.length;
        const holderLen = match[3].length + 1; // +1 for the space before holder
        const absoluteStart = fullTextMatchIndex + yearPartOffset;
        const absoluteEnd = fullTextMatchIndex + match[0].length - holderLen;

        const newYearPart = startYear === thisYear ? String(thisYear) : `${startYear}-${thisYear}`;

        context.report({
          node,
          messageId: 'outdatedYear',
          fix(fixer) {
            return fixer.replaceTextRange([absoluteStart, absoluteEnd], newYearPart);
          },
        });
      },
    };
  },
};

export default copyrightRule;
