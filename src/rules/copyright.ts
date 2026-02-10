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
import { lstatSync } from 'node:fs';

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
          // No copyright header found
          context.report({
            node,
            messageId: 'missingHeader',
            fix(fixer) {
              const header = formatHeader(String(resolveExpectedYear()), filename);
              return fixer.insertTextBeforeRange([0, 0], header);
            },
          });
          return;
        }

        const startYear = Number.parseInt(match[1], 10);
        const endYear = match[2] ? Number.parseInt(match[2], 10) : null;
        const latestYear = endYear ?? startYear;

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

        const newYearPart = startYear === fileYear ? String(fileYear) : `${startYear}-${fileYear}`;

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
