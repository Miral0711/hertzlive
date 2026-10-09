const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The phone app reuses the web prototype's store/model code (packages/frontend/src) instead of
// copying it, so Metro must watch that folder.
const frontendSrc = path.resolve(__dirname, '../frontend/src');
config.watchFolders = [...(config.watchFolders || []), frontendSrc];

// Files under frontend/src would otherwise resolve `react` to the web app's copy; force a single
// React (this package's) so hooks work across both.
const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [__dirname] }) };
  }
  return (upstream || context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
