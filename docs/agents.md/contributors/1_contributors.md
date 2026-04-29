## Getting Started

Please see the [Harvester UI Extension README](https://github.com/harvester/harvester-ui-extension).

To get started, follow the `Development Setup` section.

## Project Information

- **Tech Stack:**
  - `Vue.js`: Framework
  - `Linting`: ESLint
  - `CSS`: SCSS should be used
  - `TypeScript`: Primary language for logic.
- **Code Style and Standards:**
  - `Language`: TypeScript is preferred for new code.
  - `Vue.js`:
    - Composition API components are preferred over Options API.
    - Large pages with lots of code and styles should be avoided by breaking the page up into smaller Vue components.
    - Place source tag above template above style.
    - style tag should contain `lang='scss' scoped`.
  - `Linting`: Follow the ESLint configuration in the root.

- **File Structure:**
  - `.github/`: CI/CD workflows and Renovate config.
  - `docs/`: Documentation source for `AGENTS.md` generation.
  - `scripts/`: Bash scripts for build, CI and doc generation.
  - `pkg/harvester/`: Main extension source. Files are named after K8s resource types (e.g., `kubevirt.io.virtualmachine`, `harvesterhci.io.volume`).
     - `index.ts`: Plugin entry point — registers the product and auto-imports models/detail/edit views.
     - `types.ts`: `HCI` constant mapping 60+ K8s resource types to string identifiers.
     - `components/`: Reusable Vue components (VNC/serial console, settings panels, upgrade banners, filters).
     - `config/`: Constants — settings keys, table column definitions, feature flags, type mappings, doc links.
     - `detail/`: Read-only detail views per resource type. Complex resources use subdirectories with tabs.
     - `dialog/`: Modal dialogs for operations (VM clone/migrate/restart, backup/restore, device passthrough, etc.).
     - `edit/`: Create/edit forms. Complex resources (e.g., VM) split into subcomponents (CpuMemory, Network, Volume, CloudConfig, etc.).
     - `formatters/`: Table cell formatters — state badges, usage bars, resource references.
     - `l10n/`: Localization (`en-us.yaml`).
     - `list/`: List (table) views per resource type, mirroring `detail/` and `edit/` naming.
     - `mixins/`: Shared Vue mixins — VM helpers (`harvester-vm/`) and disk helpers (`harvester-disk.js`).
     - `models/`: Model classes extending `SteveModel` with computed properties and actions. Base class: `harvester.js`.
     - `pages/`: Route-level pages — dashboard, support, console, members, brand, alertmanager.
     - `promptRemove/`: Custom delete-confirmation dialogs (VM, backup).
     - `routing/`: Vue Router config — all product routes (CRUD, console, support, upgrade, etc.).
     - `store/`: Vuex modules — `harvester-common.js` for shared state; `harvester-store/` for VM/resource creation actions with Steve integration.
     - `styles/`: Global SCSS files.
     - `utils/`: Helpers — VM volume templates, CPU/memory calc, cron parsing, regex validators, feature flags.
     - `validators/`: Form validation functions per resource type, pushing i18n error messages.
  
  

## Harvester UI Extension Development Guide

1. Backward Compatibility
The Harvester UI Extension supports earlier cluster versions (e.g., UI Ext v1.8.0 works with clusters v1.7.0 and v1.6.0). It uses Feature Flags defined in pkg/config/feature-flags to ensure the UI matches the cluster's specific version.

2. Implementation Steps for New Features
To add a feature in a new release, follow these steps:

    Register: Add a unique [Feature Name] to the corresponding release array in the configuration.

    Check: Use the following getter to verify if the feature is enabled for the current version:

    ```
    computed: {
      newFeatureEnabled() {
        return this.$store.getters['harvester-common/getFeatureEnabled']('[Feature Name]');
      },
    },
    ```
    Render: Use the result of the check to conditionally render the UI components.

