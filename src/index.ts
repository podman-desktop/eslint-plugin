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

import type { ESLint, Linter } from 'eslint';
import packageJson from '/@package.json' with { type: 'json' };
import copyrightRule from '/@/rules/copyright.js';

const plugin: ESLint.Plugin = {
  meta: {
    name: '@podman-desktop/eslint-plugin',
    version: packageJson.version,
  },
  rules: {
    copyright: copyrightRule,
  },
  configs: {},
};

// Add recommended config referencing the plugin itself
const configs = plugin.configs as Record<string, Linter.Config>;
configs.recommended = {
  files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  plugins: {
    '@podman-desktop/eslint-plugin': plugin,
  },
  rules: {
    '@podman-desktop/eslint-plugin/copyright': 'error',
  },
};

export default plugin;
