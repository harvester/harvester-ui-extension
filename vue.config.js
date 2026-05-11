const path = require('path');
const baseConfig = require('@rancher/shell/vue.config');

const shellConfig = baseConfig(__dirname, {
  excludes: [],
  // excludes: ['harvester']
});

const originalConfigureWebpack = shellConfig.configureWebpack;

shellConfig.configureWebpack = function(config) {
  if (originalConfigureWebpack) {
    originalConfigureWebpack(config);
  }

  // Force all @rancher/icons imports (including from @rancher/shell) to use
  // the top-level 2.0.60 version so new icons are available everywhere.
  config.resolve.alias['@rancher/icons'] = path.resolve(__dirname, 'node_modules', '@rancher/icons');
};

module.exports = shellConfig;
