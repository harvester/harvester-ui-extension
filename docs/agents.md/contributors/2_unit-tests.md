## Unit Tests (Jest)

Unit and component tests run with [Jest](https://jestjs.io/). The setup follows the Rancher dashboard and the Rancher extension template ([rancher/ui-plugin-examples](https://github.com/rancher/ui-plugin-examples)), so both stay aligned.

- Run the tests in watch mode with `yarn test`, all tests once with `yarn test:ci`, a single file with `yarn test <path>`. CI runs `yarn test:ci` on every pull request.
- Test files live next to the code in `__tests__` folders and are named `<name>.test.js` or `<name>.test.ts`.
- Configuration:
  - `jest.config.js`: environment, module aliases (`@shell`, `@components`, `@pkg`) and transforms.
  - `jest.setup.js`: global mocks (`t`, `$store`, common directives) and browser APIs that jsdom does not provide.
  - `vue3JestRegisterTs.js`: makes TypeScript available to the Vue compiler, otherwise `.vue` files with typed props fail to compile.
- Components are tested with the Vue Test Utils 2 API: use `props` and `global.mocks`, not the Vue 2 options `propsData` and `mocks`.
- Models and utils can be tested without mounting anything, see `pkg/harvester/models/__tests__` for examples.
