# AGENTS.md

This document provides guidance for AI coding agents (GitHub Copilot, Claude, etc.) working in this repository.

## Project Overview

**harvester-ui-extension** is a [Rancher UI Extension](https://extensions.rancher.io/) that provides the user interface for [Harvester](https://harvesterhci.io) (a hyperconverged infrastructure platform) within [Rancher Dashboard](https://github.com/rancher/dashboard).

- Requires Rancher **2.10.0** or later
- Available as both a Rancher extension and a standalone UI bundle
- Manages virtual machines, volumes, storage, networking, backups, and monitoring

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript + JavaScript |
| Framework | Vue 3 (via `@rancher/shell`) |
| Build tool | Vue CLI Service (Webpack) |
| Package manager | Yarn |
| Node version | ≥ 20.0.0 (see `.nvmrc`) |
| Linter | ESLint |
| Commit linting | commitlint (conventional commits) |
| Git hooks | Husky |

Key dependencies: `@rancher/shell`, `@vue-flow/*` (graph visualisation), `vue-draggable-next`, `elkjs`, `yaml`.

## Repository Structure

```
harvester-ui-extension/
├── pkg/harvester/               # Main extension source
│   ├── index.ts                 # Plugin entry point (registers routes, stores, components)
│   ├── types.ts                 # TypeScript definitions for ~50 HCI resource types
│   ├── routing/
│   │   └── harvester-routing.ts # Route definitions for all pages and resources
│   ├── config/
│   │   ├── harvester.ts         # Core constants and configuration
│   │   ├── harvester-cluster.js # Product/cluster configuration
│   │   ├── settings.ts          # Settings definitions
│   │   ├── table-headers.js     # Column definitions for list views
│   │   └── feature-flags.js     # Feature flag definitions
│   ├── models/                  # Kubernetes resource model classes (~40+ files)
│   │   │                        # Naming: <group>.<domain>.<resource>.js
│   │   └── harvesterhci.io.virtualmachine.js  # (example)
│   ├── components/              # Reusable Vue components
│   ├── pages/                   # Full-page list/overview components
│   ├── detail/                  # Resource detail/view pages
│   ├── edit/                    # Resource create/edit form pages
│   ├── dialog/                  # Modal and dialog components
│   ├── list/                    # List view templates
│   ├── store/                   # Vuex store modules
│   │   ├── harvester-common.js  # Common state
│   │   └── harvester-store/     # Feature-specific store modules
│   ├── utils/                   # Shared utility functions
│   ├── validators/              # Form validation logic
│   ├── formatters/              # UI value formatters
│   ├── mixins/                  # Vue mixins
│   ├── styles/                  # SCSS/CSS
│   ├── l10n/
│   │   └── en-us.yaml           # All UI strings (i18n)
│   ├── package.json             # Package-level metadata
│   ├── tsconfig.json            # TypeScript config (package level)
│   └── vue.config.js            # Vue CLI config (package level)
├── scripts/                     # Build and release helper scripts
├── .github/
│   ├── actions/
│   │   ├── setup/               # Node/Yarn setup reusable action
│   │   └── lint/                # Lint reusable action
│   └── workflows/               # CI/CD pipelines
├── .eslintrc.js                 # ESLint config (extends .eslintrc.default.js)
├── .eslintrc.default.js         # Default ESLint rules
├── .eslintignore                # ESLint ignore patterns
├── commitlint.config.js         # Commit message validation rules
├── tsconfig.json                # Root TypeScript config
├── vue.config.js                # Root Vue CLI config
├── babel.config.js              # Babel config
└── package.json                 # Root package (Yarn workspaces / scripts)
```

## Development Commands

### Install dependencies
```bash
yarn install
```
Husky git hooks are set up automatically during `yarn install` via the `prepare` script.

### Run in development mode

**Standalone mode** (recommended for UI development, hot reload at `https://localhost:8005`):
```bash
RANCHER_ENV=harvester API=https://<harvester-ip> yarn dev

# Or define variables in a .env file, then:
yarn dev
```

**.env file example:**
```env
RANCHER_ENV=harvester
VUE_APP_SERVER_VERSION=v1.5.0
API=https://192.168.1.123
```

**Rancher integration mode:**
```bash
API=https://<rancher-ip> yarn dev
```

### Build
```bash
yarn build          # Production build → dist/
yarn clean          # Remove build artifacts
yarn build-pkg      # Build as Helm package for Rancher extension
yarn serve-pkgs     # Serve packages locally for Rancher extension development
yarn publish-pkgs   # Publish packages
```

### Lint
```bash
yarn lint           # Report lint errors/warnings (0 warnings allowed — fails on any warning)
yarn lint:fix       # Auto-fix lint issues
```

Always run `yarn lint` after making changes to `.js`, `.ts`, or `.vue` files.

### Validate commit messages manually
```bash
yarn commitlint           # Validate the last commit
npx commitlint --from <hash>            # From a specific commit
npx commitlint --from <start> --to <end>  # Range
```

## Commit Message Format

This project enforces [Conventional Commits](https://www.conventionalcommits.org/). Commit messages **must** follow this format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Rules:**
- `type` must be one of: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `wip`, `deps`, `security`
- `scope` (optional) must be kebab-case
- `type` must be lower-case
- `description` must not end with a period
- Body and footer lines must not exceed 100 characters
- A blank line is required between body and footer
- Merge/revert commits are exempt

**Examples:**
```bash
git commit -m "feat: add new virtual machine creation wizard"
git commit -m "fix(vm): resolve memory leak in console component"
git commit -m "docs: update installation instructions"
git commit -m "feat!: change API endpoint structure

BREAKING CHANGE: /api/v1/vms replaced with /api/v2/vms"
```

## Code Style

ESLint with Vue 3 recommended rules and TypeScript support is enforced. Key rules:

- **Indentation:** 2 spaces
- **Quotes:** Single quotes (`'`), template literals allowed
- **Semicolons:** Required
- **Vue components:** Multi-word names required; no `v-html`
- **Max warnings:** 0 — any ESLint warning fails the build

The pre-commit Husky hook runs ESLint automatically before every commit.

## Naming Conventions

| Context | Convention |
|---|---|
| Variables / functions | camelCase |
| Constants | UPPER_CASE |
| Classes / Vue components | PascalCase |
| Vue component files | `PascalCase.vue` (e.g. `HarvesterUpgrade.vue`) |
| Model files | `<group>.<domain>.<resource>.js` (e.g. `harvesterhci.io.virtualmachine.js`) |
| Route/URL slugs | kebab-case |
| Commit scopes | kebab-case |

## Adding / Modifying Resource Models

Resource models live in `pkg/harvester/models/`. Each file exports a class that extends a Rancher shell base class and represents a Kubernetes CRD or resource type. The file name format is `<api-group>.<resource-kind>.js` (dots separate the group segments and the kind).

Resource types (string constants) are defined in `pkg/harvester/types.ts` under the `HCI` object.

## Localization

All user-visible strings must be added to `pkg/harvester/l10n/en-us.yaml`. Use the i18n utilities from `@rancher/shell` to render them in components.

## Branching Model

| Branch | Purpose |
|---|---|
| `main` | Main development branch |
| `release-harvester-vX.Y` | Stable release branch per version series |
| `vX.Y-head` | Auto-generated testing branch (kept in sync with release branch) |

## CI/CD

Workflows are in `.github/workflows/`. Key pipelines:

| Workflow | Trigger | Purpose |
|---|---|---|
| `run-lint.yaml` | Push/PR to `main`, `release-*` | ESLint + commitlint validation |
| `build-extension-on-merge.yml` | Push to `main`/`release-harvester-v*` | Build and publish extension Helm charts |
| `build-standalone-on-merge.yaml` | Push/PR merge | Build standalone UI bundle |
| `build-extension-on-release.yml` | Release published | Create release extension artifacts |
| `build-standalone-on-release.yaml` | Release published | Create release standalone artifacts |
| `build-extension-catalog.yml` | Dispatch / release | Build Docker catalog image |
| `backport-request.yaml` | PR labeled | Create backport PR |

## Testing

There is no automated unit/integration test suite. Validation is done by:

1. Running `yarn lint` — ensures code quality.
2. Manual testing via **standalone mode** (see Development Commands above).
3. Manual testing via **Rancher extension** (register via Rancher UI Repositories).

For testing a specific release series, use the corresponding `vX.Y-head` branch as the Rancher extension repository URL.

## TypeScript Path Aliases

| Alias | Resolves to |
|---|---|
| `~/` or `@/` | Project root |
| `@shell/` | `@rancher/shell` modules |

## License

Apache License 2.0. Copyright (c) 2014–2026 SUSE, LLC.
