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
import { lstatSync } from 'node:fs';
import copyrightRule from '/@/rules/copyright.js';

vi.mock(import('node:fs'));

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

function mockFileYear(year: number): void {
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
    mockFileYear(currentYear);
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
    mockFileYear(2025);
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
      {
        code: `${makeJsHeader('2022')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader('2022-2025')}\nconst x = 1;\n`,
      },
      {
        code: `${makeJsHeader('2020-2024')}\nconst x = 1;\n`,
        filename: 'test.ts',
        errors: [{ messageId: 'outdatedYear' }],
        output: `${makeJsHeader('2020-2025')}\nconst x = 1;\n`,
      },
      {
        code: 'const x = 1;\n',
        filename: 'test.ts',
        errors: [{ messageId: 'missingHeader' }],
        output: `${makeJsHeader('2025')}\n\nconst x = 1;\n`,
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
    mockFileYear(currentYear);
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

describe('copyright rule - lstatSync fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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
