## Boundaries

- ✅ **Always:**
  - Write to `.github`, `docs/`,  `pkg/`, `scripts/`.
  - Make commits in a new branch (for a PR).
  - Run `yarn lint:fix` before commits.
  - Follow existing naming conventions (PascalCase for components, camelCase for functions).
  - After changing a vue, js or ts file make sure it's automatically formatted with eslint.
- ⚠️ **Ask first:**
  - Adding dependencies
- 🚫 **Never:**
  - Commit or log secrets, `.env`, `kubeconfig` or any API keys.
  - Edit `node_modules/`.
  - Commit directly to `main` (use PRs).
