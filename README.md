# @podman-desktop/eslint-plugin

ESLint plugin with rules for Podman Desktop.

## Rules

### `@podman-desktop/eslint-plugin/copyright`

Requires an Apache 2.0 copyright header at the top of every source file.

- **Type:** suggestion
- **Fixable:** yes (auto-fix inserts or updates the header)
- **Skipped files:** `.svelte`, `.md`

**What it checks:**

1. **Missing header** -- reports `missingHeader` and auto-fixes by inserting a full Apache 2.0 header block.
2. **Outdated year** -- reports `outdatedYear` when the copyright year is older than the file's last-modified year, and auto-fixes by appending a year range (e.g. `2024-2026`).

The header format adapts to the file type:
- JS/TS files use `/* ... */` block comments.
- YAML files use `#` line comments.

## Usage

Install the plugin:

```sh
pnpm add -D @podman-desktop/eslint-plugin
```

Add it to your `eslint.config.js`:

```js
import podmanDesktopLinter from '@podman-desktop/eslint-plugin';

export default [
  podmanDesktopLinter.configs.recommended,
];
```

The `recommended` config enables the `copyright` rule as an error for `**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` files.

## Contributing

### Prerequisites

- Node.js >= 24
- pnpm

### Install dependencies

```sh
pnpm install
```

### Build

```sh
pnpm build
```

### Run tests

```sh
pnpm test
```

### Lint

```sh
# Check for lint issues
pnpm lint:check

# Auto-fix lint issues
pnpm lint:fix
```

### Format

```sh
# Check formatting
pnpm format:check

# Auto-fix formatting
pnpm format:fix
```

### Type-check

```sh
pnpm typecheck
```

### Pre-commit hook

A Husky pre-commit hook runs the build and `lint-staged` (which applies `eslint --fix` and `biome format --write` on staged files) automatically before each commit.
