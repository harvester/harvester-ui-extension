// Same settings in every environment, otherwise tests that format dates depend on the machine
process.env.TZ = 'UTC';

// The setup follows the one of the Rancher dashboard and of the Rancher extension template (rancher/ui-plugin-examples)
module.exports = {
  roots:                  ['<rootDir>/pkg'],
  testEnvironment:        'jsdom',
  // Jest 28+ (jest-environment-jsdom) defaults package resolution to the "browser" export condition, which makes
  // packages like @vue/test-utils resolve their browser (global-Vue) build and throw "Vue is not defined".
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  setupFilesAfterEnv:     ['<rootDir>/jest.setup.js'],
  watchman:               false,
  moduleFileExtensions:   ['js', 'mjs', 'json', 'vue', 'ts'],
  modulePaths:            ['<rootDir>'],
  moduleNameMapper:       {
    '^~/(.*)$':                                                                      '<rootDir>/$1',
    '^@/(.*)$':                                                                      '<rootDir>/$1',
    '^@shell/(.*)$':                                                                 '<rootDir>/node_modules/@rancher/shell/$1',
    '^@components/(.*)$':                                                            '<rootDir>/node_modules/@rancher/shell/rancher-components/$1',
    // At build time @pkg/<path> is resolved to the package that imports it (see vue.config.js of @rancher/shell)
    '^@pkg/harvester/(.*)$':                                                         '<rootDir>/pkg/harvester/$1',
    '^@pkg/(.*)$':                                                                   '<rootDir>/pkg/harvester/$1',
    // clipboard-polyfill's package `exports` only declares an `import` condition, so map it to its ESM build
    // (transpiled via transformIgnorePatterns below)
    '^clipboard-polyfill$':                                                          '<rootDir>/node_modules/clipboard-polyfill/dist/es6/clipboard-polyfill.es6.js',
    '\\.(jpe?g|png|gif|webp|svg|mp4|webm|ogg|mp3|wav|flac|aac|woff2?|eot|ttf|otf)$': '<rootDir>/svgTransform.js',
  },
  modulePathIgnorePatterns: ['<rootDir>/pkg/harvester/node_modules'],
  testPathIgnorePatterns:   ['<rootDir>/node_modules/', '<rootDir>(/.*)*/__tests__/utils/'],
  transform:                {
    // vue3-jest, but with TypeScript registered for the Vue compiler first, see vue3JestRegisterTs.js
    '^.+\\.vue$':    '<rootDir>/vue3JestRegisterTs.js',
    // isolatedModules: transpile only, the types are not checked while testing
    '^.+\\.tsx?$':   ['ts-jest', { tsconfig: { sourceMap: true, isolatedModules: true } }],
    // Use the project babel config (babel.config.js, which extends the one of @rancher/shell)
    '^.+\\.js$':   '<rootDir>/node_modules/babel-jest',
    // process mjs (e.g. vee-validate ESM) with babel-jest
    '^.+\\.mjs$':  '<rootDir>/node_modules/babel-jest',
    '^.+\\.svg$':    '<rootDir>/svgTransform.js',
  },
  transformIgnorePatterns: [
    // @rancher/shell is shipped untranspiled, the other packages are ESM-only. @replit/codemirror-vim-core is
    // required by the CommonJS build of @replit/codemirror-vim, which the shell's YamlEditor imports
    '/node_modules/(?!(@rancher/shell|color|color-string|color-convert|color-name|vee-validate|@vee-validate|clipboard-polyfill|intl-messageformat|@formatjs|@replit/codemirror-vim-core)/)',
  ],
};
