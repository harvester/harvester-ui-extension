const path = require('path');

const config = require('@rancher/shell/pkg/vue.config')(__dirname);
const originalConfigureWebpack = config.configureWebpack;

config.configureWebpack = function(cfg) {
  if (originalConfigureWebpack) {
    originalConfigureWebpack(cfg);
  }

  // Force @rancher/icons to resolve to the top-level 2.0.60 version
  // so new icons (datastore, disk, network, etc.) are available in extension mode.
  const maindir = path.resolve(__dirname, '..', '..');

  cfg.resolve.alias['@rancher/icons'] = path.resolve(maindir, 'node_modules', '@rancher/icons');
};

module.exports = config;
