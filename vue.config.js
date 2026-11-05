const path = require('path');
const config = require('@rancher/shell/vue.config');

const baseConfig = config(__dirname, {
  excludes: [],
  // excludes: ['harvester']
});

const baseConfigureWebpack = baseConfig.configureWebpack;

module.exports = {
  ...baseConfig,

  configureWebpack(webpackConfig) {
    if (typeof baseConfigureWebpack === 'function') {
      baseConfigureWebpack(webpackConfig);
    }

    // noVNC >= 1.7 only publishes `./core/rfb.js` in its `exports` map, so resolve the
    // package by path to keep the keysym/input helpers importable.
    webpackConfig.resolve.alias['@novnc/novnc'] = path.resolve(__dirname, 'node_modules/@novnc/novnc');

    // noVNC 1.7 uses top-level await for WebCodecs detection.
    webpackConfig.output = { ...webpackConfig.output, environment: { ...webpackConfig.output?.environment, asyncFunction: true } };
  }
};
