const baseConfig = require('@rancher/shell/pkg/babel.config');

module.exports = {
  ...baseConfig,
  plugins: [
    ...(baseConfig.plugins || []),
    '@babel/plugin-transform-class-static-block'
  ]
};
