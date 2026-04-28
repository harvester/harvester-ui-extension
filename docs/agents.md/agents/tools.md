## Tools

- **Install dependencies**: `yarn install --frozen-lockfile`
- **Start development server**: `RANCHER_ENV=harvester API=https://your-harvester-ip yarn dev`
  - The `API` environment variable should point to a running harvester cluster (e.g., `https://x.x.x.x`).
  - The dashboard will be available at `https://127.0.0.1:8005`.
- **Build**: `yarn build harvester`
- **Serve local build extension**: `yarn serve-pkgs` 
- **Lint**: `yarn lint`