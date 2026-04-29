## Boundaries

- ✅ **Always:**
  - Write to `.github`, `docs/`,  `pkg/harvester`, `scripts/`.
  - Make commits in a new branch (for a PR).
  - Run `yarn lint:fix` before commits.
    - Use conventional commit format: 
    ```
    <type>:

    <description>
    ```
  - Follow existing naming conventions (PascalCase for components, camelCase for functions).
  - After changing a Vue, JS, or TS file, make sure it's automatically formatted with ESLint.
  - After updating files in `docs/agents.md/`, run `yarn agents:generate` to update root `AGENTS.md`.   
- ⚠️ **Ask first:**
  - Adding dependencies
  - Upgrading dependencies
- 🚫 **Never:**
  - Commit or log secrets, `.env`, `kubeconfig` or any API keys.
  - Edit `node_modules/`.
  - Commit directly to `main` (use PRs).
  - Skip git hooks with `--no-verify` flag.
