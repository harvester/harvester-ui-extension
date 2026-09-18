const path = require('path');

const baseConfig = require('@rancher/shell/pkg/vue.config')(__dirname);

const baseConfigureWebpack = baseConfig.configureWebpack;

// noVNC >= 1.7 only publishes `./core/rfb.js` in its `exports` map, so resolve the
// package by path to keep the keysym/input helpers importable.
const NOVNC_DIR = path.resolve(__dirname, '..', '..', 'node_modules', '@novnc', 'novnc');

module.exports = {
  ...baseConfig,

  configureWebpack(config) {
    if (typeof baseConfigureWebpack === 'function') {
      baseConfigureWebpack(config);
    }

    config.resolve.alias['@novnc/novnc'] = NOVNC_DIR;

    // noVNC 1.7 uses top-level await for WebCodecs detection.
    config.output = { ...config.output, environment: { ...config.output?.environment, asyncFunction: true } };
  }
};
