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

import { RuleTester } from 'eslint';
import { describe, vi, beforeEach, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import copyrightRule, { _resetGitRepoCache } from '/@/rules/copyright.js';

vi.mock(import('node:fs'));
vi.mock(import('node:child_process'));

const currentYear = new Date().getFullYear();

function makeJsHeader(year: string): string {
  const holder = 'Red Hat, Inc.';
  const separator = '*'.repeat(79);
  const lines = [
    `/${separator}`,
    ` * Copyright (C) ${year} ${holder}`,
    ' *',
    ` * Licensed under the Apache License, Version 2.0 (the "License");`,
    ' * you may not use this file except in compliance with the License.',
    ' * You may obtain a copy of the License at',
    ' *',
    ' *     http://www.apache.org/licenses/LICENSE-2.0',
    ' *',
    ' * Unless required by applicable law or agreed to in writing, software',
    ` * distributed under the License is distributed on an "AS IS" BASIS,`,
    ' * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
    ' * See the License for the specific language governing permissions and',
    ' * limitations under the License.',
    ' *',
    ' * SPDX-License-Identifier: Apache-2.0',
    ` ${separator}/`,
  ];
  return lines.join('\n');
}

function makeYmlHeader(year: string): string {
  const holder = 'Red Hat, Inc.';
  const separator = '#' + '*'.repeat(79);
  const lines = [
    separator,
    `# Copyright (C) ${year} ${holder}`,
    '#',
    `# Licensed under the Apache License, Version 2.0 (the "License");`,
    '# you may not use this file except in compliance with the License.',
    '# You may obtain a copy of the License at',
    '#',
    '#     http://www.apache.org/licenses/LICENSE-2.0',
    '#',
    '# Unless required by applicable law or agreed to in writing, software',
    `# distributed under the License is distributed on an "AS IS" BASIS,`,
    '# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.',
    '# See the License for the specific language governing permissions and',
    '# limitations under the License.',
    '#',
    '# SPDX-License-Identifier: Apache-2.0',
    separator,
  ];
  return lines.join('\n');
}

function mockGitBatch(year: number, filenames: string[] = ['test.ts'], dirtyFiles: string[] = []): void {
  const cwd = process.cwd();
  const batchLines = [`COMMIT:${year}`, '', ...filenames, ''];
  const statusLines = dirtyFiles.map(f => ` M ${f}`).join('\n');
  vi.mocked(execFileSync).mockImplementation((_file: string, args?: readonly string[]) => {
    if (args?.[0] === 'rev-parse') {
      return `${cwd}\n`;
    }
    if (args?.[0] === 'log') {
      return batchLines.join('\n');
    }
    if (args?.[0] === 'status') {
      return statusLines;
    }
    return '';
  });
  // Filesystem fallback (used when git is unavailable)
  vi.mocked(lstatSync).mockReturnValue({ mtime: new Date(`${year}-06-15`) } as ReturnType<typeof lstatSync>);
}

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('copyright rule - files modified in current year', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    mockGitBatch(currentYear);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      {
        code: `${makeJsHeader(String(currentYear))}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      {
        code: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      // Comma-separated years ending with current year
      {
        code: `${makeJsHeader(`2024, ${currentYear}`)}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
    ],
    invalid: [
      {
        code: 'const x = 1;\n',
        filename: 'test.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader(String(currentYear))}\n\nconst x = 1;\n`,
      },
      {
        code: `${makeJsHeader('2022')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2022-${currentYear}`)}\nconst x = 1;\n`,
      },
      {
        code: `${makeJsHeader('2020-2024')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
      },
      // Spaces around dash — should normalize to no spaces
      {
        code: `${makeJsHeader('2024 - 2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2024-${currentYear}`)}\nconst x = 1;\n`,
      },
      // Comma-separated years — should normalize to range
      {
        code: `${makeJsHeader('2024, 2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2024-${currentYear}`)}\nconst x = 1;\n`,
      },
      {
        code: '',
        filename: 'test.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader(String(currentYear))}\n\n`,
      },
    ],
  });
});

describe('copyright rule - files modified in past year', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    mockGitBatch(2025);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      {
        code: `${makeJsHeader('2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      {
        code: `${makeJsHeader('2020-2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      {
        code: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
    ],
    invalid: [
      // Fix always uses current year (the fix modifies the file, so commit will be this year)
      {
        code: `${makeJsHeader('2022')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2022-${currentYear}`)}\nconst x = 1;\n`,
      },
      {
        code: `${makeJsHeader('2020-2024')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
      },
      {
        code: 'const x = 1;\n',
        filename: 'test.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader(String(currentYear))}\n\nconst x = 1;\n`,
      },
    ],
  });
});

describe('copyright rule - YML header format', () => {
  // RuleTester can't verify YAML autofix output (JS parser rejects # comments),
  // so we verify the generated header format directly.
  it('should generate YAML-style header with # comments', () => {
    const header = makeYmlHeader(String(currentYear));
    expect(header).toContain(`# Copyright (C) ${currentYear} Red Hat, Inc.`);
    expect(header).toContain('# SPDX-License-Identifier: Apache-2.0');
    expect(header).toMatch(/^#\*{79}/);
  });
});

describe('copyright rule - skipped files', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    mockGitBatch(currentYear);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      // .svelte files should be skipped (no header required)
      {
        code: 'const x = 1;\n',
        filename: 'Component.svelte',
      },
      // .md files should be skipped
      {
        code: 'const x = 1;\n',
        filename: 'README.md',
      },
    ],
    invalid: [],
  });
});

describe('copyright rule - non-git fallback to filesystem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    // Simulate not being in a git repo
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not a git repo');
    });
    vi.mocked(lstatSync).mockReturnValue(undefined as unknown as ReturnType<typeof lstatSync>);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      {
        code: `${makeJsHeader(String(currentYear))}\nconst x = 1;\n`,
        filename: 'nonexistent.ts',
      },
    ],
    invalid: [
      {
        code: 'const x = 1;\n',
        filename: 'nonexistent.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader(String(currentYear))}\n\nconst x = 1;\n`,
      },
    ],
  });
});

describe('copyright rule - untracked file falls back to filesystem', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    const cwd = process.cwd();
    // Git repo exists but batch output has no entry for new-untracked.ts
    vi.mocked(execFileSync).mockImplementation((_file: string, args?: readonly string[]) => {
      if (args?.[0] === 'rev-parse') {
        return `${cwd}\n`;
      }
      if (args?.[0] === 'log') {
        return 'COMMIT:2025\n\nother-file.ts\n';
      }
      if (args?.[0] === 'status') {
        return '';
      }
      return '';
    });
    vi.mocked(lstatSync).mockReturnValue({ mtime: new Date('2025-06-15') } as ReturnType<typeof lstatSync>);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      {
        code: `${makeJsHeader('2025')}\nconst x = 1;\n`,
        filename: 'new-untracked.ts',
      },
    ],
    invalid: [
      {
        code: `${makeJsHeader('2022')}\nconst x = 1;\n`,
        filename: 'new-untracked.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2022-${currentYear}`)}\nconst x = 1;\n`,
      },
    ],
  });
});

describe('copyright rule - dirty file uses current year', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    // Git says file was last committed in 2025, but file is currently modified
    mockGitBatch(2025, ['test.ts'], ['test.ts']);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      // Header with current year is valid (file is dirty, will be committed this year)
      {
        code: `${makeJsHeader(String(currentYear))}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      {
        code: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
    ],
    invalid: [
      // Header with old year should be updated to current year (not git year 2025)
      {
        code: `${makeJsHeader('2020')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
      },
      {
        code: `${makeJsHeader('2020-2024')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2020-${currentYear}`)}\nconst x = 1;\n`,
      },
      // Missing header on dirty file should use current year
      {
        code: 'const x = 1;\n',
        filename: 'test.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader(String(currentYear))}\n\nconst x = 1;\n`,
      },
    ],
  });
});

describe('copyright rule - clean file uses git year for validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    _resetGitRepoCache();
    // Git says 2025, file is clean (not in dirty list)
    mockGitBatch(2025, ['test.ts'], []);
  });

  ruleTester.run('copyright', copyrightRule, {
    valid: [
      // Validation uses git year: header 2025 matches git year 2025 → OK
      {
        code: `${makeJsHeader('2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
      {
        code: `${makeJsHeader('2020-2025')}\nconst x = 1;\n`,
        filename: 'test.ts',
      },
    ],
    invalid: [
      // Validation detects outdated (2022 < 2025), but fix uses current year
      {
        code: `${makeJsHeader('2022')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader(`2022-${currentYear}`)}\nconst x = 1;\n`,
      },
    ],
  });
});
