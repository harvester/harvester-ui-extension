## Tools

### Prerequisites

- **Node.js**: `>= 24.0.0` (see `.nvmrc` for the pinned version: `24`)
- **Package manager**: `yarn` (v1 classic)

### Common Commands

| Command | Description |
|---------|-------------|
| `yarn install --frozen-lockfile` | Install dependencies (CI-safe, no lockfile changes) |
| `RANCHER_ENV=harvester API=https://<harvester-ip> yarn dev` | Start development server at `https://127.0.0.1:8005` |
| `yarn build-pkg harvester` | Build the Harvester extension package |
| `yarn serve-pkgs` | Serve the locally built extension for testing |
| `yarn lint` | Run ESLint (zero warnings allowed) |
| `yarn lint:fix` | Run ESLint with auto-fix |
| `yarn test` | Run the unit tests (Jest) in watch mode |
| `yarn test:ci` | Run the unit tests once, as CI does (silent) |
| `yarn clean` | Clean build artifacts |
| `yarn agents:generate` | Regenerate `AGENTS.md` from `docs/agents.md/` sources |

### Development

- **Start dev server**:
  ```bash
  RANCHER_ENV=harvester API=https://your-harvester-ip yarn dev
  ```
  - `API` should point to a running Harvester cluster (e.g., `https://x.x.x.x`).
  - The dashboard will be available at `https://127.0.0.1:8005`.

### Building

- **Build extension package**:
  ```bash
  yarn build-pkg harvester
  ```
- **Serve locally built extension** (for integration testing with a Rancher instance):
  ```bash
  yarn serve-pkgs
  ```

### Linting

- **Check** (must pass with zero warnings):
  ```bash
  yarn lint
  ```
- **Auto-fix**:
  ```bash
  yarn lint:fix
  ```
- ESLint covers `.js`, `.ts`, and `.vue` files.
- Always run `yarn lint:fix` before committing.

### Unit Tests

- **Run**:
  ```bash
  yarn test
  ```
  - `yarn test` starts Jest in watch mode (like in the Rancher dashboard) and only runs the tests related to changed files. It does not exit, so use `yarn test:ci` for a single run of all tests, e.g. in scripts.
- CI runs `yarn test:ci` on every pull request.
- See the Unit Tests section of the Contributors Guide for how the tests are set up.

### Commit Conventions

- Commits are validated by [commitlint](https://commitlint.js.org/) via a Husky `commit-msg` hook.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) format (configured in `commitlint.config.js`).

### Agent Documentation

- Source files live in `docs/agents.md/` (agents, contributors, personas subdirectories).
- After editing any source file, regenerate the root `AGENTS.md`:
  ```bash
  yarn agents:generate
  ```