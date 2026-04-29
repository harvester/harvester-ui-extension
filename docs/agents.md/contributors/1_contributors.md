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
  - `.github/`: github workflows yaml files.
  - `docs/`: Internal documentation source.
  - `scripts/`: Bash scripts used in build, test and github workflows.
  - `pkg/`: Internal Harvester UI extensions.
     - `components/`: Store reusable, cross-page UI components here.
     - `config/`: configuration files to put variables definitions
     - `dialog/`: pup up dialog in harvester ui extension
     - `detail/`: resource customized detail page
     - `edit/`: create and edit page 
     - `formatters/`: customized column formatter
     - `l10n/`: translation file
     - `list/`: list page
     - `mixins/`: harvester VM mixin
     - `models/`: harvester ui extension resource model
     - `pages/`: specific pages like support, members and brand
     - `styles/`: style file can be imported into harvester ui extension
     - `promptRemove/`: customized prompt remove dialog
     - `routing/`: routing file
     - `store/`: harvester ui extension self store
     - `utils/`: util functions
     - `validators/`:  validation functions
  
  

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

